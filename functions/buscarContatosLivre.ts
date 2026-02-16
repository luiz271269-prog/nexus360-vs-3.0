import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🌍 BUSCA GLOBAL DE CONTATOS - SEM FILTROS DE PERMISSÃO
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * CONTRATO ARQUITETURAL:
 * 1. Esta função SEMPRE retorna contatos de forma LIVRE (asServiceRole)
 * 2. NÃO aplica filtros de setor, integração, owner, fidelização
 * 3. NÃO respeita RLS (Row Level Security)
 * 4. Objetivo: encontrar contato canônico por nome/telefone/empresa
 * 
 * RESPONSABILIDADE DE PERMISSÕES:
 * - Frontend: mostra contato na lista (SEMPRE)
 * - Camada de Threads: aplica permissões ao tentar abrir/enviar (canUserSeeThreadBase)
 * 
 * ⚠️ NUNCA adicionar filtros de permissão nesta função!
 * ═══════════════════════════════════════════════════════════════════════
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (req.method === 'GET') {
    return Response.json({ 
      status: 'ok',
      description: 'Busca GLOBAL livre de contatos (ignora RLS, sem filtros de permissão)'
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchTerm, limit = 200 } = await req.json();
    
    // 🔍 LOG CIRÚRGICO: Identificar quem está chamando
    console.log('[buscarContatosLivre] 📞 CHAMADA RECEBIDA:', {
      user_id: user.id?.substring(0, 8),
      user_email: user.email,
      user_role: user.role,
      searchTerm: searchTerm || '(vazio)',
      limit,
      timestamp: new Date().toISOString()
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 🌍 BUSCA SEMPRE GLOBAL - SEM FILTROS DE PERMISSÃO
    // ═══════════════════════════════════════════════════════════════════════
    let contatos = [];
    
    if (!searchTerm || !searchTerm.trim()) {
      // ✅ MODO HIDRATAÇÃO (sem busca): Retornar todos com filtro de qualidade
      console.log(`[buscarContatosLivre] 📦 MODO HIDRATAÇÃO (sem searchTerm) - limit: ${limit}`);
      contatos = await base44.asServiceRole.entities.Contact.list('-ultima_interacao', limit);
      console.log(`[buscarContatosLivre] ✅ Contatos carregados (ANTES filtro qualidade): ${contatos.length}`);
    } else {
      // ✅ MODO BUSCA TEXTUAL
      const termo = searchTerm.trim().toLowerCase();
      const termoNumeros = termo.replace(/\D/g, '');
      
      console.log(`[buscarContatosLivre] 🔍 Termo normalizado: "${termo}" | Números: "${termoNumeros}"`);
      
      // ✅ ESTRATÉGIA 1: BUSCA POR TELEFONE - Usar 6 variações (igual getOrCreateContactCentralized)
      if (termoNumeros.length >= 8) {
        // Gerar variações de telefone (com/sem +, com/sem 9, etc)
        const gerarVariacoes = (tel) => {
          const telLimpo = tel.replace(/\D/g, '');
          const variacoes = new Set();
          
          // Adicionar 55 se não tiver
          let telBase = telLimpo;
          if (!telBase.startsWith('55') && (telBase.length === 10 || telBase.length === 11)) {
            telBase = '55' + telBase;
          }
          
          // Adicionar 9 se for celular e tiver 12 dígitos
          if (telBase.startsWith('55') && telBase.length === 12) {
            const ddd = telBase.substring(2, 4);
            const numero = telBase.substring(4);
            if (['6', '7', '8', '9'].includes(numero[0])) {
              telBase = '55' + ddd + '9' + numero;
            }
          }
          
          // Gerar 6 variações
          variacoes.add('+' + telBase);
          variacoes.add(telBase);
          
          // Com/sem 9
          if (telBase.length === 13 && telBase.startsWith('55')) {
            const semNono = telBase.substring(0, 4) + telBase.substring(5);
            variacoes.add('+' + semNono);
            variacoes.add(semNono);
          }
          if (telBase.length === 12 && telBase.startsWith('55')) {
            const comNono = telBase.substring(0, 4) + '9' + telBase.substring(4);
            variacoes.add('+' + comNono);
            variacoes.add(comNono);
          }
          
          return Array.from(variacoes);
        };
        
        const variacoes = gerarVariacoes(termoNumeros);
        console.log(`[buscarContatosLivre] 📞 Buscando ${variacoes.length} variações de telefone:`, variacoes);
        
        // Buscar por cada variação (early return quando encontrar)
        for (const variacao of variacoes) {
          const resultado = await base44.asServiceRole.entities.Contact.filter(
            { telefone: variacao },
            '-ultima_interacao',
            10
          );
          
          if (resultado.length > 0) {
            console.log(`[buscarContatosLivre] ✅ Encontrou ${resultado.length} com variação: "${variacao}"`);
            contatos = resultado;
            break;
          }
        }
      }
      
        // ✅ ESTRATÉGIA 2: Se não achou por telefone, buscar por NOME/EMPRESA/CARGO
        if (contatos.length === 0) {
          const todosBD = await base44.asServiceRole.entities.Contact.list('-ultima_interacao', 1000);
          
          // Filtro local por texto
          contatos = todosBD.filter(c => {
            const nome = (c.nome || '').toLowerCase();
            const empresa = (c.empresa || '').toLowerCase();
            const cargo = (c.cargo || '').toLowerCase();
            const observacoes = (c.observacoes || '').toLowerCase();
            const telefone = (c.telefone || '').replace(/\D/g, '');
            
            // Match de texto OU telefone parcial
            const matchTexto = nome.includes(termo) || 
                               empresa.includes(termo) || 
                               cargo.includes(termo) ||
                               observacoes.includes(termo);
            
            const matchTelefone = termoNumeros.length >= 4 && telefone.includes(termoNumeros);
            
            return matchTexto || matchTelefone;
          }).slice(0, 100);
          
          console.log(`[buscarContatosLivre] ✅ Busca texto retornou ${contatos.length} resultados`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 DEDUPLICAÇÃO POR TELEFONE CANÔNICO (mantém TODOS os contatos, mesmo vazios)
    // ⚠️ CRÍTICO: Backend NÃO deve filtrar por qualidade - isso é papel do frontend
    // ═══════════════════════════════════════════════════════════════════════
    const contatosPorTelefone = new Map();
    const contatosSemTelefone = [];
    
    // ✅ MARCAR qualidade para frontend decidir (sem excluir)
    const contatosComMetadata = contatos.map(c => {
      const nome = (c.nome || '').trim();
      const telefone = (c.telefone || '').replace(/\D/g, '');
      const temDados = (
        (nome && nome !== c.telefone && nome !== '+' + telefone) ||
        c.empresa || 
        c.cargo || 
        c.email
      );
      
      return {
        ...c,
        _meta: {
          tem_dados_basicos: temDados,
          score_completude: (
            (nome && nome !== c.telefone ? 10 : 0) +
            (c.empresa ? 5 : 0) +
            (c.cargo ? 3 : 0) +
            (c.email ? 2 : 0)
          )
        }
      };
    });
    
    contatosComMetadata.forEach(c => {
      const telCanon = c.telefone_canonico || (c.telefone || '').replace(/\D/g, '');
      
      if (!telCanon) {
        contatosSemTelefone.push(c);
        return;
      }
      
      const existente = contatosPorTelefone.get(telCanon);
      if (!existente) {
        contatosPorTelefone.set(telCanon, c);
      } else {
        // Manter o mais completo (com mais dados)
        const scoreExistente = (existente.nome !== existente.telefone ? 10 : 0) + 
                               (existente.empresa ? 5 : 0) + 
                               (existente.cargo ? 3 : 0) + 
                               (existente.email ? 2 : 0);
        const scoreAtual = (c.nome !== c.telefone ? 10 : 0) + 
                           (c.empresa ? 5 : 0) + 
                           (c.cargo ? 3 : 0) + 
                           (c.email ? 2 : 0);
        
        if (scoreAtual > scoreExistente) {
          contatosPorTelefone.set(telCanon, c);
        } else if (scoreAtual === scoreExistente) {
          // Mesmo score: manter o mais recente
          const tsExistente = new Date(existente.ultima_interacao || existente.updated_date || 0).getTime();
          const tsAtual = new Date(c.ultima_interacao || c.updated_date || 0).getTime();
          if (tsAtual > tsExistente) {
            contatosPorTelefone.set(telCanon, c);
          }
        }
      }
    });
    
    const contatosDeduplicated = [...contatosPorTelefone.values(), ...contatosSemTelefone];

    // ✅ ORDENAR: Contatos completos primeiro, vazios depois (priorização, NÃO exclusão)
    const contatosOrdenados = contatosDeduplicated.sort((a, b) => {
      const scoreA = a._meta?.score_completude || 0;
      const scoreB = b._meta?.score_completude || 0;
      
      // Contatos mais completos primeiro
      if (scoreB !== scoreA) return scoreB - scoreA;
      
      // Mesmo score: mais recente primeiro
      const tsA = new Date(a.ultima_interacao || a.updated_date || 0).getTime();
      const tsB = new Date(b.ultima_interacao || b.updated_date || 0).getTime();
      return tsB - tsA;
    });

    // 🔍 LOG CIRÚRGICO: Resultado final (SEM FILTROS DE PERMISSÃO/QUALIDADE)
    const contatosVazios = contatosOrdenados.filter(c => !c._meta?.tem_dados_basicos);
    console.log('[buscarContatosLivre] 📊 RETORNANDO (GLOBAL - sem filtros):', {
      user_email: user.email,
      user_role: user.role,
      total_antes_dedup: contatos.length,
      total_depois_dedup: contatosOrdenados.length,
      duplicatas_removidas: contatos.length - contatosOrdenados.length,
      contatos_vazios: contatosVazios.length,
      contatos_completos: contatosOrdenados.length - contatosVazios.length,
      primeiros_3: contatosOrdenados.slice(0, 3).map(c => ({
        id: c.id?.substring(0, 8),
        nome: c.nome,
        telefone: c.telefone,
        completude: c._meta?.score_completude || 0,
        tem_dados: c._meta?.tem_dados_basicos
      })),
      WARNING: '⚠️ NENHUM filtro de permissão/qualidade aplicado - INTENCIONAL (apenas ordenação)'
    });

    return Response.json({ 
      success: true,
      contatos: contatosDeduplicated,
      total: contatosDeduplicated.length,
      user_id: user.id,
      _meta: {
        searchTerm: searchTerm || null,
        aplicou_filtro_permissao: false, // ✅ CONTRATO: NUNCA filtrar por permissão
        deduplicated: contatosDeduplicated.length < contatos.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[buscarContatosLivre] ❌ ERRO:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});