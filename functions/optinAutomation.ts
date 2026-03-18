/**
 * ═══════════════════════════════════════════════════════════
 * OPT-IN AUTOMATION - VendaPro
 * ═══════════════════════════════════════════════════════════
 * 
 * Cron job que identifica contatos sem opt-in e envia
 * templates de solicitação de consentimento automaticamente.
 * 
 * Execução: A cada 6 horas
 * 
 * Fluxo:
 * 1. Buscar contatos com whatsapp_optin = false ou null
 * 2. Verificar se já não foi enviado opt-in recentemente (últimas 24h)
 * 3. Enviar template de opt-in aprovado pela Meta
 * 4. Registrar no AutomationLog
 */

import { createClient } from 'npm:@base44/sdk@0.7.1';

// Configurar cron para executar a cada 6 horas
Deno.cron("Opt-in Automation", "0 */6 * * *", async () => {
  await executarOptinAutomation();
});

// Também permitir execução manual via HTTP
Deno.serve(async (req) => {
  if (req.method === 'POST') {
    const resultado = await executarOptinAutomation();
    return Response.json(resultado);
  }
  
  return Response.json({
    message: 'Cron de Opt-in Automation ativo',
    proxima_execucao: 'A cada 6 horas',
    execucao_manual: 'POST para esta URL'
  });
});

async function executarOptinAutomation() {
  console.log('[OPT-IN AUTOMATION] 🤖 Iniciando execução...');
  
  const startTime = Date.now();
  
  try {
    // Inicializar cliente Base44
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      Deno.env.get('BASE44_API_KEY')
    );
    
    // 1. Buscar contatos sem opt-in
    console.log('[OPT-IN AUTOMATION] 🔍 Buscando contatos sem opt-in...');
    
    const contatosSemOptin = await base44.entities.Contact.filter({
      whatsapp_optin: { $ne: true }
    });
    
    console.log(`[OPT-IN AUTOMATION] 📊 ${contatosSemOptin.length} contatos encontrados`);
    
    if (contatosSemOptin.length === 0) {
      return {
        success: true,
        message: 'Nenhum contato sem opt-in encontrado',
        processados: 0
      };
    }
    
    // 2. Filtrar contatos que já receberam opt-in nas últimas 24h
    const umDiaAtras = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    const logsRecentes = await base44.entities.AutomationLog.filter({
      acao: 'envio_optin',
      timestamp: { $gte: umDiaAtras.toISOString() }
    });
    
    const contatosComEnvioRecente = new Set(
      logsRecentes.map(log => log.contato_id)
    );
    
    const contatosElegiveis = contatosSemOptin.filter(
      contato => !contatosComEnvioRecente.has(contato.id)
    );
    
    console.log(`[OPT-IN AUTOMATION] ✅ ${contatosElegiveis.length} elegíveis para envio`);
    
    // 3. Buscar template de opt-in aprovado
    const templates = await base44.entities.WhatsAppTemplate.filter({
      categoria: 'UTILITY',
      status_meta: 'aprovado',
      ativo: true
    });
    
    const templateOptin = templates.find(t => 
      t.nome.toLowerCase().includes('optin') || 
      t.nome.toLowerCase().includes('consentimento')
    );
    
    if (!templateOptin) {
      console.warn('[OPT-IN AUTOMATION] ⚠️ Nenhum template de opt-in encontrado');
      return {
        success: false,
        message: 'Template de opt-in não encontrado',
        processados: 0
      };
    }
    
    // 4. Buscar integração ativa
    const integracoes = await base44.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });
    
    if (integracoes.length === 0) {
      throw new Error('Nenhuma integração WhatsApp conectada');
    }
    
    const integracao = integracoes[0];
    
    // 5. Processar cada contato
    let enviados = 0;
    let erros = 0;
    
    for (const contato of contatosElegiveis.slice(0, 10)) { // Limitar a 10 por execução
      try {
        console.log(`[OPT-IN AUTOMATION] 📤 Enviando para ${contato.nome}...`);
        
        // Preparar variáveis do template
        const variaveis = {
          '1': contato.nome || 'Cliente'
        };
        
        // Enviar via função enviarWhatsApp
        const resultado = await base44.functions.invoke('enviarWhatsApp', {
          integration_id: integracao.id,
          numero_destino: contato.telefone,
          template_name: templateOptin.nome,
          template_variables: variaveis
        });
        
        if (resultado.data.success) {
          enviados++;
          
          // Registrar sucesso no AutomationLog
          await base44.entities.AutomationLog.create({
            acao: 'envio_optin',
            contato_id: contato.id,
            integracao_id: integracao.id,
            resultado: 'sucesso',
            timestamp: new Date().toISOString(),
            origem: 'cron',
            prioridade: 'normal',
            detalhes: {
              mensagem: 'Template de opt-in enviado com sucesso',
              template_id: templateOptin.id,
              template_name: templateOptin.nome,
              tempo_execucao_ms: Date.now() - startTime
            }
          });
          
        } else {
          throw new Error(resultado.data.error || 'Erro ao enviar');
        }
        
        // Delay de 2s entre envios (rate limiting)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        erros++;
        console.error(`[OPT-IN AUTOMATION] ❌ Erro ao enviar para ${contato.nome}:`, error.message);
        
        // Registrar erro no AutomationLog
        await base44.entities.AutomationLog.create({
          acao: 'envio_optin',
          contato_id: contato.id,
          integracao_id: integracao.id,
          resultado: 'erro',
          timestamp: new Date().toISOString(),
          origem: 'cron',
          prioridade: 'normal',
          detalhes: {
            mensagem: 'Erro ao enviar template de opt-in',
            erro_codigo: 'SEND_ERROR',
            erro_mensagem: error.message,
            template_id: templateOptin.id,
            tempo_execucao_ms: Date.now() - startTime
          }
        });
      }
    }
    
    const duracao = Date.now() - startTime;
    
    console.log(`[OPT-IN AUTOMATION] ✅ Concluído em ${duracao}ms`);
    console.log(`[OPT-IN AUTOMATION] 📊 Enviados: ${enviados} | Erros: ${erros}`);
    
    return {
      success: true,
      message: 'Opt-in automation executado',
      estatisticas: {
        contatos_sem_optin: contatosSemOptin.length,
        elegiveis: contatosElegiveis.length,
        enviados,
        erros,
        duracao_ms: duracao
      }
    };
    
  } catch (error) {
    console.error('[OPT-IN AUTOMATION] ❌ Erro fatal:', error);
    
    return {
      success: false,
      message: 'Erro na automação de opt-in',
      error: error.message,
      stack: error.stack
    };
  }
}