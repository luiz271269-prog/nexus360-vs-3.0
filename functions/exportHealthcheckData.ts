/**
 * ═══════════════════════════════════════════════════════════
 * EXPORT HEALTHCHECK DATA - VendaPro
 * ═══════════════════════════════════════════════════════════
 * 
 * Função backend que coleta dados de healthcheck do sistema
 * e os envia para o Google Sheets via webhook.
 */

import { createClient } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    console.log('[EXPORT HEALTHCHECK] 📊 Iniciando exportação...');
    
    // Inicializar cliente Base44
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      Deno.env.get('BASE44_API_KEY')
    );
    
    // Buscar logs de health recentes (últimas 24h)
    const healthLogs = await base44.entities.SystemHealthLog.list('-timestamp', 100);
    
    const agora = new Date();
    const umDiaAtras = new Date(agora - (24 * 60 * 60 * 1000));
    
    const logsRecentes = healthLogs.filter(log => 
      new Date(log.timestamp) > umDiaAtras
    );
    
    // Agrupar por componente
    const componentes = ['whatsapp_z_api', 'webhook_inbound', 'database', 'llm_integration'];
    
    const webhookUrl = Deno.env.get('GOOGLE_SHEET_WEBHOOK');
    
    if (!webhookUrl) {
      throw new Error('Secret GOOGLE_SHEET_WEBHOOK não configurada');
    }
    
    let totalEnviados = 0;
    
    // Enviar dados de cada componente
    for (const componente of componentes) {
      const logsComponente = logsRecentes.filter(log => log.componente === componente);
      
      if (logsComponente.length === 0) continue;
      
      // Pegar o log mais recente
      const logMaisRecente = logsComponente[0];
      
      // Calcular métricas das últimas 24h
      const totalRequisicoes = logsComponente.length;
      const sucesses = logsComponente.filter(l => l.status === 'operacional').length;
      const taxaSucesso = totalRequisicoes > 0 
        ? Math.round((sucesses / totalRequisicoes) * 100) 
        : 0;
      
      const payload = {
        tipo: 'healthcheck',
        dados: {
          timestamp: logMaisRecente.timestamp,
          componente: logMaisRecente.componente,
          status: logMaisRecente.status,
          tempo_resposta_ms: logMaisRecente.tempo_resposta_ms || 0,
          detalhes_verificacao: logMaisRecente.detalhes_verificacao || {},
          metricas_adicionais: {
            taxa_sucesso_ultimas_24h: taxaSucesso,
            total_requisicoes_24h: totalRequisicoes,
            tempo_medio_resposta_24h: calcularTempoMedio(logsComponente)
          }
        }
      };
      
      // Enviar para Google Sheets
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        totalEnviados++;
        console.log(`[EXPORT HEALTHCHECK] ✅ ${componente} exportado`);
      }
    }
    
    return Response.json({
      success: true,
      message: `${totalEnviados} componentes exportados com sucesso`,
      componentes: totalEnviados
    });
    
  } catch (error) {
    console.error('[EXPORT HEALTHCHECK] ❌ Erro:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

function calcularTempoMedio(logs) {
  const tempos = logs
    .filter(l => l.tempo_resposta_ms)
    .map(l => l.tempo_resposta_ms);
  
  if (tempos.length === 0) return 0;
  
  const soma = tempos.reduce((acc, t) => acc + t, 0);
  return Math.round(soma / tempos.length);
}