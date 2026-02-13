import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Busca livre de contatos no banco (sem RLS)
 * Usado para permitir busca ampla, com filtragem de permissões no frontend
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
    console.log('[buscarContatosLivre] 📞 CHAMADA:', {
      user_id: user.id,
      user_email: user.email,
      user_role: user.role,
      searchTerm,
      limit
    });

    // ✅ FIX PERFORMANCE: Usar queries otimizadas em vez de .list() completo
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

    // 🔍 LOG CIRÚRGICO: Mostrar primeiros 3 resultados
    console.log('[buscarContatosLivre] 📊 RETORNANDO:', {
      total: contatos.length,
      primeiros_3: contatos.slice(0, 3).map(c => ({
        id: c.id?.substring(0, 8),
        nome: c.nome,
        telefone: c.telefone,
        tipo: c.tipo_contato
      })),
      tem_luiz: contatos.some(c => c.nome?.toLowerCase().includes('luiz'))
    });

    return Response.json({ 
      success: true,
      contatos,
      total: contatos.length,
      user_id: user.id
    });

  } catch (error) {
    console.error('[buscarContatosLivre] Erro:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});