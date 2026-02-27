import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { normalizarTelefone, gerarVariacoesTelefone } from './lib/phoneNormalizer.js';

// ============================================================================
// FUNÇÃO CENTRALIZADORA ÚNICA - CONTATO (ANTI-DUPLICAÇÃO)
// ============================================================================
// ✅ REGRA ABSOLUTA: Esta é a ÚNICA forma de criar/buscar contatos no sistema
// ✅ Garante 6 variações de telefone para busca universal
// ✅ Normalização única e consistente
// ============================================================================

const VERSION = 'v1.0.0-CENTRALIZED-CONTACT';

// ============================================================================
// FUNÇÃO PADRONIZADA DE NORMALIZAÇÃO (IDÊNTICA EM TODOS OS WEBHOOKS)
// ============================================================================
function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let numeroLimpo = String(telefone).split('@')[0];
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  
  // Adicionar código do país se não tiver
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  
  // ===== NORMALIZAR CELULARES BRASILEIROS (adicionar 9) =====
  // Formato esperado: 55 + DDD(2) + 9 + número(8) = 13 dígitos
  // Se veio 55 + DDD(2) + número(8) = 12 dígitos, verifica se é celular e adiciona o 9
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const ddd = apenasNumeros.substring(2, 4);
    const numero = apenasNumeros.substring(4);
    
    // ✅ CORREÇÃO CRÍTICA: Verificar se é celular (começa com 6, 7, 8 ou 9)
    // Telefones fixos (2, 3, 4, 5) NÃO recebem o dígito 9
    if (['6', '7', '8', '9'].includes(numero[0])) {
      apenasNumeros = '55' + ddd + '9' + numero;
      console.log(`[CENTRALIZED] ✅ Celular detectado - adicionado dígito 9: ${apenasNumeros}`);
    } else {
      console.log(`[CENTRALIZED] ℹ️ Telefone fixo detectado (${numero[0]}) - mantendo formato original`);
    }
  }
  
  // Validação final de tamanho
  if (apenasNumeros.startsWith('55') && apenasNumeros.length !== 13 && apenasNumeros.length !== 12) {
    console.warn(`[CENTRALIZED] ⚠️ Tamanho inesperado após normalização: ${apenasNumeros} (len: ${apenasNumeros.length})`);
  }
  
  return '+' + apenasNumeros;
}

function gerarVariacoesTelefone(telefoneNormalizado) {
  const telefoneBase = telefoneNormalizado.replace(/\D/g, '');
  const variacoes = [
    telefoneNormalizado,
    telefoneBase,
  ];
  
  // Se tem 13 dígitos (55+DDD+9+8), adicionar versão sem o 9
  if (telefoneBase.length === 13 && telefoneBase.startsWith('55')) {
    const semNono = telefoneBase.substring(0, 4) + telefoneBase.substring(5);
    variacoes.push('+' + semNono);
    variacoes.push(semNono);
  }
  
  // Se tem 12 dígitos (55+DDD+8), adicionar versão com o 9
  if (telefoneBase.length === 12 && telefoneBase.startsWith('55')) {
    const comNono = telefoneBase.substring(0, 4) + '9' + telefoneBase.substring(4);
    variacoes.push('+' + comNono);
    variacoes.push(comNono);
  }
  
  // Variação +55 explícita
  if (telefoneBase.startsWith('55')) {
    variacoes.push('+55' + telefoneBase.substring(2));
  }
  
  return [...new Set(variacoes)]; // Remove duplicatas
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