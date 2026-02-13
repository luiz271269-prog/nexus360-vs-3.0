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
      description: 'Busca livre de contatos (ignora RLS para permitir busca ampla)'
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchTerm, limit = 500 } = await req.json();
    
    // 🔍 LOG CIRÚRGICO: Identificar quem está chamando
    console.log('[buscarContatosLivre] 📞 CHAMADA RECEBIDA:', {
      user_id: user.id,
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
      const termoLimpo = termo.replace(/\D/g, '');
      
      console.log(`[buscarContatosLivre] 🔍 Buscando: "${termo}"`);
      
      // ✅ OTIMIZAÇÃO: Buscar por campos específicos com LIMIT menor (200 em vez de 500)
      const [porNome, porEmpresa, porTelefone] = await Promise.all([
        // Busca por nome (case-insensitive via $regex não suportado - usar filtro local)
        base44.asServiceRole.entities.Contact.list('-created_date', 200),
        // Busca complementar se termo for numérico
        termoLimpo.length >= 4 
          ? base44.asServiceRole.entities.Contact.list('-created_date', 200)
          : Promise.resolve([])
      ].filter(Boolean));
      
      // Combinar resultados
      const todosResultados = [...porNome, ...porEmpresa, ...porTelefone];
      const unicosMap = new Map(todosResultados.map(c => [c.id, c]));
      
      // Filtrar localmente (Base44 não suporta $regex)
      contatos = Array.from(unicosMap.values()).filter(c => {
        const nome = (c.nome || '').toLowerCase();
        const empresa = (c.empresa || '').toLowerCase();
        const cargo = (c.cargo || '').toLowerCase();
        const telefone = (c.telefone || '').replace(/\D/g, '');
        
        return nome.includes(termo) || 
               empresa.includes(termo) || 
               cargo.includes(termo) ||
               (termoLimpo && telefone.includes(termoLimpo));
      }).slice(0, 100); // ✅ Limitar a 100 resultados
      
      console.log(`[buscarContatosLivre] ✅ ${contatos.length} resultados encontrados`);
    } else {
      // ✅ FIX: Sem busca, retornar apenas 200 últimos (não 500/1000)
      contatos = await base44.asServiceRole.entities.Contact.list('-ultima_interacao', 200);
      console.log(`[buscarContatosLivre] ✅ ${contatos.length} contatos recentes carregados`);
    }

    // 🔍 LOG CIRÚRGICO: Mostrar resultados ANTES de qualquer filtro
    console.log('[buscarContatosLivre] 📊 RETORNANDO (sem filtros de permissão):', {
      user_email: user.email,
      user_role: user.role,
      total_contatos: contatos.length,
      primeiros_3: contatos.slice(0, 3).map(c => ({
        id: c.id?.substring(0, 8),
        nome: c.nome,
        telefone: c.telefone,
        tipo: c.tipo_contato,
        empresa: c.empresa
      })),
      tem_luiz: contatos.some(c => c.nome?.toLowerCase().includes('luiz')),
      WARNING: '⚠️ Esta função NÃO aplica filtros de permissão - isso é INTENCIONAL'
    });

    return Response.json({ 
      success: true,
      contatos,
      total: contatos.length,
      user_id: user.id,
      _meta: {
        searchTerm: searchTerm || null,
        aplicou_filtro_permissao: false, // ✅ CONTRATO: NUNCA filtrar por permissão
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[buscarContatosLivre] Erro:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});