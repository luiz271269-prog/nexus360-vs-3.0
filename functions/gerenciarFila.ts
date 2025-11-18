import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GERENCIADOR DE FILAS DE ATENDIMENTO                        ║
 * ║  Versão: 1.0 - FIFO + Prioridade + Multi-Conexão           ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Funcionalidades:
 * - Enfileirar threads automaticamente ou manualmente
 * - Desenfileirar (pegar próximo) com estratégias FIFO ou Prioridade
 * - Listar fila em tempo real com cálculo de tempo de espera
 * - Suporte a múltiplas conexões WhatsApp
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    console.log('[GERENCIAR-FILA] 📋 Payload recebido:', JSON.stringify(payload, null, 2));

    const { action, ...data } = payload;

    switch (action) {
      case 'enqueue':
        return await enfileirar(base44, data, headers);
      
      case 'dequeue':
        return await desenfileirar(base44, data, headers);
      
      case 'list':
        return await listarFila(base44, data, headers);
      
      case 'remover':
        return await removerDaFila(base44, data, headers);
      
      case 'estatisticas':
        return await obterEstatisticas(base44, data, headers);
      
      default:
        return Response.json(
          { success: false, error: `Ação inválida: ${action}` },
          { status: 400, headers }
        );
    }

  } catch (error) {
    console.error('[GERENCIAR-FILA] ❌ Erro fatal:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers }
    );
  }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * ENFILEIRAR - Adiciona uma thread na fila de atendimento
 * ═══════════════════════════════════════════════════════════════
 */
async function enfileirar(base44, data, headers) {
  const { 
    thread_id, 
    whatsapp_integration_id, 
    setor = 'geral', 
    prioridade = 'normal',
    metadata = {}
  } = data;

  console.log('[ENFILEIRAR] 📥 Adicionando à fila:', { thread_id, setor, prioridade });

  try {
    // Verificar se já está na fila
    const jaEnfileirado = await base44.asServiceRole.entities.FilaAtendimento.filter({
      thread_id: thread_id,
      removido_da_fila: false
    });

    if (jaEnfileirado.length > 0) {
      console.log('[ENFILEIRAR] ⚠️ Thread já está na fila:', jaEnfileirado[0].id);
      return Response.json(
        { 
          success: false, 
          message: 'Thread já está na fila',
          fila_entry: jaEnfileirado[0]
        },
        { status: 200, headers }
      );
    }

    // Buscar dados da thread para enriquecer metadata
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    const contato = thread.contact_id 
      ? await base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null)
      : null;

    // Buscar nome da conexão
    const integracao = whatsapp_integration_id
      ? await base44.asServiceRole.entities.WhatsAppIntegration.get(whatsapp_integration_id).catch(() => null)
      : null;

    const metadataEnriquecido = {
      cliente_nome: contato?.nome || metadata.cliente_nome || 'Desconhecido',
      cliente_telefone: contato?.telefone || metadata.cliente_telefone || '',
      ultima_mensagem_preview: thread.last_message_content?.substring(0, 100) || '',
      tags: thread.tags || [],
      ...metadata
    };

    // Criar entrada na fila
    const filaEntry = await base44.asServiceRole.entities.FilaAtendimento.create({
      thread_id,
      contact_id: thread.contact_id,
      whatsapp_integration_id,
      nome_conexao: integracao?.nome_instancia || 'Desconhecida',
      setor,
      prioridade,
      entrou_em: new Date().toISOString(),
      removido_da_fila: false,
      tentativas_atribuicao: 0,
      metadata: metadataEnriquecido
    });

    console.log('[ENFILEIRAR] ✅ Thread enfileirada com sucesso:', filaEntry.id);

    // Atualizar a MessageThread com referência à fila
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      fila_atendimento_id: filaEntry.id,
      entrou_na_fila_em: filaEntry.entrou_em,
      status: 'aberta'
    });

    return Response.json(
      { success: true, fila_entry: filaEntry },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[ENFILEIRAR] ❌ Erro:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers }
    );
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * DESENFILEIRAR - Pega a próxima thread da fila
 * ═══════════════════════════════════════════════════════════════
 */
