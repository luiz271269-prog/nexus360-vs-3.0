import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * 🚨 PROTETOR CONTRA BLOQUEIO DE META
 * 
 * Monitora:
 * 1. Taxa de envios por minuto (evita throttling)
 * 2. Threads órfãs (integração quebrada)
 * 3. Falhas de envio consecutivas
 * 4. Quotas de API por integração
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('[PROTETOR] 🔍 Verificando riscos de bloqueio...');

    // 1️⃣ ANÁLISE DE TAXA DE ENVIO
    const umMinutoAtras = new Date(Date.now() - 60000).toISOString();
    const mensagensUmMinuto = await base44.asServiceRole.entities.Message.filter({
      sent_at: { $gte: umMinutoAtras },
      sender_type: 'user'
    });

    const taxaEnvio = mensagensUmMinuto.length;
    const estaThrottled = taxaEnvio > 50; // ⚠️ Limite seguro

    // 2️⃣ DETECTAR THREADS ÓRFÃS
    const todasThreads = await base44.asServiceRole.entities.MessageThread.filter({
      status: 'aberta',
      contact_id: { $ne: null }
    }, '-updated_date', 100);

    const threadCheck = await Promise.all(
      todasThreads.slice(0, 20).map(async (thread) => {
        if (!thread.whatsapp_integration_id && !thread.instagram_integration_id) {
          return { thread_id: thread.id, orfao: true };
        }
        
        // Verificar se integração ainda existe
        let integracaoExiste = false;
        if (thread.whatsapp_integration_id) {
          const integ = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
            id: thread.whatsapp_integration_id
          });
          integracaoExiste = integ.length > 0;
        }
        
        return { thread_id: thread.id, orfao: !integracaoExiste };
      })
    );

    const threadsOrfas = threadCheck.filter(t => t.orfao).length;

    // 3️⃣ VERIFICAR FALHAS CONSECUTIVAS
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60000).toISOString();
    const falhasRecentes = await base44.asServiceRole.entities.Message.filter({
      status: 'falhou',
      created_date: { $gte: cincoMinutosAtras },
      sender_type: 'user'
    });

    const taxaFalha = falhasRecentes.length / (mensagensUmMinuto.length || 1);
    const temMuitasfalhas = taxaFalha > 0.2; // >20% é crítico

    // 4️⃣ QUOTA POR INTEGRAÇÃO
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });

    const quotaStatus = await Promise.all(
      integracoes.map(async (integ) => {
        const msgsSemaHora = await base44.asServiceRole.entities.Message.filter({
          metadata: { whatsapp_integration_id: integ.id },
          created_date: { $gte: new Date(Date.now() - 3600000).toISOString() }
        });

        return {
          integracao: integ.nome_instancia,
          mensagens_hora: msgsSemaHora.length,
          risco: msgsSemaHora.length > 80 // Meta WhatsApp = ~100/hora
        };
      })
    );

    // 5️⃣ RELATÓRIO DE RISCO
    const riscos = {
      CRITICO: [],
      AVISO: [],
      OK: []
    };

    if (estaThrottled) {
      riscos.CRITICO.push({
        tipo: 'TAXA_ENVIO',
        valor: `${taxaEnvio} mensagens/min`,
        limite: '50/min',
        acao: '⛔ PAUSAR envios em lote por 1 minuto'
      });
    }

    if (threadsOrfas > 5) {
      riscos.CRITICO.push({
        tipo: 'THREADS_ORFAS',
        valor: `${threadsOrfas} threads sem integração`,
        acao: '⚙️ Reconfigurar integrações quebradas'
      });
    }

    if (temMuitasfalhas) {
      riscos.CRITICO.push({
        tipo: 'TAXA_FALHA',
        valor: `${(taxaFalha * 100).toFixed(1)}% falha`,
        limite: '<20%',
        acao: '🔍 Verificar status de APIs'
      });
    }

    quotaStatus.forEach(qs => {
      if (qs.risco) {
        riscos.AVISO.push({
          tipo: 'QUOTA_INTEGRACAO',
          integracao: qs.integracao,
          valor: `${qs.mensagens_hora} msgs/hora`,
          acao: '📊 Distribuir carga entre integrações'
        });
      }
    });

    if (riscos.CRITICO.length === 0 && riscos.AVISO.length === 0) {
      riscos.OK.push('✅ Nenhum risco detectado');
    }

    // 6️⃣ RECOMENDAÇÕES AUTOMÁTICAS
    const recomendacoes = [];

    if (estaThrottled) {
      recomendacoes.push({
        acao: 'THROTTLE_AUTOMATICO',
        duracao_segundos: 60,
        proximaTentativa: new Date(Date.now() + 60000).toISOString(),
        motivo: 'Taxa de envio acima do limite'
      });
    }

    if (threadsOrfas > 0) {
      recomendacoes.push({
        acao: 'REPARAR_THREADS',
        threads_afetadas: threadsOrfas,
        motivo: 'Integração não existe ou foi removida'
      });
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      metricas: {
        taxa_envio_minuto: taxaEnvio,
        threads_orfas: threadsOrfas,
        falhas_percentual: (taxaFalha * 100).toFixed(1),
        integracoes_risco: quotaStatus.filter(q => q.risco).length
      },
      riscos,
      recomendacoes,
      saude_geral: riscos.CRITICO.length === 0 ? '🟢 SAUDÁVEL' : '🔴 CRÍTICO'
    });

  } catch (error) {
    console.error('[PROTETOR] ❌ Erro:', error.message);
    return Response.json({ 
      success: false,
      error: error.message,
      saude_geral: '❌ ERRO NA VERIFICAÇÃO'
    }, { status: 500 });
  }
});