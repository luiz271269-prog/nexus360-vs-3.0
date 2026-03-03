// redeploy: 2026-03-03T14:40
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// FUNÇÃO CENTRALIZADORA ÚNICA - CONTATO (ANTI-DUPLICAÇÃO)
// ============================================================================
const VERSION = 'v1.0.0-CENTRALIZED-CONTACT';

// --- Inline: phone utils (NO local imports in Deno Edge) ---
function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let n = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!n || n.length < 10) return null;
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

function gerarVariacoesTelefone(telefoneNormalizado) {
  if (!telefoneNormalizado) return [];
  const base = telefoneNormalizado.replace(/\D/g, '');
  const variacoes = new Set([telefoneNormalizado, base]);
  if (base.startsWith('55')) {
    if (base.length === 13) {
      const sem9 = base.substring(0, 4) + base.substring(5);
      variacoes.add('+' + sem9);
      variacoes.add(sem9);
    }
    if (base.length === 12) {
      const com9 = base.substring(0, 4) + '9' + base.substring(4);
      variacoes.add('+' + com9);
      variacoes.add(com9);
    }
    variacoes.add('+55' + base.substring(2));
  }
  return [...variacoes];
}
// --- End inline ---

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
    base44 = createClientFromRequest(req.clone());
  } catch (e) {
    console.error('[CENTRALIZED-CONTACT] ❌ Erro ao criar cliente SDK:', e.message);
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

  console.log(`[${VERSION}] 📞 Buscando/criando contato para: ${telefone}`);

  // NORMALIZAÇÃO ÚNICA
  const telefoneNormalizado = normalizarTelefone(telefone);
  
  if (!telefoneNormalizado) {
    return Response.json({ success: false, error: 'telefone_invalido' }, { status: 400 });
  }

  // GERAR 6 VARIAÇÕES
  const variacoes = gerarVariacoesTelefone(telefoneNormalizado);
  console.log(`[${VERSION}] 🔍 Buscando com ${variacoes.length} variações`);

  // BUSCA SEQUENCIAL (early return quando encontrar)
  let contatoExistente = null;
  
  try {
    for (const variacao of variacoes) {
      if (contatoExistente) break;
      
      console.log(`[${VERSION}] 🔍 Testando variação ${variacoes.indexOf(variacao) + 1}/${variacoes.length}: "${variacao}"`);
      
      try {
        const resultado = await base44.asServiceRole.entities.Contact.filter(
          { telefone: variacao },
          '-created_date',
          1
        );
        
        console.log(`[${VERSION}] 📊 Query retornou: ${resultado?.length || 0} resultado(s)`);
        
        if (resultado && resultado.length > 0) {
          contatoExistente = resultado[0];
          console.log(`[${VERSION}] ✅ ENCONTRADO! ID: ${contatoExistente.id} | Nome: ${contatoExistente.nome} | Tel DB: "${contatoExistente.telefone}"`);
          break;
        } else {
          console.log(`[${VERSION}] ⏭️ Variação "${variacao}" → Nenhum resultado`);
        }
      } catch (searchErr) {
        console.error(`[${VERSION}] ❌ ERRO CRÍTICO ao buscar "${variacao}":`, searchErr.message);
        console.error(`[${VERSION}] ❌ Stack:`, searchErr.stack);
      }
    }
    
    if (!contatoExistente) {
      console.log(`[${VERSION}] ⚠️ NENHUMA VARIAÇÃO ENCONTRADA após ${variacoes.length} tentativas`);
      console.log(`[${VERSION}] 🆕 Criando NOVO contato com telefone: "${telefoneNormalizado}"`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro geral na busca:`, e.message);
    return Response.json({ success: false, error: 'search_error' }, { status: 500 });
  }

  // CONTATO EXISTENTE - ATUALIZAR
  if (contatoExistente) {
    try {
      const agora = new Date().toISOString();
      const update = { ultima_interacao: agora };
      
      // Atualizar nome se veio pushName e (não tem nome OU nome é o telefone)
      if (pushName && (!contatoExistente.nome || contatoExistente.nome === contatoExistente.telefone)) {
        update.nome = pushName;
      }
      
      // Atualizar foto se mudou
      if (profilePicUrl && contatoExistente.foto_perfil_url !== profilePicUrl) {
        update.foto_perfil_url = profilePicUrl;
        update.foto_perfil_atualizada_em = agora;
      }
      
      // Atualizar conexão se veio
      if (conexaoId && !contatoExistente.conexao_origem) {
        update.conexao_origem = conexaoId;
      }
      
      await base44.asServiceRole.entities.Contact.update(contatoExistente.id, update);
      
      console.log(`[${VERSION}] 🔄 Contato atualizado: ${contatoExistente.id}`);
      
      return Response.json({
        success: true,
        contact: contatoExistente,
        action: 'updated'
      });
      
    } catch (updateErr) {
      console.error(`[${VERSION}] ❌ Erro ao atualizar contato:`, updateErr.message);
      // Continua e retorna o contato mesmo sem update
      return Response.json({
        success: true,
        contact: contatoExistente,
        action: 'found'
      });
    }
  }

  // CONTATO NOVO - CRIAR
  try {
    const novoContato = await base44.asServiceRole.entities.Contact.create({
      nome: pushName || telefoneNormalizado,
      telefone: telefoneNormalizado,
      tipo_contato: 'lead',
      whatsapp_status: 'verificado',
      conexao_origem: conexaoId || null,
      foto_perfil_url: profilePicUrl || null,
      foto_perfil_atualizada_em: profilePicUrl ? new Date().toISOString() : null,
      ultima_interacao: new Date().toISOString()
    });
    
    console.log(`[${VERSION}] 🆕 Novo contato criado: ${novoContato.id} | ${novoContato.nome}`);
    
    return Response.json({
      success: true,
      contact: novoContato,
      action: 'created'
    });
    
  } catch (createErr) {
    console.error(`[${VERSION}] ❌ Erro ao criar contato:`, createErr.message);
    return Response.json({ 
      success: false, 
      error: 'create_error',
      details: createErr.message 
    }, { status: 500 });
  }
});