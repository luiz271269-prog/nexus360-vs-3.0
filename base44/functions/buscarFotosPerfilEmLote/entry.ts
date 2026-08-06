import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ==========================================
// BUSCAR FOTOS DE PERFIL EM LOTE — persistência permanente v2
// ==========================================
// Percorre contatos externos sem foto_perfil_url e tenta buscar via Z-API.
// Usa a integração WhatsApp conectada (Z-API) para resolver a foto.
// Salva foto_perfil_url + foto_perfil_atualizada_em no Contact.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const limite = Math.min(Number(body?.limite) || 80, 200);

    // Integração Z-API conectada (preferir conectada)
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ api_provider: 'z_api' });
    const integracao = integracoes.find((i) => i.status === 'conectado') || integracoes[0];

    if (!integracao) {
      return Response.json({ error: 'Nenhuma integração Z-API encontrada' }, { status: 404 });
    }

    // Contatos com telefone (página recente). Filtramos sem foto em memória
    // pois o backend não suporta filtro "campo vazio" de forma confiável.
    const candidatos = await base44.asServiceRole.entities.Contact.list('-updated_date', 600);
    const semFoto = candidatos.filter((c) => {
      const f = String(c.foto_perfil_url || '');
      const precisaPersistir = !f || f === 'null' || f === 'undefined' || f.includes('pps.whatsapp.net');
      const temTelefone = (c.telefone_canonico || c.telefone || '').replace(/\D/g, '').length >= 10;
      return precisaPersistir && temTelefone;
    }).sort((a, b) => {
      const aTemporaria = String(a.foto_perfil_url || '').includes('pps.whatsapp.net') ? 1 : 0;
      const bTemporaria = String(b.foto_perfil_url || '').includes('pps.whatsapp.net') ? 1 : 0;
      if (bTemporaria !== aTemporaria) return bTemporaria - aTemporaria;
      return new Date(b.foto_perfil_atualizada_em || 0).getTime() - new Date(a.foto_perfil_atualizada_em || 0).getTime();
    }).slice(0, limite);

    let atualizados = 0;
    let semFotoNoWhats = 0;
    let erros = 0;
    const errosDetalhes = [];

    const inicioLote = Date.now();
    for (const contato of semFoto) {
      // Orçamento de tempo: evita estourar o limite da função no meio de um upload
      if (Date.now() - inicioLote > 70000) {
        console.log('[FOTOS-LOTE] ⏱️ Orçamento de 70s atingido — encerrando lote parcial');
        break;
      }
      const phoneClean = (contato.telefone_canonico || contato.telefone || '').replace(/\D/g, '');
      try {
        let photoUrl = String(contato.foto_perfil_url || '').includes('pps.whatsapp.net')
          ? contato.foto_perfil_url
          : null;

        const buscarUrlAtual = async () => {
          const providerBase = (integracao.base_url_provider && integracao.base_url_provider !== 'null')
            ? integracao.base_url_provider.replace(/\/$/, '')
            : 'https://api.z-api.io';
          const url = `${providerBase}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/profile-picture?phone=${phoneClean}`;
          const resp = await fetch(url, {
            method: 'GET',
            headers: { 'Client-Token': integracao.security_client_token_header },
            signal: AbortSignal.timeout(12000)
          });
          if (!resp.ok) return null;
          const data = await resp.json();
          const link = String(data.link || '');
          return link.startsWith('http://') || link.startsWith('https://') ? link : null;
        };

        if (!photoUrl) photoUrl = await buscarUrlAtual();

        if (photoUrl) {
          let download = await fetch(photoUrl, { signal: AbortSignal.timeout(12000) });
          if (!download.ok && String(contato.foto_perfil_url || '').includes('pps.whatsapp.net')) {
            photoUrl = await buscarUrlAtual();
            if (photoUrl) download = await fetch(photoUrl, { signal: AbortSignal.timeout(12000) });
          }
          if (!download.ok) throw new Error(`download_status_${download.status}`);
          const contentType = (download.headers.get('content-type') || 'image/jpeg').split(';')[0];
          if (!contentType.startsWith('image/')) throw new Error('conteudo_nao_imagem');
          const bytes = await download.arrayBuffer();
          const extensao = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
          const file = new File([bytes], `perfil_${contato.id}_${Date.now()}.${extensao}`, { type: contentType });
          const enviar = () => Promise.race([
            base44.asServiceRole.integrations.Core.UploadFile({ file }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('upload_timeout_25s')), 25000))
          ]);
          // As imagens são pequenas (14–36 KB): timeout aqui é instabilidade do storage,
          // não tamanho. Uma segunda tentativa curta resolve a maioria dos casos.
          let upload = await enviar().catch(() => null);
          if (!upload?.file_url) upload = await enviar();
          if (!upload?.file_url) throw new Error('upload_sem_url');
          const appId = Deno.env.get('BASE44_APP_ID');
          const update = await fetch(`https://base44.app/api/apps/${appId}/entities/Contact/${contato.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': req.headers.get('authorization') || '',
              'api_key': req.headers.get('api_key') || '',
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              foto_perfil_url: upload.file_url,
              foto_perfil_atualizada_em: new Date().toISOString()
            })
          });
          if (!update.ok) throw new Error(`update_api_http_${update.status}`);
          atualizados++;
        } else {
          semFotoNoWhats++;
          // O WhatsApp não tem foto para este número (item-not-found / privacidade).
          // Limpa a URL morta para o contato sair da fila e não ocupar o lote de amanhã.
          if (String(contato.foto_perfil_url || '').includes('pps.whatsapp.net')) {
            const appId = Deno.env.get('BASE44_APP_ID');
            await fetch(`https://base44.app/api/apps/${appId}/entities/Contact/${contato.id}`, {
              method: 'PUT',
              headers: {
                'Authorization': req.headers.get('authorization') || '',
                'api_key': req.headers.get('api_key') || '',
                'Content-Type': 'application/json'
              },
              signal: AbortSignal.timeout(15000),
              body: JSON.stringify({ foto_perfil_url: '', foto_perfil_atualizada_em: new Date().toISOString() })
            });
          }
        }
      } catch (e) {
        console.warn(`[FOTOS-LOTE] ${contato.id}: ${e.message}`);
        errosDetalhes.push({ contato_id: contato.id, erro: e.message });
        erros++;
      }
    }

    return Response.json({
      success: true,
      total_analisados: semFoto.length,
      atualizados,
      sem_foto_no_whatsapp: semFotoNoWhats,
      erros,
      erros_detalhes: errosDetalhes.slice(0, 10),
      integracao_usada: integracao.nome_instancia
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});