import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ==========================================
// BUSCAR FOTOS DE PERFIL EM LOTE
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
      const f = c.foto_perfil_url;
      const temFoto = f && f !== 'null' && f !== 'undefined';
      const temTelefone = (c.telefone_canonico || c.telefone || '').replace(/\D/g, '').length >= 10;
      return !temFoto && temTelefone;
    }).slice(0, limite);

    let atualizados = 0;
    let semFotoNoWhats = 0;
    let erros = 0;

    for (const contato of semFoto) {
      const phoneClean = (contato.telefone_canonico || contato.telefone || '').replace(/\D/g, '');
      try {
        const url = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/profile-picture?phone=${phoneClean}`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: { 'Client-Token': integracao.security_client_token_header }
        });

        if (!resp.ok) { erros++; continue; }

        const data = await resp.json();
        const photoUrl = data.link || null;

        if (photoUrl) {
          await base44.asServiceRole.entities.Contact.update(contato.id, {
            foto_perfil_url: photoUrl,
            foto_perfil_atualizada_em: new Date().toISOString()
          });
          atualizados++;
        } else {
          semFotoNoWhats++;
        }
      } catch (e) {
        erros++;
      }
    }

    return Response.json({
      success: true,
      total_analisados: semFoto.length,
      atualizados,
      sem_foto_no_whatsapp: semFotoNoWhats,
      erros,
      integracao_usada: integracao.nome_instancia
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});