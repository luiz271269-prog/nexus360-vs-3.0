// Resolver ou Criar Contato — Deduplicação por telefone_canonico
// v1.1 — Exportável para chamadas internas via invoke()
// NÃO é webhook — recebe base44 pré-inicializado dos webhooks

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

async function resolverOuCriarContatoDedup(base44, payload) {
  const { telefone, nome, pushName, profilePicUrl, integracaoId } = payload;

  if (!telefone) {
    throw new Error('telefone_required');
  }

  const canonico = normalizarParaCanonico(telefone);
  if (!canonico) {
    throw new Error('telefone_invalido');
  }

  const telefoneFinal = '+' + canonico;

  const lockKey = canonico;
  const existingLock = _locks.get(lockKey) || Promise.resolve();
  let resolveLock;
  const newLock = new Promise(r => { resolveLock = r; });
  _locks.set(lockKey, existingLock.then(() => newLock));

  await existingLock;

  try {
    // PASSO 1: Buscar existente por telefone_canonico
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
      console.log(`[DEDUP] ✅ ENCONTRADO por telefone_canonico="${canonico}" | ID: ${contatoExistente.id} | Nome: ${contatoExistente.nome}`);

      // Cleanup: deletar duplicatas silenciosamente
      if (existentes.length > 1) {
        console.warn(`[DEDUP] 🧹 Auto-cleanup: ${existentes.length - 1} duplicado(s) para canonico=${canonico}`);
        for (const dup of existentes.slice(1)) {
          base44.asServiceRole.entities.Contact.delete(dup.id).catch(e =>
            console.warn(`[DEDUP] ⚠️ Erro ao deletar duplicado ${dup.id}:`, e.message)
          );
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
      return {
        success: true,
        contact: contatoExistente,
        action: 'found_by_canonical',
        deduplicated: existentes.length - 1
      };
    }

    // FALLBACK: Buscar por telefone normalizado (para históricos sem canonical)
    console.log(`[DEDUP] 🔄 FALLBACK: buscando por telefone histórico para ${telefoneFinal}`);
    
    const variacoes = [
      telefoneFinal,
      canonico,
      `+55${canonico.replace(/^55/, '')}`
    ].filter(Boolean);

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
          break;
        }
      } catch (e) {
        // silencioso
      }
    }

    if (contatoHistorico) {
      console.log(`[DEDUP] ✅ ENCONTRADO (fallback histórico): ${contatoHistorico.id}`);
      // Autocorrigir: preencher o campo canonical que faltava
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

    // PASSO 2: Não existe — criar novo Contact
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
          console.log(`[DEDUP] 🔀 Race condition: mantendo ${maisAntigo.id}, descartando novo`);
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
      console.warn(`[DEDUP] ⚠️ Erro no re-check anti-race:`, e.message);
    }

    resolveLock();
    _locks.delete(lockKey);
    return {
      success: true,
      contact: novoContato,
      action: 'created'
    };

  } catch (error) {
    console.error('[DEDUP] ❌ Erro geral:', error.message);
    resolveLock();
    _locks.delete(lockKey);
    throw error;
  }
}

export { resolverOuCriarContatoDedup };