import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ==========================================
// BUSCAR FOTOS DE PERFIL EM LOTE — v3
// ==========================================
// Seleciona os contatos sem foto permanente e delega a resolução para o
// resolvedor único (resolverFotoPerfil), que percorre todas as instâncias
// conectadas de todos os provedores (Z-API e W-API).
// Este arquivo NÃO contém regra de provedor — só fila e orçamento de tempo.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const limite = Math.min(Number(body?.limite) || 80, 200);

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
      if (Date.now() - inicioLote > 100000) {
        console.log('[FOTOS-LOTE] ⏱️ Orçamento atingido — encerrando lote parcial');
        break;
      }
      const phone = (contato.telefone_canonico || contato.telefone || '').replace(/\D/g, '');
      try {
        const resp = await base44.functions.invoke('resolverFotoPerfil', {
          phone,
          contact_id: contato.id,
          persistir: true
        });
        const dados = resp?.data || resp;
        if (dados?.file_url) atualizados++;
        else if (dados?.success) semFotoNoWhats++;
        else throw new Error(dados?.error || 'resolvedor_falhou');
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
      erros_detalhes: errosDetalhes.slice(0, 10)
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});