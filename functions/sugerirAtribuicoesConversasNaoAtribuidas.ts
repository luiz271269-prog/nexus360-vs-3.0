import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized. Only admins can run this function.' }, { status: 401 });
    }

    const params = await req.json().catch(() => ({}));

    const dryRun = params.dry_run === true;
    const dias = params.dias ? Number(params.dias) : 30;
    const limite = params.limite ? Number(params.limite) : 200;

    const agora = new Date();
    const dataCorte = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);

    console.log(
      `[sugerirAtribuicoes] Início. dry_run=${dryRun}, dias=${dias}, limite=${limite}`
    );

    // 1) Buscar threads não atribuídas
    const todasThreads = await base44.asServiceRole.entities.MessageThread.list('-updated_date', limite);
    
    // Filtrar: não atribuídas, não pendentes, não arquivadas/resolvidas
    const threadsNaoAtribuidas = todasThreads.filter(t => 
      !t.assigned_user_id && 
      !t.assignment_review_pending &&
      !['arquivada', 'resolvida'].includes(t.status) &&
      new Date(t.updated_date) >= dataCorte
    );

    console.log(
      `[sugerirAtribuicoes] Threads candidatas: ${threadsNaoAtribuidas.length}`
    );

    const sugestoes = [];
    let semMensagemUser = 0;
    let atualizadas = 0;
    let erros = 0;

    // Buscar todos os usuários para lookup
    const todosUsuarios = await base44.asServiceRole.entities.User.list();
    const usuariosMap = new Map(todosUsuarios.map(u => [u.id, u]));

    for (const thread of threadsNaoAtribuidas) {
      try {
        // 2) Buscar mensagens de atendente nesta thread
        const todasMensagens = await base44.asServiceRole.entities.Message.filter({
          thread_id: thread.id
        }, '-sent_at', 50);

        // Filtrar só as de tipo 'user'
        const mensagensUser = todasMensagens.filter(m => m.sender_type === 'user');
        
        const ultimaMsgUser = mensagensUser[0];
        if (!ultimaMsgUser || !ultimaMsgUser.sender_id) {
          semMensagemUser++;
          continue;
        }

        const suggestedUserId = ultimaMsgUser.sender_id;

        // 3) Resolver dados do usuário
        const userEntity = usuariosMap.get(suggestedUserId);
        const suggestedUserEmail = userEntity?.email || null;
        const suggestedUserName = userEntity?.full_name || null;

        const sugestao = {
          thread_id: thread.id,
          contact_id: thread.contact_id || null,
          suggested_assigned_user_id: suggestedUserId,
          suggested_assigned_user_email: suggestedUserEmail,
          suggested_assigned_user_name: suggestedUserName,
          suggested_assignment_reason: "last_responder",
          ultima_msg_id: ultimaMsgUser.id,
          ultima_msg_sent_at: ultimaMsgUser.sent_at,
        };

        sugestoes.push(sugestao);

        if (!dryRun) {
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            suggested_assigned_user_id: suggestedUserId,
            suggested_assigned_user_email: suggestedUserEmail,
            suggested_assigned_user_name: suggestedUserName,
            suggested_assignment_reason: "last_responder",
            assignment_review_pending: true,
          });
          atualizadas++;
        }
      } catch (e) {
        erros++;
        console.error(
          `[sugerirAtribuicoes] Erro na thread ${thread.id}: ${e?.message || String(e)}`
        );
        continue;
      }
    }

    const summary = {
      dry_run: dryRun,
      dias,
      limite,
      threads_analisadas: threadsNaoAtribuidas.length,
      threads_sem_mensagem_user: semMensagemUser,
      threads_com_sugestao: sugestoes.length,
      threads_atualizadas: dryRun ? 0 : atualizadas,
      erros,
    };

    console.log(
      `[sugerirAtribuicoes] Fim. analisadas=${summary.threads_analisadas}, com_sugestao=${summary.threads_com_sugestao}, atualizadas=${summary.threads_atualizadas}, sem_msg_user=${summary.threads_sem_mensagem_user}, erros=${summary.erros}`
    );

    const maxSugestoesRetorno = 100;
    const sugestoesRetorno =
      sugestoes.length > maxSugestoesRetorno
        ? sugestoes.slice(0, maxSugestoesRetorno)
        : sugestoes;

    return Response.json({
      ok: true,
      summary,
      sugestoes: sugestoesRetorno,
      aviso:
        sugestoes.length > maxSugestoesRetorno
          ? `Foram geradas ${sugestoes.length} sugestões. Retornando apenas as primeiras ${maxSugestoesRetorno}.`
          : undefined,
    });
  } catch (error) {
    console.error(`[sugerirAtribuicoes] Erro geral: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});