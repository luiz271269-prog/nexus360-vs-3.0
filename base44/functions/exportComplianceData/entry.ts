/**
 * ═══════════════════════════════════════════════════════════
 * EXPORT COMPLIANCE DATA - VendaPro
 * ═══════════════════════════════════════════════════════════
 * 
 * Função backend que coleta dados de compliance e os envia
 * para o Google Sheets via webhook.
 * 
 * Pode ser chamada:
 * - Manualmente via UI
 * - Via Cron (agendamento)
 * - Via API externa
 */

import { createClient } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    console.log('[EXPORT COMPLIANCE] 📊 Iniciando exportação de dados...');
    
    // Inicializar cliente Base44
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      Deno.env.get('BASE44_API_KEY')
    );
    
    // Coletar dados de compliance
    console.log('[EXPORT COMPLIANCE] 🔍 Coletando dados...');
    
    const [contatos, threads, integracoes] = await Promise.all([
      base44.entities.Contact.list(),
      base44.entities.MessageThread.list(),
      base44.entities.WhatsAppIntegration.list()
    ]);
    
    // Calcular métricas de conformidade
    const totalContatos = contatos.length;
    const contatosComOptin = contatos.filter(c => c.whatsapp_optin).length;
    const percentualOptin = totalContatos > 0 
      ? Math.round((contatosComOptin / totalContatos) * 100) 
      : 0;
    
    // Janela 24h
    const agora = new Date();
    const threadsDentroJanela = threads.filter(t => {
      if (!t.janela_24h_expira_em) return false;
      return new Date(t.janela_24h_expira_em) > agora;
    }).length;
    
    const threadsForaJanela = threads.filter(t => {
      if (!t.janela_24h_expira_em) return true;
      return new Date(t.janela_24h_expira_em) <= agora;
    }).length;
    
    const duasHoras = 2 * 60 * 60 * 1000;
    const threadsExpirandoEmBreve = threads.filter(t => {
      if (!t.janela_24h_expira_em) return false;
      const expira = new Date(t.janela_24h_expira_em);
      const diff = expira - agora;
      return diff > 0 && diff < duasHoras;
    }).length;
    
    // Status das integrações
    const integracoesConectadas = integracoes.filter(i => i.status === 'conectado').length;
    
    // Taxa de resposta rápida (< 1h)
    const threadsComResposta = threads.filter(t => 
      t.tempo_primeira_resposta_minutos !== null && 
      t.tempo_primeira_resposta_minutos < 60
    ).length;
    
    const taxaRespostaRapida = threads.length > 0 
      ? Math.round((threadsComResposta / threads.length) * 100) 
      : 0;
    
    // Montar payload
    const payload = {
      tipo: 'compliance',
      dados: {
        conformidade: {
          totalContatos,
          contatosComOptin,
          percentualOptin,
          contatosSemOptin: totalContatos - contatosComOptin
        },
        janela24h: {
          threadsDentroJanela,
          threadsForaJanela,
          threadsExpirandoEmBreve
        },
        integracoes: {
          total: integracoes.length,
          conectadas: integracoesConectadas,
          desconectadas: integracoes.length - integracoesConectadas
        },
        performance: {
          taxaRespostaRapida,
          tempoMedioResposta: calcularTempoMedioResposta(threads)
        }
      }
    };
    
    // Enviar para Google Sheets
    const webhookUrl = Deno.env.get('GOOGLE_SHEET_WEBHOOK');
    
    if (!webhookUrl) {
      throw new Error('Secret GOOGLE_SHEET_WEBHOOK não configurada');
    }
    
    console.log('[EXPORT COMPLIANCE] 📤 Enviando para Google Sheets...');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao enviar dados: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('[EXPORT COMPLIANCE] ✅ Dados exportados com sucesso!');
    
    return Response.json({
      success: true,
      message: 'Dados de compliance exportados com sucesso',
      metricas: payload.dados,
      googleSheets: result
    });
    
  } catch (error) {
    console.error('[EXPORT COMPLIANCE] ❌ Erro:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

/**
 * Calcula tempo médio de resposta em minutos
 */
function calcularTempoMedioResposta(threads) {
  const tempos = threads
    .filter(t => t.tempo_primeira_resposta_minutos !== null)
    .map(t => t.tempo_primeira_resposta_minutos);
  
  if (tempos.length === 0) return 0;
  
  const soma = tempos.reduce((acc, t) => acc + t, 0);
  return Math.round(soma / tempos.length);
}