import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Diagnóstico completo de um contato para identificar
 * todas as correções necessárias antes de unificar
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { contact_id } = await req.json();

    if (!contact_id) {
      return Response.json({
        error: 'contact_id é obrigatório'
      }, { status: 400 });
    }

    console.log(`[DIAGNÓSTICO] Iniciando diagnóstico para contato: ${contact_id}`);

    // 1️⃣ BUSCAR CONTATO PRINCIPAL
    const contato = await base44.entities.Contact.get(contact_id);
    if (!contato) {
      return Response.json({
        error: 'Contato não encontrado'
      }, { status: 404 });
    }

    const diagnostico = {
      contato: {
        id: contato.id,
        nome: contato.nome,
        telefone: contato.telefone,
        empresa: contato.empresa,
        cargo: contato.cargo
      },
      problemas: [],
      acoes_necessarias: [],
      threads_afetadas: [],
      mensagens_afetadas: [],
      contatos_duplicados: [],
      resumo: {}
    };

    // 2️⃣ BUSCAR THREADS DO CONTATO
    const threads = await base44.entities.MessageThread.filter({
      contact_id: contact_id
    }, '-last_message_at', 100);

    console.log(`[DIAGNÓSTICO] ${threads?.length || 0} thread(s) encontrada(s)`);

    // 3️⃣ BUSCAR TODAS AS MENSAGENS DAS THREADS
    const todasMensagens = [];
    for (const thread of (threads || [])) {
      const mensagens = await base44.entities.Message.filter({
        thread_id: thread.id
      }, '-sent_at', 1000);

      if (mensagens && mensagens.length > 0) {
        todasMensagens.push(...mensagens);
        diagnostico.threads_afetadas.push({
          thread_id: thread.id,
          total_mensagens: mensagens.length,
          canal: thread.channel,
          status: thread.status,
          assigned_user: thread.assigned_user_id,
          last_message_at: thread.last_message_at
        });
      }
    }

    console.log(`[DIAGNÓSTICO] ${todasMensagens.length} mensagem(s) encontrada(s)`);

    // 4️⃣ BUSCAR CONTATOS DUPLICADOS (MESMO TELEFONE)
    if (contato.telefone) {
      const contatosDuplicados = await base44.entities.Contact.filter({
        telefone: contato.telefone
      }, 'created_date', 100);

      for (const dup of (contatosDuplicados || [])) {
        if (dup.id !== contact_id) {
          diagnostico.contatos_duplicados.push({
            id: dup.id,
            nome: dup.nome,
            empresa: dup.empresa,
            cargo: dup.cargo,
            tipo_contato: dup.tipo_contato,
            score: dup.cliente_score || 0,
            fidelizado: dup.is_cliente_fidelizado || false
          });

          diagnostico.problemas.push({
            tipo: 'DUPLICATA_CONTATO',
            severidade: 'CRÍTICO',
            descricao: `Duplicata encontrada: ${dup.nome || '(sem nome)'}`,
            detalhe: dup.id
          });
        }
      }
    }

    // 5️⃣ ANALISAR MENSAGENS
    let msgsSemContent = 0;
    let msgsComSenderIdErrado = 0;
    let msgsComRecipientIdErrado = 0;

    for (const msg of todasMensagens) {
      // Problema: Mensagem sem conteúdo
      if (!msg.content || msg.content.trim().length === 0) {
        if (!msg.media_url || msg.media_type === 'none') {
          msgsSemContent++;
          diagnostico.mensagens_afetadas.push({
            message_id: msg.id.substring(0, 12),
            problema: 'SEM_CONTEUDO',
            thread_id: msg.thread_id.substring(0, 12),
            sender: msg.sender_id.substring(0, 12),
            sent_at: msg.sent_at
          });
        }
      }

      // Problema: Sender ID não corresponde
      if (msg.sender_type === 'contact' && msg.sender_id !== contact_id) {
        // Mensagem de contato mas sender_id aponta para outro contato
        msgsComSenderIdErrado++;
      }

      // Problema: Recipient ID não corresponde
      if (msg.recipient_type === 'contact' && msg.recipient_id !== contact_id) {
        // Mensagem para contato mas recipient_id aponta para outro contato
        msgsComRecipientIdErrado++;
      }
    }

    if (msgsSemContent > 0) {
      diagnostico.problemas.push({
        tipo: 'MENSAGENS_VAZIAS',
        severidade: 'AVISO',
        descricao: `${msgsSemContent} mensagem(s) sem conteúdo`,
        detalhe: msgsSemContent
      });
    }

    // 6️⃣ MONTAR AÇÕES NECESSÁRIAS
    if (diagnostico.contatos_duplicados.length > 0) {
      diagnostico.acoes_necessarias.push({
        acao: 'UNIFICAR_CONTATOS',
        descricao: `Unificar ${diagnostico.contatos_duplicados.length} contato(s) duplicado(s)`,
        prioridade: 'CRÍTICA',
        contatos_afetados: diagnostico.contatos_duplicados.map(c => c.id)
      });
    }

    if (msgsSemContent > 0) {
      diagnostico.acoes_necessarias.push({
        acao: 'LIMPAR_MENSAGENS_VAZIAS',
        descricao: `Remover ${msgsSemContent} mensagem(s) sem conteúdo`,
        prioridade: 'MÉDIA'
      });
    }

    if (msgsComSenderIdErrado > 0 || msgsComRecipientIdErrado > 0) {
      diagnostico.acoes_necessarias.push({
        acao: 'SINCRONIZAR_MENSAGENS',
        descricao: `Sincronizar IDs em ${msgsComSenderIdErrado + msgsComRecipientIdErrado} mensagem(s)`,
        prioridade: 'ALTA',
        msg_sender_errado: msgsComSenderIdErrado,
        msg_recipient_errado: msgsComRecipientIdErrado
      });
    }

    // 7️⃣ RESUMO
    diagnostico.resumo = {
      total_threads: threads?.length || 0,
      total_mensagens: todasMensagens.length,
      total_contatos_duplicados: diagnostico.contatos_duplicados.length,
      total_problemas: diagnostico.problemas.length,
      total_acoes: diagnostico.acoes_necessarias.length,
      severity_score: diagnostico.problemas.reduce((sum, p) => {
        return sum + (p.severidade === 'CRÍTICO' ? 10 : p.severidade === 'ALTA' ? 5 : 1);
      }, 0)
    };

    console.log(`[DIAGNÓSTICO] ✅ CONCLUÍDO:`, diagnostico.resumo);

    return Response.json({
      success: true,
      diagnostico
    });
  } catch (error) {
    console.error('[DIAGNÓSTICO] ❌ Erro:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});