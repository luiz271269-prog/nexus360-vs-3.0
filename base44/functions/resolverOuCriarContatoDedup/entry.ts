// Resolver ou Criar Contato — Deduplicação por telefone_canonico
// v1.0 — Função centralizada para uso em webhooks Z-API e W-API
// Garante 1 Contact por número (canonico), ignora burst/duplicatas

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Lock em memória: Map<canonico, Promise>
const _locks = new Map();

function normalizarParaCanonico(telefone) {
  if (!telefone) return null;
  let n = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!n || n.length < 8) return null;
  
  n = n.replace(/^0+/, ''); // Remove zeros à esquerda
  if (!n.startsWith('55')) {
    if (n.length === 10 || n.length === 11) n = '55' + n;
  }
  
  // Se tem 13 dígitos e o 5º é 9 (DDD + 9 + número), está ok
  // Se tem 12 dígitos (sem 9), também válido (formato legado)
  if (n.startsWith('55') && (n.length === 12 || n.length === 13)) {
    return n; // Retorna apenas dígitos, sem +
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    console.error('[DEDUP] SDK init error:', e.message);
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  let payload;
  try {
    const body = await req.text();
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const { telefone, nome, pushName, profilePicUrl, integracaoId } = payload;

  if (!telefone) {
    return Response.json({ success: false, error: 'telefone_required' }, { status: 400 });
  }

  const canonico = normalizarParaCanonico(telefone);
  if (!canonico) {
    return Response.json({ success: false, error: 'telefone_invalido' }, { status: 400 });
  }

  const telefoneFinal = '+' + canonico; // Com + para armazenar

  // ═══════════════════════════════════════════════════════════
  // LOCK: Serializa requisições simultâneas pro mesmo número
  // Elimina race condition onde 2 webhooks criam Contact duplicado
  // ═══════════════════════════════════════════════════════════
  const lockKey = canonico;
  const existingLock = _locks.get(lockKey) || Promise.resolve();
  let resolveLock;
  const newLock = new Promise(r => { resolveLock = r; });
  _locks.set(lockKey, existingLock.then(() => newLock));

  // Aguarda qualquer requisição anterior para o mesmo número terminar
  await existingLock;

  try {
    // ═══════════════════════════════════════════════════════════
    // PASSO 1: Buscar existente por telefone_canonico
    // ═══════════════════════════════════════════════════════════
    const existentes = await base44.asServiceRole.entities.Contact.filter(
      { telefone_canonico: canonico },
      'created_date',
      5 // Limita a 5 para detectar múltiplas duplicatas
    ).catch(e => {
      console.warn('[DEDUP] Erro busca telefone_canonico:', e.message);
      return [];
    });

    if (existentes && existentes.length > 0) {
      const contatoExistente = existentes[0]; // Usa o mais antigo
      console.log(`[DEDUP] ✅ ENCONTRADO: ${contatoExistente.id} | ${contatoExistente.nome}`);

      // Cleanup: deletar duplicatas silenciosamente (sem bloquear resposta)
      if (existentes.length > 1) {
        console.warn(`[DEDUP] 🧹 Detectadas ${existentes.length - 1} duplicata(s)`);
        for (const dup of existentes.slice(1)) {
          base44.asServiceRole.entities.Contact.delete(dup.id).catch(() => {});
        }
      }

      // Atualizar se dados novos chegarem
      const update = {};
      if (nome && (!contatoExistente.nome || contatoExistente.nome === contatoExistente.telefone)) {
        update.nome = nome || pushName;
      }
      if (profilePicUrl && contatoExistente.foto_perfil_url !== profilePicUrl) {
        update.foto_perfil_url = profilePicUrl;
        update.foto_perfil_atualizada_em = new Date().toISOString();
      }
      if (integracaoId && !contatoExistente.conexao_origem) {
        update.conexao_origem = integracaoId;
      }

      if (Object.keys(update).length > 0) {
        await base44.asServiceRole.entities.Contact.update(contatoExistente.id, update).catch(() => {});
      }

      resolveLock();
      _locks.delete(lockKey);
      return Response.json({
        success: true,
        contact: contatoExistente,
        action: 'found_and_updated',
        deduplicated: existentes.length - 1
      });
    }

    // ═══════════════════════════════════════════════════════════
    // PASSO 2: Não existe — criar novo Contact
    // ═══════════════════════════════════════════════════════════
    console.log(`[DEDUP] 🆕 Criando novo Contact para: ${telefoneFinal}`);

    const novoContato = await base44.asServiceRole.entities.Contact.create({
      nome: nome || pushName || telefoneFinal,
      telefone: telefoneFinal,
      telefone_canonico: canonico,
      tipo_contato: 'novo',
      whatsapp_status: 'verificado',
      conexao_origem: integracaoId || null,
      foto_perfil_url: profilePicUrl || null,
      foto_perfil_atualizada_em: profilePicUrl ? new Date().toISOString() : null,
      ultima_interacao: new Date().toISOString()
    });

    console.log(`[DEDUP] ✅ CRIADO: ${novoContato.id} | ${novoContato.nome}`);

    // Anti-race: se 2 requisições criaram ao mesmo tempo, manter o mais antigo
    const recheck = await base44.asServiceRole.entities.Contact.filter(
      { telefone_canonico: canonico },
      'created_date',
      2
    ).catch(() => []);

    if (recheck && recheck.length > 1) {
      const maisAntigo = recheck[0];
      if (maisAntigo.id !== novoContato.id) {
        await base44.asServiceRole.entities.Contact.delete(novoContato.id).catch(() => {});
        console.log(`[DEDUP] 🔀 Race condition: mantendo ${maisAntigo.id}, descartando novo`);
        resolveLock();
        _locks.delete(lockKey);
        return Response.json({
          success: true,
          contact: maisAntigo,
          action: 'deduplicated_on_race'
        });
      }
    }

    resolveLock();
    _locks.delete(lockKey);
    return Response.json({
      success: true,
      contact: novoContato,
      action: 'created'
    });

  } catch (error) {
    console.error('[DEDUP] ❌ Erro geral:', error.message);
    resolveLock();
    _locks.delete(lockKey);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});