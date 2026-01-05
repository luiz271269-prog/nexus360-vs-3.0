/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MOTOR DE LEMBRETES GLOBAL - VERSÃO OTIMIZADA              ║
 * ║  Reduz drasticamente o número de queries simultâneas        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { base44 } from "@/api/base44Client";

// Cache local para evitar queries repetidas
let cacheGlobal = null;
let ultimaAtualizacao = null;
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutos

/**
 * Calcula lembretes usando cache local para reduzir chamadas à API
 */
export async function calcularLembretesGlobal(usuario) {
  try {
    // Se tem cache válido, retornar imediatamente
    const agora = Date.now();
    if (cacheGlobal && ultimaAtualizacao && (agora - ultimaAtualizacao) < CACHE_DURATION) {
      console.log('[LEMBRETES GLOBAL] ✅ Usando cache local');
      return cacheGlobal;
    }

    console.log('[LEMBRETES GLOBAL] 🔄 Calculando lembretes (sem cache válido)...');
    
    const contadores = {
      Dashboard: 0,
      Orcamentos: 0,
      Clientes: 0,
      Vendedores: 0,
      Agenda: 0,
      Vendas: 0,
      Comunicacao: 0,
      Produtos: 0
    };

    // OTIMIZAÇÃO: Fazer queries em lotes menores e com delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // ═══════════════════════════════════════════════════════════
    // LOTE 1: Dados Críticos (Orçamentos + Tarefas)
    // ═══════════════════════════════════════════════════════════
    let orcamentos = [];
    let tarefas = [];
    
    try {
      [orcamentos, tarefas] = await Promise.all([
        base44.entities.Orcamento.list('-created_date', 50), // REDUZIDO de 200 para 50
        base44.entities.TarefaInteligente.filter({ 
          status: 'pendente',
          vendedor_responsavel: usuario.full_name 
        }, '-data_prazo', 20) // REDUZIDO
      ]);
    } catch (error) {
      console.warn('[LEMBRETES] ⚠️ Erro no lote 1:', error.message);
    }

    await delay(200); // Delay entre lotes

    // ═══════════════════════════════════════════════════════════
    // LOTE 2: Comunicação
    // ═══════════════════════════════════════════════════════════
    let threads = [];
    
    try {
      threads = await base44.entities.MessageThread.filter({ status: 'aberta' }, '-last_message_at', 20);
    } catch (error) {
      console.warn('[LEMBRETES] ⚠️ Erro no lote 2:', error.message);
    }

    await delay(200);

    // ═══════════════════════════════════════════════════════════
    // CÁLCULO DOS CONTADORES (Otimizado)
    // ═══════════════════════════════════════════════════════════
    const agoraDate = new Date(); // Renomeado para evitar conflito

    // ORÇAMENTOS
    orcamentos.forEach(orc => {
      if (!orc.created_date || !orc.status) return;
      
      const diasDesde = Math.floor(
        (agoraDate - new Date(orc.created_date)) / (1000 * 60 * 60 * 24)
      );

      if (
        (orc.status === 'aguardando_cotacao' && diasDesde > 5) ||
        (orc.status === 'aguardando_analise' && diasDesde > 7) ||
        (orc.status === 'liberado' && diasDesde > 3) ||
        (orc.status === 'enviado' && diasDesde > 7) ||
        (orc.status === 'negociando' && diasDesde > 14)
      ) {
        contadores.Orcamentos++;
      }
    });

    // AGENDA (Tarefas Críticas)
    const tarefasCriticas = tarefas.filter(t => t.prioridade === 'critica');
    contadores.Agenda = tarefasCriticas.length;

    const tarefasHoje = tarefas.filter(t => {
      if (!t.data_prazo) return false;
      const prazo = new Date(t.data_prazo);
      return prazo.toDateString() === agoraDate.toDateString();
    });
    contadores.Agenda += tarefasHoje.length;

    // COMUNICAÇÃO (Threads não lidas pelo usuário atual)
    const threadsNaoLidas = threads.filter(t => 
      t.last_message_sender === 'contact' && t.unread_by && t.unread_by[usuario.id] > 0
    );
    contadores.Comunicacao = threadsNaoLidas.reduce((sum, t) => sum + (t.unread_by[usuario.id] || 0), 0);

    // DASHBOARD (Resumo)
    contadores.Dashboard = Math.min(
      contadores.Orcamentos + 
      Math.min(contadores.Agenda, 5), 
      10
    );

    // Atualizar cache
    cacheGlobal = contadores;
    ultimaAtualizacao = agora;

    console.log('[LEMBRETES GLOBAL] ✅ Contadores calculados:', contadores);
    return contadores;

  } catch (error) {
    console.error('[LEMBRETES GLOBAL] ❌ Erro crítico:', error);
    
    // Retornar cache antigo se houver, ou zeros
    if (cacheGlobal) {
      console.log('[LEMBRETES GLOBAL] 🔄 Usando cache antigo devido a erro');
      return cacheGlobal;
    }
    
    return {
      Dashboard: 0,
      Orcamentos: 0,
      Clientes: 0,
      Vendedores: 0,
      Agenda: 0,
      Vendas: 0,
      Comunicacao: 0,
      Produtos: 0
    };
  }
}

/**
 * Limpa o cache manualmente (chamar após ações do usuário)
 */
export function limparCacheLembretes() {
  cacheGlobal = null;
  ultimaAtualizacao = null;
  console.log('[LEMBRETES GLOBAL] 🗑️ Cache limpo');
}