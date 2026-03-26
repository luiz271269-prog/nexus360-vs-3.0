// redeploy: 2026-03-26T17:50-SIMPLIFÍCADO
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// FUNÇÃO CENTRALIZADORA ÚNICA - CONTATO (ANTI-DUPLICAÇÃO)
// v3.2.0-SIMPLIFICADO - Remove mecanismos não-funcionais em Deno Deploy
// ✅ Retry 429 + busca variações + anti-race pós-create com merge
// ❌ Sem lock em memória (não funciona entre instâncias isoladas)
// ============================================================================
const VERSION = 'v3.2.0-SIMPLIFIED';

// Retry com backoff exponencial para 429
async function retryOn429(fn, maxTentativas = 3, delayBase = 500) {
  let lastError;
  for (let i = 0; i < maxTentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const is429 = e?.message?.includes('429') || 
                    e?.message?.includes('Rate limit') || 
                    e?.message?.includes('Limite de taxa');
      if (is429 && i < maxTentativas - 1) {
        const delay = delayBase * Math.pow(2, i);
        console.warn(`[${VERSION}] 429 na busca, aguardando ${delay}ms (tentativa ${i+1})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let n = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!n || n.length < 8) return null;
  n = n.replace(/^0+/, '');
  if (!n.startsWith('55')) {
    if (n.length === 10 || n.length === 11) n = '55' + n;
  }
  if (n.startsWith('55') && n.length === 12) {
    const d = n[4];
    if (['6','7','8','9'].includes(d)) n = n.substring(0, 4) + '9' + n.substring(4);
  }
  return '+' + n;
}

function extrairCanonicopTeléfone(telefoneNormalizado) {
  if (!telefoneNormalizado) return null;
  return telefoneNormalizado.replace(/\D/g, '');
}

function gerarVariacoes(telefoneNormalizado) {
  if (!telefoneNormalizado) return [];
  const base = telefoneNormalizado.replace(/\D/g, '');
  const variacoes = new Set();

  variacoes.add('+' + base);
  variacoes.add(base);

  if (base.startsWith('55')) {
    const semPais = base.substring(2);
    variacoes.add(semPais);
    variacoes.add('+55' + semPais);

    if (base.length === 13) {
      const semPaisSem9 = semPais.substring(0, 2) + semPais.substring(3);
      const sem9 = '55' + semPaisSem9;
      variacoes.add('+' + sem9);
      variacoes.add(sem9);
      variacoes.add(semPaisSem9);
    }

    if (base.length === 12) {
      const semPaisCom9 = semPais.substring(0, 2) + '9' + semPais.substring(2);
      const com9 = '55' + semPaisCom9;
      variacoes.add('+' + com9);
      variacoes.add(com9);
      variacoes.add(semPaisCom9);
    }
  }

  return [...variacoes];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' }
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
    if (!base44.asServiceRole) {
      throw new Error('asServiceRole não disponível');
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ SDK init error:`, e.message);
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  let payload;
  try {
    const body = await req.text();
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const { telefone, pushName, profilePicUrl, conexaoId, integracaoId } = payload;
  const conexaoFinal = conexaoId || integracaoId || null;

  if (!telefone) {
    return Response.json({ success: false, error: 'telefone_required' }, { status: 400 });
  }

  const telefoneNormalizado = normalizarTelefone(telefone);
  if (!telefoneNormalizado) {
    return Response.json({ success: false, error: 'telefone_invalido' }, { status: 400 });
  }

  const canonico = extrairCanonicopTeléfone(telefoneNormalizado);
  const variacoes = gerarVariacoes(telefoneNormalizado);

  console.log(`[${VERSION}] 📞 Buscando: ${telefoneNormalizado} | canonico: ${canonico}`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Buscar por telefone_canonico
  // ═══════════════════════════════════════════════════════════════
  let contatoEncontrado = null;
  try {
    const contatos = await retryOn429(() => 
      base44.asServiceRole.entities.Contact.filter(
        { telefone_canonico: canonico }, 'created_date', 1
      )
    );
    if (contatos && contatos.length > 0) {
      contatoEncontrado = contatos[0];
      console.log(`[${VERSION}] ✅ STEP 1: Encontrado por canonico: ${contatoEncontrado.id}`);
    }
  } catch (e) {
    const is429 = e?.message?.includes('429');
    if (is429) {
      console.error(`[${VERSION}] ❌ STEP 1 falhou com 429 após retries`);
      return Response.json({ success: false, error: 'rate_limit' }, { status: 429 });
    }
    console.warn(`[${VERSION}] ⚠️ STEP 1 erro (não-429):`, e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Se não encontrou, buscar por telefone normalizado
  // ═══════════════════════════════════════════════════════════════
  if (!contatoEncontrado) {
    try {
      const contatos = await retryOn429(() =>
        base44.asServiceRole.entities.Contact.filter(
          { telefone: telefoneNormalizado }, 'created_date', 1
        )
      );
      if (contatos && contatos.length > 0) {
        contatoEncontrado = contatos[0];
        console.log(`[${VERSION}] ✅ STEP 2: Encontrado por telefone: ${contatoEncontrado.id}`);
      }
    } catch (e) {
      const is429 = e?.message?.includes('429');
      if (is429) {
        console.error(`[${VERSION}] ❌ STEP 2 falhou com 429 após retries`);
        return Response.json({ success: false, error: 'rate_limit' }, { status: 429 });
      }
      console.warn(`[${VERSION}] ⚠️ STEP 2 erro (não-429):`, e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Se ainda não encontrou, buscar por variações
  // ═══════════════════════════════════════════════════════════════
  if (!contatoEncontrado) {
    for (const variacao of variacoes) {
      if (variacao === telefoneNormalizado || variacao === canonico) continue;
      
      for (const campo of ['telefone_canonico', 'telefone']) {
        try {
          const contatos = await retryOn429(() =>
            base44.asServiceRole.entities.Contact.filter(
              { [campo]: variacao }, 'created_date', 1
            )
          );
          if (contatos && contatos.length > 0) {
            contatoEncontrado = contatos[0];
            console.log(`[${VERSION}] ✅ STEP 3: Encontrado por variação ${variacao}: ${contatoEncontrado.id}`);
            break;
          }
        } catch (e) {
          const is429 = e?.message?.includes('429');
          if (is429) {
            console.error(`[${VERSION}] ❌ STEP 3 falhou com 429 após retries`);
            return Response.json({ success: false, error: 'rate_limit' }, { status: 429 });
          }
        }
      }
      
      if (contatoEncontrado) break;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTATO ENCONTRADO: Atualizar
  // ═══════════════════════════════════════════════════════════════
  if (contatoEncontrado) {
    try {
      const agora = new Date().toISOString();
      const update = { ultima_interacao: agora };

      if (pushName && (!contatoEncontrado.nome || contatoEncontrado.nome === contatoEncontrado.telefone)) {
        update.nome = pushName;
      }
      if (profilePicUrl && contatoEncontrado.foto_perfil_url !== profilePicUrl) {
        update.foto_perfil_url = profilePicUrl;
        update.foto_perfil_atualizada_em = agora;
      }
      if (conexaoFinal && !contatoEncontrado.conexao_origem) {
        update.conexao_origem = conexaoFinal;
      }
      // Garantir que telefone_canonico está correto
      if (contatoEncontrado.telefone_canonico !== canonico) {
        update.telefone_canonico = canonico;
      }
      if (contatoEncontrado.telefone !== telefoneNormalizado) {
        update.telefone = telefoneNormalizado;
      }

      await base44.asServiceRole.entities.Contact.update(contatoEncontrado.id, update);
      console.log(`[${VERSION}] 🔄 Contato atualizado: ${contatoEncontrado.id}`);
      
      return Response.json({ success: true, contact: contatoEncontrado, action: 'updated' });
    } catch (e) {
      console.error(`[${VERSION}] ❌ Erro ao atualizar:`, e.message);
      return Response.json({ success: true, contact: contatoEncontrado, action: 'found_but_update_failed' });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTATO NÃO ENCONTRADO: Criar novo
  // ═══════════════════════════════════════════════════════════════
  try {
    const novoContato = await base44.asServiceRole.entities.Contact.create({
      nome: (pushName && pushName.trim().length > 2 && pushName !== telefoneNormalizado)
        ? pushName.trim()
        : `Contato ${telefoneNormalizado.slice(-8)}`,
      telefone: telefoneNormalizado,
      telefone_canonico: canonico,
      tipo_contato: 'lead',
      cliente_id: null,
      empresa: null,
      whatsapp_status: 'verificado',
      conexao_origem: conexaoFinal || null,
      foto_perfil_url: profilePicUrl || null,
      foto_perfil_atualizada_em: profilePicUrl ? new Date().toISOString() : null,
      ultima_interacao: new Date().toISOString()
    });

    console.log(`[${VERSION}] 🆕 Novo contato criado: ${novoContato.id} | ${novoContato.nome}`);

    // ═══════════════════════════════════════════════════════════════
    // ANTI-RACE PÓS-CREATE: se alguém criou antes, fazer merge
    // ═══════════════════════════════════════════════════════════════
    try {
      const recheck = await base44.asServiceRole.entities.Contact.filter(
        { telefone_canonico: canonico }, 'created_date', 2
      );
      
      if (recheck && recheck.length > 1) {
        const maisAntigo = recheck[0];
        
        // Se o novo que acabamos de criar NÃO é o mais antigo
        if (maisAntigo.id !== novoContato.id) {
          console.warn(`[${VERSION}] 🔄 ANTI-RACE: Detectado outro contato mais antigo. Fazendo merge...`);
          
          // Merge: preencher campos vazios do antigo com dados do novo
          const mergeData = {};
          const camposPrioritarios = [
            'nome', 'empresa', 'email', 'cargo', 'tipo_contato',
            'vendedor_responsavel', 'cliente_id', 'ramo_atividade',
            'instagram_id', 'facebook_id'
          ];
          
          const vazio = (v) => v === null || v === undefined || v === '';
          
          for (const campo of camposPrioritarios) {
            if (vazio(maisAntigo[campo]) && !vazio(novoContato[campo])) {
              mergeData[campo] = novoContato[campo];
            }
          }
          
          // Booleanos: true prevalece
          const camposBoolean = ['is_cliente_fidelizado', 'is_vip', 'is_prioridade'];
          for (const campo of camposBoolean) {
            if (!maisAntigo[campo] && novoContato[campo] === true) {
              mergeData[campo] = true;
            }
          }
          
          // Tags: union
          const tagsUnificadas = [...(maisAntigo.tags || [])];
          if (Array.isArray(novoContato.tags)) {
            for (const tag of novoContato.tags) {
              if (!tagsUnificadas.includes(tag)) {
                tagsUnificadas.push(tag);
              }
            }
          }
          if (tagsUnificadas.length > (maisAntigo.tags || []).length) {
            mergeData.tags = tagsUnificadas;
          }
          
          // Garantir que telefone_canonico está correto
          mergeData.telefone_canonico = canonico;
          mergeData.telefone = telefoneNormalizado;
          
          // Salvar merge no mais antigo
          if (Object.keys(mergeData).length > 0) {
            await base44.asServiceRole.entities.Contact.update(maisAntigo.id, mergeData);
            console.log(`[${VERSION}] 💾 Merge salvo no contato antigo: ${maisAntigo.id}`);
          }
          
          // Deletar o novo
          await base44.asServiceRole.entities.Contact.delete(novoContato.id);
          console.log(`[${VERSION}] 🗑️ Novo contato deletado (race condition): ${novoContato.id}`);
          
          return Response.json({ success: true, contact: maisAntigo, action: 'deduplicated' });
        }
      }
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ Erro no anti-race pós-create:`, e.message);
      // Continua mesmo com erro no anti-race
    }

    return Response.json({ success: true, contact: novoContato, action: 'created' });

  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro ao criar contato:`, e.message);
    return Response.json({ success: false, error: 'create_error', details: e.message }, { status: 500 });
  }
});