import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers }
      );
    }

    const payload = await req.json();
    const { contact_id, action, motivo } = payload;

    console.log('[GERENCIAR CONTATO] 📋 Ação:', { contact_id, action, motivo });

    if (!contact_id || !action) {
      throw new Error('contact_id e action são obrigatórios');
    }

    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    
    if (!contato) {
      throw new Error('Contato não encontrado');
    }

    let resultado = {};

    switch (action) {
      case 'bloquear': {
        await base44.asServiceRole.entities.Contact.update(contact_id, {
          bloqueado: true,
          motivo_bloqueio: motivo || 'Bloqueado pelo usuário',
          bloqueado_em: new Date().toISOString(),
          bloqueado_por: user.id,
          whatsapp_status: 'bloqueado'
        });

        // Arquivar threads ativas deste contato
        const threadsAtivas = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contact_id,
          status: 'aberta'
        });

        for (const thread of threadsAtivas) {
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            status: 'arquivada',
            tags: [...(thread.tags || []), 'contato_bloqueado']
          });
        }

        resultado = { bloqueado: true, threads_arquivadas: threadsAtivas.length };
        console.log('[GERENCIAR CONTATO] 🚫 Contato bloqueado');
        break;
      }

      case 'desbloquear': {
        await base44.asServiceRole.entities.Contact.update(contact_id, {
          bloqueado: false,
          motivo_bloqueio: null,
          bloqueado_em: null,
          bloqueado_por: null,
          whatsapp_status: 'nao_verificado'
        });

        resultado = { bloqueado: false };
        console.log('[GERENCIAR CONTATO] ✅ Contato desbloqueado');
        break;
      }

      case 'deletar': {
        // Soft delete: manter registro mas marcar como inativo
        await base44.asServiceRole.entities.Contact.update(contact_id, {
          bloqueado: true,
          motivo_bloqueio: 'Contato deletado',
          bloqueado_em: new Date().toISOString(),
          bloqueado_por: user.id,
          tags: [...(contato.tags || []), 'deletado']
        });

        // Arquivar todas as threads
        const todasThreads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contact_id
        });

        for (const thread of todasThreads) {
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            status: 'arquivada',
            tags: [...(thread.tags || []), 'contato_deletado']
          });
        }

        resultado = { deletado: true, threads_arquivadas: todasThreads.length };
        console.log('[GERENCIAR CONTATO] 🗑️ Contato deletado (soft delete)');
        break;
      }

      default:
        throw new Error(`Ação não reconhecida: ${action}`);
    }

    // Registrar log da ação
    await base44.asServiceRole.entities.AutomationLog.create({
      acao: `contato_${action}`,
      contato_id: contact_id,
      usuario_id: user.id,
      resultado: 'sucesso',
      timestamp: new Date().toISOString(),
      detalhes: {
        mensagem: `Contato ${action} por ${user.full_name}`,
        motivo: motivo,
        ...resultado
      },
      origem: 'manual',
      prioridade: 'normal'
    });

    return new Response(
      JSON.stringify({
        success: true,
        action: action,
        ...resultado
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[GERENCIAR CONTATO] ❌ Erro:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers }
    );
  }
});