async function desenfileirar(base44, data, headers) {
  const { 
    setor, 
    atendente_id,
    atendente_nome,
    estrategia = 'fifo' // 'fifo' ou 'prioridade'
  } = data;

  console.log('[DESENFILEIRAR] 🎯 Buscando próxima thread:', { setor, estrategia });

  try {
    let threadsNaFila;

    if (estrategia === 'prioridade') {
      // Ordenar por prioridade (urgente > alta > normal > baixa) e depois por FIFO
      const todasThreads = await base44.asServiceRole.entities.FilaAtendimento.filter({
        setor: setor,
        removido_da_fila: false
      }, 'entrou_em', 100);

      const ordemPrioridade = { 'urgente': 4, 'alta': 3, 'normal': 2, 'baixa': 1 };
      
      threadsNaFila = todasThreads.sort((a, b) => {
        const prioA = ordemPrioridade[a.prioridade] || 2;
        const prioB = ordemPrioridade[b.prioridade] || 2;
        
        if (prioA !== prioB) return prioB - prioA; // Maior prioridade primeiro
        
        return new Date(a.entrou_em) - new Date(b.entrou_em); // FIFO para mesma prioridade
      });

      threadsNaFila = threadsNaFila.slice(0, 1);
    } else {
      // FIFO puro
      threadsNaFila = await base44.asServiceRole.entities.FilaAtendimento.filter(
        { setor, removido_da_fila: false },
        'entrou_em', // Ordena pelo mais antigo primeiro
        1 // Pega apenas o primeiro
      );
    }

    if (threadsNaFila.length === 0) {
      console.log('[DESENFILEIRAR] ℹ️ Nenhuma thread na fila do setor:', setor);
      return Response.json(
        { success: true, message: 'Nenhuma thread na fila', thread: null },
        { status: 200, headers }
      );
    }

    const proximaFila = threadsNaFila[0];
    const tempoEsperaSegundos = Math.floor(
      (Date.now() - new Date(proximaFila.entrou_em).getTime()) / 1000
    );

    // Marcar como removido da fila
    await base44.asServiceRole.entities.FilaAtendimento.update(proximaFila.id, {
      removido_da_fila: true,
      motivo_remocao: 'atribuido',
      atendido_por: atendente_id,
      atendido_por_nome: atendente_nome,
      atendido_em: new Date().toISOString(),
      tempo_espera_segundos: tempoEsperaSegundos
    });

    // Atualizar a MessageThread
    await base44.asServiceRole.entities.MessageThread.update(proximaFila.thread_id, {
      assigned_user_id: atendente_id,
      assigned_user_name: atendente_nome,
      fila_atendimento_id: null, // Remove referência da fila
      entrou_na_fila_em: null
    });

    console.log('[DESENFILEIRAR] ✅ Thread atribuída:', {
      thread_id: proximaFila.thread_id,
      atendente: atendente_nome,
      tempo_espera: `${tempoEsperaSegundos}s`
    });

    return Response.json(
      { 
        success: true, 
        fila_entry: proximaFila,
        thread_id: proximaFila.thread_id,
        tempo_espera_segundos: tempoEsperaSegundos
      },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[DESENFILEIRAR] ❌ Erro:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers }
    );
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * LISTAR FILA - Retorna threads na fila com tempo de espera
 * ═══════════════════════════════════════════════════════════════
 */
async function listarFila(base44, data, headers) {
  const { setor, whatsapp_integration_id } = data;

  console.log('[LISTAR-FILA] 📋 Listando fila:', { setor, whatsapp_integration_id });

  try {
    const filtro = { removido_da_fila: false };
    
    if (setor) filtro.setor = setor;
    if (whatsapp_integration_id) filtro.whatsapp_integration_id = whatsapp_integration_id;

    const fila = await base44.asServiceRole.entities.FilaAtendimento.filter(
      filtro,
      'entrou_em', // FIFO
      200
    );

    // Calcular tempo de espera em tempo real para cada item
    const agora = Date.now();
    const filaComTempoEspera = fila.map((item, index) => {
      const tempoEsperaSegundos = Math.floor(
        (agora - new Date(item.entrou_em).getTime()) / 1000
      );
      
      return {
        ...item,
        posicao_fila: index + 1,
        tempo_espera_segundos: tempoEsperaSegundos,
        tempo_espera_formatado: formatarTempoEspera(tempoEsperaSegundos)
      };
    });

    console.log('[LISTAR-FILA] ✅ Fila carregada:', filaComTempoEspera.length, 'threads');

    return Response.json(
      { success: true, fila: filaComTempoEspera, total: filaComTempoEspera.length },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[LISTAR-FILA] ❌ Erro:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers }
    );
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * REMOVER DA FILA - Remove uma thread específica
 * ═══════════════════════════════════════════════════════════════
 */
async function removerDaFila(base44, data, headers) {
  const { thread_id, motivo = 'cancelado' } = data;

  console.log('[REMOVER-FILA] 🗑️ Removendo thread:', { thread_id, motivo });

  try {
    const filaEntries = await base44.asServiceRole.entities.FilaAtendimento.filter({
      thread_id: thread_id,
      removido_da_fila: false
    });

    if (filaEntries.length === 0) {
      return Response.json(
        { success: false, message: 'Thread não está na fila' },
        { status: 200, headers }
      );
    }

    await base44.asServiceRole.entities.FilaAtendimento.update(filaEntries[0].id, {
      removido_da_fila: true,
      motivo_remocao: motivo,
      atendido_em: new Date().toISOString()
    });

    console.log('[REMOVER-FILA] ✅ Thread removida da fila');

    return Response.json(
      { success: true },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[REMOVER-FILA] ❌ Erro:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers }
    );
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * ESTATÍSTICAS - Retorna métricas agregadas das filas
 * ═══════════════════════════════════════════════════════════════
 */
async function obterEstatisticas(base44, data, headers) {
  console.log('[ESTATISTICAS] 📊 Calculando estatísticas das filas');

  try {
    const todasFilas = await base44.asServiceRole.entities.FilaAtendimento.filter(
      { removido_da_fila: false },
      'entrou_em',
      500
    );

    const agora = Date.now();
    
    // Estatísticas globais
    const stats = {
      total_na_fila: todasFilas.length,
      por_setor: {},
      por_conexao: {},
      por_prioridade: {
        urgente: 0,
        alta: 0,
        normal: 0,
        baixa: 0
      },
      tempo_medio_espera_segundos: 0,
      tempo_max_espera_segundos: 0,
      threads_acima_5min: 0,
      threads_acima_10min: 0
    };

    let somaTempoEspera = 0;

    todasFilas.forEach(item => {
      const tempoEspera = Math.floor((agora - new Date(item.entrou_em).getTime()) / 1000);
      
      // Por setor
      stats.por_setor[item.setor] = (stats.por_setor[item.setor] || 0) + 1;
      
      // Por conexão
      stats.por_conexao[item.nome_conexao] = (stats.por_conexao[item.nome_conexao] || 0) + 1;
      
      // Por prioridade
      stats.por_prioridade[item.prioridade]++;
      
      // Tempos
      somaTempoEspera += tempoEspera;
      if (tempoEspera > stats.tempo_max_espera_segundos) {
        stats.tempo_max_espera_segundos = tempoEspera;
      }
      
      if (tempoEspera > 300) stats.threads_acima_5min++;
      if (tempoEspera > 600) stats.threads_acima_10min++;
    });

    if (todasFilas.length > 0) {
      stats.tempo_medio_espera_segundos = Math.floor(somaTempoEspera / todasFilas.length);
    }

    console.log('[ESTATISTICAS] ✅ Estatísticas calculadas:', stats);

    return Response.json(
      { success: true, estatisticas: stats },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[ESTATISTICAS] ❌ Erro:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers }
    );
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * UTILITÁRIOS
 * ═══════════════════════════════════════════════════════════════
 */
function formatarTempoEspera(segundos) {
  if (segundos < 60) return `${segundos}s`;
  if (segundos < 3600) return `${Math.floor(segundos / 60)}min`;
  return `${Math.floor(segundos / 3600)}h ${Math.floor((segundos % 3600) / 60)}min`;
}