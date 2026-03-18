// redeploy: 2026-03-18T00:00
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// FUNÇÃO CENTRALIZADORA ÚNICA - CONTATO (ANTI-DUPLICAÇÃO)
// v2.0.0 - Busca canônica primeiro, depois variações em 1 query só
// ============================================================================
const VERSION = 'v2.0.0-CANONICAL-FIRST';

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

// ═══════════════════════════════════════════════════════════════
// Extrai o valor CANONICO (apenas dígitos) do telefone normalizado
// ═══════════════════════════════════════════════════════════════
function extrairCanonicopTeléfone(telefoneNormalizado) {
  if (!telefoneNormalizado) return null;
  return telefoneNormalizado.replace(/\D/g, '');
}

// Gera TODAS as variações canônicas possíveis de um número
// para busca tolerante a formatos legados no banco
function gerarVariacoes(telefoneNormalizado) {
  if (!telefoneNormalizado) return [];
  const base = telefoneNormalizado.replace(/\D/g, ''); // ex: 5548988634900 (13 digits)
  const variacoes = new Set();

  // Com e sem +
  variacoes.add('+' + base);
  variacoes.add(base);

  if (base.startsWith('55')) {
    const semPais = base.substring(2);  // ex: 48988634900 (11 digits, DDD+número)
    variacoes.add(semPais);
    variacoes.add('+55' + semPais);

    // Com 13 dígitos (tem 9 após DDD): adicionar versão sem o 9 (12 dígitos)
    // Formato: 55 + DD(2) + 9 + número(8) = 13 dígitos
    // O nono dígito fica na posição 4 (índice 4), APÓS os 2 dígitos de DDD
    if (base.length === 13) {
      // semPais tem 11 dígitos: DD(2) + 9 + número(8)
      // Remover o 9 da posição 2 de semPais (= posição 4 de base)
      const semPaisSem9 = semPais.substring(0, 2) + semPais.substring(3); // DD + número(8) = 10 dígitos
      const sem9 = '55' + semPaisSem9; // 5500000000 (12 dígitos)
      variacoes.add('+' + sem9);
      variacoes.add(sem9);
      variacoes.add(semPaisSem9); // sem país sem 9: 10 dígitos
    }

    // Com 12 dígitos (sem 9 após DDD): adicionar versão com o 9 (13 dígitos)
    // Formato: 55 + DD(2) + número(8) = 12 dígitos
    if (base.length === 12) {
      // semPais tem 10 dígitos: DD(2) + número(8)
      // Inserir 9 após os 2 dígitos de DDD (posição 2 de semPais = posição 4 de base)
      const semPaisCom9 = semPais.substring(0, 2) + '9' + semPais.substring(2); // DD + 9 + número(8) = 11 dígitos
      const com9 = '55' + semPaisCom9; // 13 dígitos
      variacoes.add('+' + com9);
      variacoes.add(com9);
      variacoes.add(semPaisCom9); // sem país com 9: 11 dígitos
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
    // ✅ FIX 2026-03-18: Usar asServiceRole direto — esta função é sempre chamada
    // via invoke() interno (webhookWapi, webhookFinalZapi, etc.) sem token de usuário.
    // createClientFromRequest com req interno causa 403 "app privado".
    base44 = createClientFromRequest(req);
    // Garantir que asServiceRole está disponível independente do token do req
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

  const { telefone, pushName, profilePicUrl, conexaoId } = payload;

  if (!telefone) {
    return Response.json({ success: false, error: 'telefone_required' }, { status: 400 });
  }

  const telefoneNormalizado = normalizarTelefone(telefone);
  if (!telefoneNormalizado) {
    return Response.json({ success: false, error: 'telefone_invalido' }, { status: 400 });
  }

  const canonico = extrairCanonicopTeléfone(telefoneNormalizado);
  const variacoes = gerarVariacoes(telefoneNormalizado);

  console.log(`[${VERSION}] 📞 Buscando: ${telefoneNormalizado} | canonico: ${canonico} | variações: ${variacoes.length}`);

  let contatoExistente = null;

  try {
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Busca pelo canonico (campo telefone_canonico)
    // Campo sempre em dígitos puros — mais confiável para novos contatos
    // ═══════════════════════════════════════════════════════════════
    try {
      const r1 = await base44.asServiceRole.entities.Contact.filter(
        { telefone_canonico: canonico },
        '-created_date',
        1
      );
      if (r1 && r1.length > 0) {
        contatoExistente = r1[0];
        console.log(`[${VERSION}] ✅ ENCONTRADO por telefone_canonico="${canonico}" | ID: ${contatoExistente.id} | Nome: ${contatoExistente.nome}`);
      }
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ Erro busca telefone_canonico:`, e.message);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Busca por telefone (campo normalizado com +)
    // Cobre contatos legados que não têm telefone_canonico populado
    // ═══════════════════════════════════════════════════════════════
    if (!contatoExistente) {
      try {
        const r2 = await base44.asServiceRole.entities.Contact.filter(
          { telefone: telefoneNormalizado },
          '-created_date',
          1
        );
        if (r2 && r2.length > 0) {
          contatoExistente = r2[0];
          console.log(`[${VERSION}] ✅ ENCONTRADO por telefone="${telefoneNormalizado}" | ID: ${contatoExistente.id} | Nome: ${contatoExistente.nome}`);
        }
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Erro busca telefone:`, e.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Busca tolerante — variações sem o 9 e sem código de país
    // Cobre contatos salvos em formatos antigos (legado pré-normalização)
    // ═══════════════════════════════════════════════════════════════
    if (!contatoExistente) {
      for (const variacao of variacoes) {
        if (contatoExistente) break;
        if (variacao === telefoneNormalizado || variacao === canonico) continue; // já testado

        for (const campo of ['telefone', 'telefone_canonico']) {
          try {
            const r = await base44.asServiceRole.entities.Contact.filter(
              { [campo]: variacao },
              '-created_date',
              1
            );
            if (r && r.length > 0) {
              contatoExistente = r[0];
              console.log(`[${VERSION}] ✅ ENCONTRADO (legado) por ${campo}="${variacao}" | ID: ${contatoExistente.id}`);
              break;
            }
          } catch (e) {
            // silencioso — continua próxima variação
          }
        }
      }
    }

    // Normalizar telefone do contato encontrado se estiver desatualizado
    if (contatoExistente) {
      const precisaNormalizar = contatoExistente.telefone !== telefoneNormalizado ||
                                 contatoExistente.telefone_canonico !== canonico;
      if (precisaNormalizar) {
        try {
          await base44.asServiceRole.entities.Contact.update(contatoExistente.id, {
            telefone: telefoneNormalizado,
            telefone_canonico: canonico
          });
          contatoExistente.telefone = telefoneNormalizado;
          contatoExistente.telefone_canonico = canonico;
          console.log(`[${VERSION}] 🔧 Telefone normalizado para: ${telefoneNormalizado}`);
        } catch (e) {
          console.warn(`[${VERSION}] ⚠️ Erro ao normalizar telefone:`, e.message);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Sem contato por telefone → tentar match por empresa (pushName)
    // Vincula novo número à empresa existente no CRM
    // ═══════════════════════════════════════════════════════════════
    if (!contatoExistente && pushName) {
      try {
        const primeiraPalavra = pushName.split(' ')[0];
        const clientesMatch = await base44.asServiceRole.entities.Cliente.filter(
          { razao_social: { $regex: primeiraPalavra } },
          '-created_date',
          1
        );
        if (clientesMatch && clientesMatch.length > 0) {
          payload._clienteParaVincular = clientesMatch[0];
          console.log(`[${VERSION}] 🏢 Match por empresa: "${clientesMatch[0].razao_social}" → novo contato será vinculado`);
        }
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Erro busca por empresa:`, e.message);
      }
    }

    if (!contatoExistente) {
      console.log(`[${VERSION}] 🆕 Não encontrado. Criando novo contato para: ${telefoneNormalizado}`);
    }

  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro geral na busca:`, e.message);
    return Response.json({ success: false, error: 'search_error' }, { status: 500 });
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTATO EXISTENTE — ATUALIZAR
  // ═══════════════════════════════════════════════════════════════
  if (contatoExistente) {
    try {
      const agora = new Date().toISOString();
      const update = { ultima_interacao: agora };

      if (pushName && (!contatoExistente.nome || contatoExistente.nome === contatoExistente.telefone)) {
        update.nome = pushName;
      }
      if (profilePicUrl && contatoExistente.foto_perfil_url !== profilePicUrl) {
        update.foto_perfil_url = profilePicUrl;
        update.foto_perfil_atualizada_em = agora;
      }
      if (conexaoId && !contatoExistente.conexao_origem) {
        update.conexao_origem = conexaoId;
      }

      await base44.asServiceRole.entities.Contact.update(contatoExistente.id, update);
      console.log(`[${VERSION}] 🔄 Contato atualizado: ${contatoExistente.id}`);

      return Response.json({ success: true, contact: contatoExistente, action: 'updated' });
    } catch (e) {
      console.error(`[${VERSION}] ❌ Erro ao atualizar:`, e.message);
      return Response.json({ success: true, contact: contatoExistente, action: 'found' });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CONTATO NOVO — CRIAR
  // ═══════════════════════════════════════════════════════════════
  try {
    const clienteVincular = payload._clienteParaVincular || null;

    const novoContato = await base44.asServiceRole.entities.Contact.create({
      nome: pushName || telefoneNormalizado,
      telefone: telefoneNormalizado,
      telefone_canonico: canonico,                                              // ← SEMPRE gravar
      tipo_contato: clienteVincular ? 'cliente' : 'lead',
      cliente_id: clienteVincular ? clienteVincular.id : null,
      empresa: clienteVincular ? (clienteVincular.nome_fantasia || clienteVincular.razao_social) : null,
      whatsapp_status: 'verificado',
      conexao_origem: conexaoId || null,
      foto_perfil_url: profilePicUrl || null,
      foto_perfil_atualizada_em: profilePicUrl ? new Date().toISOString() : null,
      ultima_interacao: new Date().toISOString()
    });

    console.log(`[${VERSION}] 🆕 Novo contato criado: ${novoContato.id} | ${novoContato.nome}${clienteVincular ? ' | vinculado a ' + clienteVincular.razao_social : ''}`);

    // ── ANTI-RACE: re-busca para garantir unicidade após create ──────────────
    // Se duas requisições simultâneas criaram o contato ao mesmo tempo,
    // mantemos o mais antigo e descartamos o recém-criado.
    try {
      const recheck = await base44.asServiceRole.entities.Contact.filter(
        { telefone_canonico: canonico },
        'created_date', // ASC — mais antigo primeiro
        2
      );
      if (recheck && recheck.length > 1) {
        const maisAntigo = recheck[0];
        if (maisAntigo.id !== novoContato.id) {
          await base44.asServiceRole.entities.Contact.delete(novoContato.id);
          console.log(`[${VERSION}] 🔀 Race condition: descartando ${novoContato.id}, usando canônico ${maisAntigo.id}`);
          return Response.json({ success: true, contact: maisAntigo, action: 'deduplicated' });
        }
      }
    } catch (e) {
      console.warn(`[${VERSION}] ⚠️ Erro no re-check anti-race:`, e.message);
    }

    return Response.json({ success: true, contact: novoContato, action: 'created' });

  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro ao criar contato:`, e.message);
    return Response.json({ success: false, error: 'create_error', details: e.message }, { status: 500 });
  }
});