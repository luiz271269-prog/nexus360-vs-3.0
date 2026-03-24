// Resolver ou Criar Contato — Deduplicação por telefone_canonico
// v1.1 — Webhook que recebe base44 via invoke do webhookZapi/webhookWapi

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const _locks = new Map();

function normalizarParaCanonico(telefone) {
  if (!telefone) return null;
  let n = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!n || n.length < 8) return null;
  
  n = n.replace(/^0+/, '');
  if (!n.startsWith('55')) {
    if (n.length === 10 || n.length === 11) n = '55' + n;
  }
  
  if (n.startsWith('55') && (n.length === 12 || n.length === 13)) {
    return n;
  }
  
  return null;
}

// Lógica centralizada (não depende de req)
async function executarDedup(base44, payload) {
  const { telefone, nome, pushName, profilePicUrl, integracaoId } = payload;

  if (!telefone) throw new Error('telefone_required');

  const canonico = normalizarParaCanonico(telefone);
  if (!canonico) throw new Error('telefone_invalido');

  const telefoneFinal = '+' + canonico;

  // Lock
  const lockKey = canonico;
  const existingLock = _locks.get(lockKey) || Promise.resolve();
  let resolveLock;
  const newLock = new Promise(r => { resolveLock = r; });
  _locks.set(lockKey, existingLock.then(() => newLock));
  await existingLock;

  try {
    // PASSO 1: Buscar por telefone_canonico
    const existentes = await base44.asServiceRole.entities.Contact.filter(
      { telefone_canonico: canonico },
      'created_date',
      5
    ).catch(e => {
      console.warn('[DEDUP] Erro busca telefone_canonico:', e.message);
      return [];
    });

    if (existentes && existentes.length > 0) {
      const contatoExistente = existentes[0];
      console.log(`[DEDUP] ✅ ENCONTRADO por telefone_canonico="${canonico}" | ID: ${contatoExistente.id}`);

      // Auto-cleanup de duplicatas
      if (existentes.length > 1) {
        console.warn(`[DEDUP] 🧹 Auto-cleanup: ${existentes.length - 1} duplicado(s)`);
        for (const dup of existentes.slice(1)) {
          base44.asServiceRole.entities.Contact.delete(dup.id).catch(() => {});
        }
      }

      // Atualizar dados
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
      return {
        success: true,
        contact: contatoExistente,
        action: 'found_by_canonical',
        deduplicated: existentes.length - 1
      };
    }

    // FALLBACK 1: Buscar por telefone histórico (contatos legados sem telefone_canonico)
    console.log(`[DEDUP] 🔄 FALLBACK 1: buscando histórico por telefone para ${telefoneFinal}`);
    const variacoes = [telefoneFinal, canonico, `+55${canonico.replace(/^55/, '')}`].filter(Boolean);
    let contatoHistorico = null;

    for (const variacao of variacoes) {
      if (contatoHistorico) break;
      try {
        const resultado = await base44.asServiceRole.entities.Contact.filter(
          { telefone: variacao },
          'created_date',
          1
        ).catch(() => []);
        if (resultado && resultado.length > 0) {
          contatoHistorico = resultado[0];
          console.log(`[DEDUP] ✅ ENCONTRADO (fallback por telefone): ${contatoHistorico.id}`);
          break;
        }
      } catch (e) {}
    }

    if (contatoHistorico) {
      console.log(`[DEDUP] ✅ ENCONTRADO (fallback): ${contatoHistorico.id}`);
      
      const updateHistorico = { telefone_canonico: canonico };
      if (nome && (!contatoHistorico.nome || contatoHistorico.nome === contatoHistorico.telefone)) {
        updateHistorico.nome = nome || pushName;
      }
      if (profilePicUrl && contatoHistorico.foto_perfil_url !== profilePicUrl) {
        updateHistorico.foto_perfil_url = profilePicUrl;
        updateHistorico.foto_perfil_atualizada_em = new Date().toISOString();
      }
      if (integracaoId && !contatoHistorico.conexao_origem) {
        updateHistorico.conexao_origem = integracaoId;
      }
      
      await base44.asServiceRole.entities.Contact.update(contatoHistorico.id, updateHistorico).catch(() => {});
      
      resolveLock();
      _locks.delete(lockKey);
      return {
        success: true,
        contact: contatoHistorico,
        action: 'found_by_fallback_and_fixed',
        telefoneCanonicoPreenchido: true
      };
    }

    // PASSO 2: Criar novo
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

    console.log(`[DEDUP] ✅ CRIADO: ${novoContato.id}`);

    // Anti-race
    try {
      const recheck = await base44.asServiceRole.entities.Contact.filter(
        { telefone_canonico: canonico },
        'created_date',
        2
      ).catch(() => []);

      if (recheck && recheck.length > 1) {
        const maisAntigo = recheck[0];
        if (maisAntigo.id !== novoContato.id) {
          await base44.asServiceRole.entities.Contact.delete(novoContato.id).catch(() => {});
          console.log(`[DEDUP] 🔀 Race condition: mantendo ${maisAntigo.id}`);
          resolveLock();
          _locks.delete(lockKey);
          return {
            success: true,
            contact: maisAntigo,
            action: 'deduplicated_on_race'
          };
        }
      }
    } catch (e) {
      console.warn(`[DEDUP] ⚠️ Erro anti-race:`, e.message);
    }

    resolveLock();
    _locks.delete(lockKey);
    return {
      success: true,
      contact: novoContato,
      action: 'created'
    };

  } catch (error) {
    console.error('[DEDUP] ❌ Erro:', error.message);
    resolveLock();
    _locks.delete(lockKey);
    throw error;
  }
}

// Webhook handler
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
  }

  let payload;
  try {
    const body = await req.text();
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    console.error('[DEDUP] SDK init error:', e.message);
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  try {
    const resultado = await executarDedup(base44, payload);
    return Response.json(resultado);
  } catch (error) {
    console.error('[DEDUP] ❌ Webhook error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});