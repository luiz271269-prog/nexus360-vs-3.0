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
    
    if (searchTerm && searchTerm.trim()) {
      const termo = searchTerm.trim().toLowerCase();
      const termoNumeros = termo.replace(/\D/g, '');
      
      console.log(`[buscarContatosLivre] 🔍 Termo normalizado: "${termo}" | Números: "${termoNumeros}"`);
      
      // ✅ ESTRATÉGIA 1: Busca por telefone canônico (mais eficiente)
      if (termoNumeros.length >= 4) {
        try {
          // Tentar busca exata por telefone_canonico (mais rápido)
          const porTelefone = await base44.asServiceRole.entities.Contact.filter(
            { telefone_canonico: { $contains: termoNumeros } },
            '-ultima_interacao',
            50
          );
          
          if (porTelefone.length > 0) {
            console.log(`[buscarContatosLivre] ✅ Encontrou ${porTelefone.length} por telefone canônico`);
            contatos = porTelefone;
          }
        } catch (error) {
          console.warn('[buscarContatosLivre] ⚠️ Campo telefone_canonico ainda não existe:', error.message);
        }
      }
      
      // ✅ ESTRATÉGIA 2: Se não achou por telefone, buscar texto (limitado a 200)
      if (contatos.length === 0) {
        const todosBD = await base44.asServiceRole.entities.Contact.list('-ultima_interacao', 200);
        
        // Filtro local (Base44 não suporta $regex case-insensitive)
        contatos = todosBD.filter(c => {
          const nome = (c.nome || '').toLowerCase();
          const empresa = (c.empresa || '').toLowerCase();
          const cargo = (c.cargo || '').toLowerCase();
          const telefone = (c.telefone || '').replace(/\D/g, '');
          
          return nome.includes(termo) || 
                 empresa.includes(termo) || 
                 cargo.includes(termo) ||
                 (termoNumeros && telefone.includes(termoNumeros));
        }).slice(0, 100); // Limitar a 100
        
        console.log(`[buscarContatosLivre] ✅ Busca texto retornou ${contatos.length} resultados`);
      }
      
    } else {
      // ✅ SEM BUSCA: Retornar últimos 200 (não 500/1000)
      contatos = await base44.asServiceRole.entities.Contact.list('-ultima_interacao', 200);
      console.log(`[buscarContatosLivre] ✅ ${contatos.length} contatos recentes carregados (sem busca)`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 DEDUPLICAÇÃO POR TELEFONE CANÔNICO (se campo existir)
    // ═══════════════════════════════════════════════════════════════════════
    const contatosPorTelefone = new Map();
    const contatosSemTelefone = [];
    
    contatos.forEach(c => {
      const telCanon = c.telefone_canonico || (c.telefone || '').replace(/\D/g, '');
      
      if (!telCanon) {
        contatosSemTelefone.push(c);
        return;
      }
      
      const existente = contatosPorTelefone.get(telCanon);
      if (!existente) {
        contatosPorTelefone.set(telCanon, c);
      } else {
        // Manter o mais recente
        const tsExistente = new Date(existente.ultima_interacao || existente.updated_date || 0).getTime();
        const tsAtual = new Date(c.ultima_interacao || c.updated_date || 0).getTime();
        
        if (tsAtual > tsExistente) {
          contatosPorTelefone.set(telCanon, c);
        }
      }
    });
    
    const contatosDeduplicated = [...contatosPorTelefone.values(), ...contatosSemTelefone];

    // 🔍 LOG CIRÚRGICO: Resultado final (SEM FILTROS DE PERMISSÃO)
    console.log('[buscarContatosLivre] 📊 RETORNANDO (GLOBAL - sem filtros):', {
      user_email: user.email,
      user_role: user.role,
      total_antes_dedup: contatos.length,
      total_depois_dedup: contatosDeduplicated.length,
      duplicatas_removidas: contatos.length - contatosDeduplicated.length,
      primeiros_3: contatosDeduplicated.slice(0, 3).map(c => ({
        id: c.id?.substring(0, 8),
        nome: c.nome,
        telefone: c.telefone,
        telefone_canonico: c.telefone_canonico || 'N/A',
        empresa: c.empresa
      })),
      tem_luiz: contatosDeduplicated.some(c => c.nome?.toLowerCase().includes('luiz')),
      WARNING: '⚠️ NENHUM filtro de permissão aplicado - INTENCIONAL'
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