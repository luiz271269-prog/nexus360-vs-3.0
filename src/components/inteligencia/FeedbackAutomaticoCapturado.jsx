import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CAPTURADOR AUTOMÁTICO DE FEEDBACK - VERSÃO OTIMIZADA       ║
 * ║  ✅ Execução controlada (não sobrecarrega o sistema)        ║
 * ║  ✅ Tratamento robusto de erros                             ║
 * ║  ✅ Fallback silencioso (não quebra a aplicação)            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export default function FeedbackAutomaticoCapturado() {
  
  useEffect(() => {
    console.log('[FeedbackAuto] 🎯 Monitor iniciado (modo observação)');
    
    // ═══════════════════════════════════════════════════════════
    // 🔄 VARREDURA PERIÓDICA (A CADA 30 MINUTOS)
    // ═══════════════════════════════════════════════════════════
    const executarVarredura = async () => {
      try {
        console.log('[FeedbackAuto] 🔍 Iniciando varredura silenciosa...');

        // ✅ VERIFICAR SE SDK ESTÁ PRONTO
        const isAuthenticated = await base44.auth.isAuthenticated().catch(() => false);
        if (!isAuthenticated) {
          console.log('[FeedbackAuto] ⏭️ Usuário não autenticado, pulando varredura');
          return;
        }

        // ═══════════════════════════════════════════════════════════
        // 1️⃣ MONITORAR APENAS TAREFAS RECENTES (ÚLTIMAS 10)
        // ═══════════════════════════════════════════════════════════
        try {
          const tarefasConcluidas = await base44.entities.TarefaInteligente.filter({
            status: 'concluida'
          }, '-updated_date', 10); // LIMITADO a 10 tarefas

          console.log(`[FeedbackAuto] 📋 ${tarefasConcluidas.length} tarefas concluídas encontradas`);

          // Processar apenas tarefas sem feedback registrado
          for (const tarefa of tarefasConcluidas) {
            if (!tarefa.resultado_execucao) continue;

            // Verificar se já tem conhecimento (LIMITADO a 1 consulta)
            const conhecimentoExistente = await base44.entities.BaseConhecimento.filter({
              entidade_origem: 'TarefaInteligente',
              id_entidade_origem: tarefa.id
            }, null, 1);

            if (conhecimentoExistente.length === 0) {
              // Registrar feedback silenciosamente
              await base44.entities.BaseConhecimento.create({
                titulo: `Resultado: ${tarefa.titulo}`,
                tipo_registro: 'resultado_acao',
                categoria: 'estrategia',
                conteudo: `Tarefa concluída: ${tarefa.resultado_execucao.resultado}`,
                conteudo_estruturado: {
                  tarefa_id: tarefa.id,
                  resultado: tarefa.resultado_execucao.resultado,
                  sucesso: tarefa.resultado_execucao.sucesso
                },
                entidade_origem: 'TarefaInteligente',
                id_entidade_origem: tarefa.id,
                relevancia_score: tarefa.resultado_execucao.sucesso ? 70 : 40,
                tags: ['feedback_auto', tarefa.tipo_tarefa],
                ativo: true
              });

              console.log(`[FeedbackAuto] ✅ Feedback registrado: ${tarefa.id}`);
              
              // ⚠️ BREAK APÓS 1 REGISTRO (evitar sobrecarga)
              break;
            }
          }
        } catch (error) {
          console.warn('[FeedbackAuto] ⚠️ Erro ao processar tarefas:', error.message);
        }

        // ═══════════════════════════════════════════════════════════
        // 2️⃣ MONITORAR VENDAS RECENTES (ÚLTIMAS 5)
        // ═══════════════════════════════════════════════════════════
        try {
          const vendas = await base44.entities.Venda.list('-created_date', 5);
          
          for (const venda of vendas) {
            // Verificar se já registrou esse sucesso
            const conhecimentoExistente = await base44.entities.BaseConhecimento.filter({
              'conteudo_estruturado.venda_id': venda.id
            }, null, 1);

            if (conhecimentoExistente.length === 0 && venda.cliente_nome) {
              // Registrar sucesso de venda
              await base44.entities.BaseConhecimento.create({
                titulo: `✅ Venda: ${venda.cliente_nome}`,
                tipo_registro: 'resultado_acao',
                categoria: 'estrategia',
                conteudo: `Venda fechada no valor de R$ ${venda.valor_total}`,
                conteudo_estruturado: {
                  venda_id: venda.id,
                  venda_fechada: true,
                  valor: venda.valor_total,
                  cliente: venda.cliente_nome
                },
                entidade_origem: 'Venda',
                id_entidade_origem: venda.id,
                relevancia_score: 100,
                taxa_sucesso: 100,
                tags: ['venda', 'sucesso', 'conversao'],
                ativo: true
              });

              console.log(`[FeedbackAuto] 🎉 Venda registrada: ${venda.cliente_nome}`);
              
              // ⚠️ BREAK APÓS 1 REGISTRO
              break;
            }
          }
        } catch (error) {
          console.warn('[FeedbackAuto] ⚠️ Erro ao processar vendas:', error.message);
        }

        console.log('[FeedbackAuto] ✅ Varredura concluída');

      } catch (error) {
        // ✅ SILENCIOSO: Não mostrar erros ao usuário
        console.warn('[FeedbackAuto] ⚠️ Erro na varredura:', error.message);
      }
    };

    // ═══════════════════════════════════════════════════════════
    // ⏰ AGENDAMENTO: A CADA 30 MINUTOS (não 5)
    // ═══════════════════════════════════════════════════════════
    const interval = setInterval(executarVarredura, 30 * 60 * 1000);
    
    // Executar primeira varredura após 2 minutos (não imediatamente)
    const primeiraVarredura = setTimeout(executarVarredura, 2 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(primeiraVarredura);
    };
  }, []);

  // Componente invisível (não renderiza nada)
  return null;
}