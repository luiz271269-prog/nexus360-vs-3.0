import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 RESOLVE SCHEDULE USER - RESOLVER "PARA QUEM" COM ESCOPO
// ═══════════════════════════════════════════════════════════════════════════
// Resolve nomes como "Ricardo" para user_id com escopo de segurança:
// - Externos só podem agendar para: responsável, setor permitido, agenda_publica
// - Internos podem agendar para si ou outros (com permissão)
//
// ENTRADA: { thread_id, from_type, from_id, assigned_target }
// SAÍDA: { success, user_id, user_name, message? }
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const payload = await req.json();
    const { thread_id, from_type, from_id, assigned_target } = payload;
    
    console.log(`[RESOLVE-USER] 🎯 Resolvendo: "${assigned_target}" | Tipo: ${from_type}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // INTERNO → SELF OU OUTRO (COM PERMISSÃO)
    // ═══════════════════════════════════════════════════════════════════════
    if (from_type === 'internal_user') {
      // Se não especificou ou disse "self", agendar para ele mesmo
      if (!assigned_target || assigned_target === 'self' || assigned_target === 'eu') {
        return Response.json({
          success: true,
          user_id: from_id,
          user_name: 'você'
        });
      }
      
      // Buscar usuário interno por nome
      const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
      const normalizeNome = (n) => (n || '').toLowerCase().trim();
      
      const candidatos = users.filter(u => {
        const fullName = normalizeNome(u.full_name || '');
        const displayName = normalizeNome(u.display_name || '');
        const target = normalizeNome(assigned_target);
        
        return fullName.includes(target) || displayName.includes(target);
      });
      
      if (candidatos.length === 0) {
        return Response.json({
          success: false,
          message: `❌ Não encontrei usuário "${assigned_target}". Tente o nome completo.`
        });
      }
      
      if (candidatos.length === 1) {
        return Response.json({
          success: true,
          user_id: candidatos[0].id,
          user_name: candidatos[0].display_name || candidatos[0].full_name
        });
      }
      
      // Múltiplos candidatos - pedir desambiguação
      const opcoes = candidatos.map(u => 
        `${u.display_name || u.full_name} (${u.attendant_sector || 'geral'})`
      ).join('\n• ');
      
      return Response.json({
        success: false,
        message: `🤔 Encontrei ${candidatos.length} pessoas:\n\n• ${opcoes}\n\nQual delas?`
      });
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // EXTERNO → ESCOPO RESTRITO
    // ═══════════════════════════════════════════════════════════════════════
    if (from_type === 'external_contact') {
      // Buscar thread e contato para determinar escopo
      const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
      const contact = thread.contact_id 
        ? await base44.asServiceRole.entities.Contact.get(thread.contact_id)
        : null;
      
      const candidatos = [];
      
      // 1. Responsável direto do contato
      if (contact) {
        if (contact.vendedor_responsavel) {
          candidatos.push({ source: 'vendedor_responsavel', value: contact.vendedor_responsavel });
        }
        
        const camposFidelizacao = [
          'atendente_fidelizado_vendas',
          'atendente_fidelizado_assistencia',
          'atendente_fidelizado_financeiro',
          'atendente_fidelizado_fornecedor'
        ];
        
        for (const campo of camposFidelizacao) {
          if (contact[campo]) {
            candidatos.push({ source: campo, value: contact[campo] });
          }
        }
      }
      
      // 2. Thread atribuída
      if (thread.assigned_user_id) {
        candidatos.push({ source: 'assigned_user_id', value: thread.assigned_user_id });
      }
      
      // 3. Usuários com agenda_publica = true
      const usersPublicos = await base44.asServiceRole.entities.User.filter({
        agenda_publica: true
      }, '-created_date', 20);
      
      for (const u of (usersPublicos || [])) {
        candidatos.push({ source: 'agenda_publica', value: u.id });
      }
      
      // Remover duplicatas
      const candidatosUnicos = [...new Set(candidatos.map(c => c.value))];
      
      console.log(`[RESOLVE-USER] 📋 Candidatos encontrados: ${candidatosUnicos.length}`);
      
      if (candidatosUnicos.length === 0) {
        // Fallback: usar responsável da thread ou primeiro admin
        const fallbackUserId = thread.assigned_user_id;
        if (fallbackUserId) {
          return Response.json({
            success: true,
            user_id: fallbackUserId,
            user_name: 'responsável pelo atendimento'
          });
        }
        
        return Response.json({
          success: false,
          message: '❌ Não consegui identificar um responsável. Entre em contato com o atendimento.'
        });
      }
      
      if (candidatosUnicos.length === 1) {
        return Response.json({
          success: true,
          user_id: candidatosUnicos[0],
          user_name: 'responsável'
        });
      }
      
      // Se especificou nome, tentar filtrar
      if (assigned_target && assigned_target !== 'self') {
        const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
        const normalizeNome = (n) => (n || '').toLowerCase().trim();
        const target = normalizeNome(assigned_target);
        
        const matches = users.filter(u => 
          candidatosUnicos.includes(u.id) && (
            normalizeNome(u.full_name || '').includes(target) ||
            normalizeNome(u.display_name || '').includes(target)
          )
        );
        
        if (matches.length === 1) {
          return Response.json({
            success: true,
            user_id: matches[0].id,
            user_name: matches[0].display_name || matches[0].full_name
          });
        }
        
        if (matches.length > 1) {
          const opcoes = matches.map(u => 
            `${u.display_name || u.full_name} (${u.attendant_sector || 'geral'})`
          ).join('\n• ');
          
          return Response.json({
            success: false,
            message: `🤔 Encontrei ${matches.length} pessoas:\n\n• ${opcoes}\n\nQual delas?`
          });
        }
      }
      
      // Não especificou ou não encontrou - usar primeiro candidato
      return Response.json({
        success: true,
        user_id: candidatosUnicos[0],
        user_name: 'responsável pelo atendimento'
      });
    }
    
    return Response.json({
      success: false,
      message: 'Tipo de solicitante inválido'
    }, { status: 400 });
    
  } catch (error) {
    console.error('[RESOLVE-USER] ❌ Erro:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});