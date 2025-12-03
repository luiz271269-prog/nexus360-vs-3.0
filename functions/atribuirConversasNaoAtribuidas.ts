/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔄 ATRIBUIÇÃO AUTOMÁTICA DE CONVERSAS NÃO ATRIBUÍDAS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Analisa conversas sem atendente e atribui ao último atendente que conversou
 * com o contato, seguindo a ordem de prioridade:
 * 
 * 1. Último atendente que enviou mensagem nesta thread
 * 2. Atendente fidelizado do contato (vendedor_responsavel, atendente_fidelizado_*)
 * 3. Último atendente que conversou com este contato em qualquer thread
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parâmetros opcionais
    const url = new URL(req.url);
    const limitHoras = parseInt(url.searchParams.get('horas') || '48'); // Últimas 48h por padrão
    const dryRun = url.searchParams.get('dry_run') === 'true'; // Só simular, não atribuir

    // 1. Buscar threads não atribuídas
    const todasThreads = await base44.asServiceRole.entities.MessageThread.list('-last_message_at', 500);
    const threadsNaoAtribuidas = todasThreads.filter(t => 
      !t.assigned_user_id && 
      t.status !== 'arquivada' &&
      t.status !== 'resolvida'
    );

    if (threadsNaoAtribuidas.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhuma conversa não atribuída encontrada',
        atribuidas: 0
      });
    }

    // 2. Buscar todos os atendentes ativos
    const atendentes = await base44.asServiceRole.entities.User.filter({ is_whatsapp_attendant: true });
    const atendentesMap = new Map(atendentes.map(a => [a.id, a]));
    const atendentesEmailMap = new Map(atendentes.map(a => [a.email?.toLowerCase(), a]));
    const atendentesNomeMap = new Map(atendentes.map(a => [a.full_name?.toLowerCase(), a]));

    // 3. Buscar contatos
    const contatos = await base44.asServiceRole.entities.Contact.list('-created_date', 500);
    const contatosMap = new Map(contatos.map(c => [c.id, c]));

    // 4. Buscar mensagens recentes (para encontrar último atendente)
    const dataLimite = new Date(Date.now() - limitHoras * 60 * 60 * 1000).toISOString();
    const mensagensRecentes = await base44.asServiceRole.entities.Message.list('-sent_at', 2000);

    // Agrupar mensagens por thread_id
    const mensagensPorThread = new Map();
    for (const msg of mensagensRecentes) {
      if (!mensagensPorThread.has(msg.thread_id)) {
        mensagensPorThread.set(msg.thread_id, []);
      }
      mensagensPorThread.get(msg.thread_id).push(msg);
    }

    // Função para encontrar atendente por ID, email ou nome
    const encontrarAtendente = (identificador) => {
      if (!identificador) return null;
      const idNorm = String(identificador).toLowerCase().trim();
      
      return atendentesMap.get(identificador) || 
             atendentesEmailMap.get(idNorm) ||
             atendentesNomeMap.get(idNorm) ||
             null;
    };

    // Função para encontrar último atendente que enviou mensagem na thread
    const encontrarUltimoAtendenteNaThread = (threadId) => {
      const mensagens = mensagensPorThread.get(threadId) || [];
      
      // Ordenar por data decrescente
      const mensagensOrdenadas = mensagens
        .filter(m => m.sender_type === 'user')
        .sort((a, b) => new Date(b.sent_at || b.created_date) - new Date(a.sent_at || a.created_date));

      for (const msg of mensagensOrdenadas) {
        const atendente = encontrarAtendente(msg.sender_id);
        if (atendente) {
          return { atendente, fonte: 'mensagem_thread' };
        }
      }
      return null;
    };

    // Função para encontrar atendente fidelizado do contato
    const encontrarAtendenteFidelizado = (contato) => {
      if (!contato) return null;

      const camposFidelizacao = [
        'vendedor_responsavel',
        'atendente_fidelizado_vendas',
        'atendente_fidelizado_assistencia',
        'atendente_fidelizado_financeiro',
        'atendente_fidelizado_fornecedor'
      ];

      for (const campo of camposFidelizacao) {
        const valor = contato[campo];
        if (valor) {
          const atendente = encontrarAtendente(valor);
          if (atendente) {
            return { atendente, fonte: `fidelizado_${campo}` };
          }
        }
      }
      return null;
    };

    // Função para encontrar último atendente que conversou com o contato em qualquer thread
    const encontrarUltimoAtendenteDoContato = (contactId) => {
      // Encontrar todas as threads deste contato
      const threadsDoContato = todasThreads.filter(t => t.contact_id === contactId);
      
      let ultimoAtendente = null;
      let ultimaData = null;

      for (const thread of threadsDoContato) {
        const mensagens = mensagensPorThread.get(thread.id) || [];
        
        for (const msg of mensagens) {
          if (msg.sender_type === 'user') {
            const dataMsg = new Date(msg.sent_at || msg.created_date);
            if (!ultimaData || dataMsg > ultimaData) {
              const atendente = encontrarAtendente(msg.sender_id);
              if (atendente) {
                ultimoAtendente = atendente;
                ultimaData = dataMsg;
              }
            }
          }
        }
      }

      return ultimoAtendente ? { atendente: ultimoAtendente, fonte: 'historico_contato' } : null;
    };

    // 5. Processar cada thread não atribuída
    const resultados = [];
    let atribuidas = 0;

    for (const thread of threadsNaoAtribuidas) {
      const contato = contatosMap.get(thread.contact_id);
      
      // Ordem de prioridade para encontrar atendente
      let resultado = null;

      // 1º - Último atendente que enviou mensagem nesta thread
      resultado = encontrarUltimoAtendenteNaThread(thread.id);

      // 2º - Atendente fidelizado do contato
      if (!resultado) {
        resultado = encontrarAtendenteFidelizado(contato);
      }

      // 3º - Último atendente que conversou com este contato
      if (!resultado) {
        resultado = encontrarUltimoAtendenteDoContato(thread.contact_id);
      }

      if (resultado) {
        const { atendente, fonte } = resultado;

        resultados.push({
          thread_id: thread.id,
          contact_id: thread.contact_id,
          contato_nome: contato?.nome || 'Desconhecido',
          atendente_id: atendente.id,
          atendente_nome: atendente.full_name,
          fonte_atribuicao: fonte,
          atribuido: !dryRun
        });

        if (!dryRun) {
          // Atribuir a conversa
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            assigned_user_id: atendente.id,
            assigned_user_name: atendente.full_name
          });
          atribuidas++;
        }
      } else {
        resultados.push({
          thread_id: thread.id,
          contact_id: thread.contact_id,
          contato_nome: contato?.nome || 'Desconhecido',
          atendente_id: null,
          atendente_nome: null,
          fonte_atribuicao: 'nao_encontrado',
          atribuido: false
        });
      }
    }

    return Response.json({
      success: true,
      message: dryRun 
        ? `Simulação: ${resultados.filter(r => r.atendente_id).length} conversas seriam atribuídas`
        : `${atribuidas} conversas atribuídas com sucesso`,
      total_nao_atribuidas: threadsNaoAtribuidas.length,
      atribuidas: dryRun ? 0 : atribuidas,
      dry_run: dryRun,
      resultados
    });

  } catch (error) {
    console.error('[atribuirConversasNaoAtribuidas] Erro:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});