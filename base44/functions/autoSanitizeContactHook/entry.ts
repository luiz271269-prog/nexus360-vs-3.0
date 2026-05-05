import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ════════════════════════════════════════════════════════════════════════
 * AUTO-CURA DE CONTATO (Entity Hook — versão leve)
 * ════════════════════════════════════════════════════════════════════════
 *
 * Acionado quando um Contact é criado ou atualizado em campos sensíveis.
 * Executa apenas verificações RÁPIDAS e SEGURAS (canonical + tags). Não
 * mexe em mensagens/threads — para isso, usar a skillSanitizacaoContato
 * via UI ou cron agendado.
 *
 * Por que leve?
 *  - Entity hooks rodam síncrono e bloqueiam o evento; precisam ser <2s
 *  - Limitação plataforma: invoke de outra função entre serverless dá 403
 *  - 80% dos problemas reais são canonical/tags, que resolvemos inline
 *
 * O que cobre:
 *  ✓ telefone_canonico ausente ou corrompido (MERGED_)
 *  ✓ telefone_canonico fora de sincronia com telefone
 *  ✓ tags poluídas com 'merged'/'duplicata' acumuladas
 *
 * O que NÃO cobre (deixa para skillSanitizacaoContato manual):
 *  ✗ Mensagens duplicadas por whatsapp_message_id
 *  ✗ Mensagens órfãs em threads merged
 *  ✗ Mesclagem de contatos duplicados
 *
 * Guard rails:
 *  - Ignora deletes
 *  - Ignora updates que não mudaram campos sensíveis
 *  - Ignora se o próprio update veio do hook (cooldown 60s)
 *  - Ignora contatos bloqueados
 *
 * v1.1.0
 */

const VERSION = 'v1.1.0';
const CAMPOS_SENSIVEIS = ['telefone', 'telefone_canonico', 'tags'];
const COOLDOWN_SECONDS = 60;

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try { payload = await req.json(); } catch {}

    const { event, data, changed_fields } = payload;

    if (!event?.entity_id) {
      return Response.json({ skipped: 'sem_entity_id' }, { headers });
    }

    const contactId = event.entity_id;
    const eventType = event.type;

    // Guard 1: ignorar deletes
    if (eventType === 'delete') {
      return Response.json({ skipped: 'delete_event' }, { headers });
    }

    // Guard 2: em update, só roda se mudou campo sensível
    if (eventType === 'update') {
      const mudou = (changed_fields || []).some(f => CAMPOS_SENSIVEIS.includes(f));
      if (!mudou) {
        return Response.json({
          skipped: 'sem_campos_sensiveis',
          changed_fields: changed_fields || []
        }, { headers });
      }
    }

    // Guard 3: contato bloqueado
    if (data?.bloqueado === true) {
      return Response.json({ skipped: 'contato_bloqueado' }, { headers });
    }

    // Guard 4: cooldown
    const ultimaSanitize = data?.campos_personalizados?._last_sanitize_at;
    if (ultimaSanitize) {
      const segundosDesde = (Date.now() - new Date(ultimaSanitize).getTime()) / 1000;
      if (segundosDesde < COOLDOWN_SECONDS) {
        return Response.json({ skipped: 'cooldown', segundos_desde: Math.round(segundosDesde) }, { headers });
      }
    }

    // Guard 5: origem do hook
    if (data?.campos_personalizados?._skill_origem === 'auto_sanitize_hook') {
      return Response.json({ skipped: 'origem_hook' }, { headers });
    }

    // ═══════════════════════════════════════════════════════════
    // VERIFICAÇÕES INLINE (rápidas)
    // ═══════════════════════════════════════════════════════════
    const update = {};
    const motivos = [];

    // Carregar dados atuais (se data não veio completo)
    let contato = data;
    if (!contato?.telefone) {
      try {
        contato = await base44.asServiceRole.entities.Contact.get(contactId);
      } catch {
        return Response.json({ skipped: 'contato_nao_encontrado' }, { headers });
      }
    }

    const telefoneEsperado = (contato?.telefone || '').replace(/\D/g, '');
    const canonicoAtual = contato?.telefone_canonico || '';

    // 1️⃣ telefone_canonico corrompido (contém MERGED_) ou ausente ou divergente
    const canonicoCorrompido = canonicoAtual.includes('MERGED_');
    const canonicoAusente = !canonicoAtual && !!telefoneEsperado;
    const canonicoDivergente = !canonicoCorrompido && telefoneEsperado && canonicoAtual !== telefoneEsperado;

    if ((canonicoCorrompido || canonicoAusente || canonicoDivergente) && telefoneEsperado) {
      update.telefone_canonico = telefoneEsperado;
      motivos.push(canonicoCorrompido ? 'canonical_corrompido' : (canonicoAusente ? 'canonical_ausente' : 'canonical_divergente'));
    }

    // 2️⃣ Tags poluídas
    const tags = contato?.tags || [];
    const tagsPoluidas = tags.filter(t => t === 'merged' || t === 'duplicata').length > 0;
    const tagsAcumuladas = tags.length > 15;

    if (tagsPoluidas || tagsAcumuladas) {
      const tagsLimpas = [...new Set(tags.filter(t => t !== 'merged' && t !== 'duplicata'))];
      update.tags = tagsLimpas;
      motivos.push(`tags_limpas:${tags.length}->${tagsLimpas.length}`);
    }

    // ═══════════════════════════════════════════════════════════
    // APLICAR CORREÇÕES (se houver)
    // ═══════════════════════════════════════════════════════════
    if (Object.keys(update).length === 0) {
      console.log(`[autoSanitize ${VERSION}] ✅ ${contactId} já saudável`);
      return Response.json({
        success: true,
        action: 'no_action',
        contact_id: contactId,
        motivo: 'ja_saudavel'
      }, { headers });
    }

    // Marcar metadata para evitar loop
    const camposAtuais = contato?.campos_personalizados || {};
    update.campos_personalizados = {
      ...camposAtuais,
      _last_sanitize_at: new Date().toISOString(),
      _last_sanitize_status: 'auto_corrigido',
      _skill_origem: 'auto_sanitize_hook',
      _last_sanitize_motivos: motivos
    };

    try {
      await base44.asServiceRole.entities.Contact.update(contactId, update);
      console.log(`[autoSanitize ${VERSION}] 🔧 ${contactId} corrigido:`, motivos.join(', '));
      return Response.json({
        success: true,
        action: 'corrected',
        contact_id: contactId,
        motivos,
        version: VERSION
      }, { headers });
    } catch (e) {
      console.error(`[autoSanitize ${VERSION}] Falha ao atualizar:`, e.message);
      return Response.json({ error: e.message }, { status: 500, headers });
    }

  } catch (error) {
    console.error(`[autoSanitize ${VERSION}] ❌ ERRO:`, error);
    return Response.json({ error: error.message, version: VERSION }, { status: 500, headers });
  }
});