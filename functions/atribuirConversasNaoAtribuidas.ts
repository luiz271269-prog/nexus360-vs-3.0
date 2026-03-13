/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 ATRIBUIDOR DE CONVERSAS NÃO ATRIBUÍDAS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Analisa todas as conversas (MessageThreads) sem atribuição e atribui ao 
 * último atendente que respondeu na conversa.
 * 
 * LÓGICA:
 * 1. Busca todas as threads sem assigned_user_id
 * 2. Para cada thread, busca as mensagens
 * 3. Identifica a última mensagem enviada por um "user" (atendente)
 * 4. Atribui a thread ao atendente que enviou essa mensagem
 * 
 * MODOS:
 * - dry_run=true: Apenas simula e retorna o que seria feito
 * - dry_run=false: Executa as atribuições
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }
    
    // Apenas admins podem executar
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem executar esta função' }, { status: 403 });
    }

    // Parâmetros
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') !== 'false'; // Default: true (simulação)
    const limite = parseInt(url.searchParams.get('limite') || '100');
    const diasAtras = parseInt(url.searchParams.get('dias') || '30');

    console.log(`[ATRIBUIDOR] Iniciando... dry_run=${dryRun}, limite=${limite}, dias=${diasAtras}`);

    // 1. Buscar threads não atribuídas — BUSCAR DIRETO COM FILTRO para evitar O(n) em cima de 500
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasAtras);

    // ✅ FIX WATCHDOG: Buscar diretamente threads sem assigned_user_id
    const threadsOrfas = await base44.asServiceRole.entities.MessageThread.filter(
      {
        assigned_user_id: { $exists: false },
        updated_date: { $gte: dataLimite.toISOString() }
      },
      '-updated_date',
      limite + 100 // Buffer para segurança
    );
    
    const totalAnalisadas = threadsOrfas.length;

    console.log(`[ATRIBUIDOR] Encontradas ${threadsOrfas.length} threads órfãs`);

    if (threadsOrfas.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhuma thread órfã encontrada',
        total_analisadas: totalAnalisadas,
        total_orfas: 0,
        atribuicoes: []
      });
    }

    // 2. Buscar todos os usuários para mapear IDs
    const usuarios = await base44.asServiceRole.entities.User.list();
    const usuariosMap = new Map();
    usuarios.forEach(u => {
      if (u.id) usuariosMap.set(u.id, u);
      if (u.email) usuariosMap.set(u.email.toLowerCase(), u);
    });

    // 3. Processar cada thread órfã
    const atribuicoes = [];
    const erros = [];

    for (const thread of threadsOrfas) {
      try {
        // Buscar mensagens da thread
        const mensagens = await base44.asServiceRole.entities.Message.filter(
          { thread_id: thread.id },
          '-created_date',
          100
        );

        if (!mensagens || mensagens.length === 0) {
          console.log(`[ATRIBUIDOR] Thread ${thread.id}: Sem mensagens`);
          continue;
        }

        // Encontrar última mensagem de um atendente (sender_type = 'user')
        const ultimaMsgAtendente = mensagens.find(m => m.sender_type === 'user');

        if (!ultimaMsgAtendente) {
          console.log(`[ATRIBUIDOR] Thread ${thread.id}: Sem resposta de atendente`);
          continue;
        }

        // Identificar o atendente
        const senderId = ultimaMsgAtendente.sender_id;
        let atendente = usuariosMap.get(senderId);

        // Tentar encontrar por email se não achou por ID
        if (!atendente && senderId && senderId.includes('@')) {
          atendente = usuariosMap.get(senderId.toLowerCase());
        }

        if (!atendente) {
          console.log(`[ATRIBUIDOR] Thread ${thread.id}: Atendente ${senderId} não encontrado no sistema`);
          continue;
        }

        // Preparar dados de atribuição
        const dadosAtribuicao = {
          thread_id: thread.id,
          contact_id: thread.contact_id,
          atendente_id: atendente.id,
          atendente_nome: atendente.full_name || atendente.email,
          atendente_email: atendente.email,
          ultima_msg_data: ultimaMsgAtendente.created_date || ultimaMsgAtendente.sent_at,
          ultima_msg_preview: (ultimaMsgAtendente.content || '').substring(0, 50)
        };

        atribuicoes.push(dadosAtribuicao);

        // Se não for dry_run, executar atribuição
        if (!dryRun) {
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            assigned_user_id: atendente.id,
            assigned_user_name: atendente.full_name || atendente.email,
            assigned_user_email: atendente.email
          });

          // Registrar log
          await base44.asServiceRole.entities.AutomationLog.create({
            acao: 'atribuicao_retroativa_lote',
            contato_id: thread.contact_id,
            thread_id: thread.id,
            usuario_id: atendente.id,
            resultado: 'sucesso',
            timestamp: new Date().toISOString(),
            detalhes: {
              mensagem: `Atribuição retroativa baseada em última resposta`,
              atendente: atendente.full_name || atendente.email,
              trigger: 'atribuirConversasNaoAtribuidas',
              executado_por: user.full_name || user.email
            },
            origem: 'sistema',
            prioridade: 'baixa'
          });

          console.log(`[ATRIBUIDOR] ✅ Thread ${thread.id} atribuída a ${atendente.full_name}`);
        } else {
          console.log(`[ATRIBUIDOR] [DRY-RUN] Thread ${thread.id} seria atribuída a ${atendente.full_name}`);
        }

      } catch (threadError) {
        console.error(`[ATRIBUIDOR] ❌ Erro na thread ${thread.id}:`, threadError.message);
        erros.push({
          thread_id: thread.id,
          erro: threadError.message
        });
      }
    }

    // 4. Retornar resultado
    return Response.json({
      success: true,
      dry_run: dryRun,
      message: dryRun 
        ? `Simulação concluída. ${atribuicoes.length} threads seriam atribuídas.`
        : `Execução concluída. ${atribuicoes.length} threads foram atribuídas.`,
      total_analisadas: todasThreads.length,
      total_orfas: threadsOrfas.length,
      total_atribuidas: atribuicoes.length,
      total_erros: erros.length,
      atribuicoes: atribuicoes.slice(0, 50), // Limitar resposta
      erros: erros.slice(0, 20),
      instrucoes: dryRun 
        ? 'Para executar de fato, chame com ?dry_run=false'
        : null
    });

  } catch (error) {
    console.error('[ATRIBUIDOR] Erro geral:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});