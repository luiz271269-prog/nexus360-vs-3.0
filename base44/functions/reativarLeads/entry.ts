import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SKILL SDR: Reativar Leads Frios
 * Envia mensagens personalizadas de reativação baseadas em classificação
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const _tsInicio = Date.now(); // SkillExecution: medir duration_ms
    
    const body = await req.json().catch(() => ({}));
    const { 
      leads = [],
      modo = 'preview', // 'preview' | 'automatico'
      whatsapp_integration_id = null
    } = body;
    
    console.log(`[REATIVAR_LEADS] Modo: ${modo} | Leads: ${leads.length}`);
    
    if (leads.length === 0) {
      return Response.json({
        success: false,
        error: 'Nenhum lead fornecido'
      }, { status: 400 });
    }
    
    const detalhes = [];
    let total_enviados = 0;
    let total_erros = 0;
    
    // Carregar templates
    const templates = await carregarTemplatesReativacao(base44);
    
    for (const lead of leads) {
      try {
        const contact = await base44.asServiceRole.entities.Contact.get(lead.contact_id);
        if (!contact) {
          console.warn(`[REATIVAR_LEADS] Contato ${lead.contact_id} não encontrado`);
          continue;
        }
        
        const threads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: lead.contact_id,
          is_canonical: true
        }, null, 1);
        
        const thread = threads[0];
        if (!thread) {
          console.warn(`[REATIVAR_LEADS] Thread não encontrada para ${contact.nome}`);
          continue;
        }
        
        // Selecionar template
        const template = selecionarTemplate(templates, lead.classificacao, lead);
        
        const mensagem = personalizarMensagem(template, {
          nome: contact.nome?.split(' ')[0] || 'cliente',
          dias_sem_contato: lead.dias_sem_contato || 30,
          valor_orcamento: lead.valor_orcamentos_abertos || 0
        });
        
        if (modo === 'automatico') {
          // Enviar mensagem real
          const integrationId = whatsapp_integration_id || thread.whatsapp_integration_id;
          
          if (!integrationId) {
            console.warn(`[REATIVAR_LEADS] Sem integração WhatsApp para ${contact.nome}`);
            total_erros++;
            continue;
          }
          
          await base44.asServiceRole.functions.invoke('enviarMensagemUnificada', {
            contact_id: contact.id,
            thread_id: thread.id,
            whatsapp_integration_id: integrationId,
            message: mensagem
          });
          
          total_enviados++;
          
          // Registrar em AutomationLog
          await base44.asServiceRole.entities.AutomationLog.create({
            automation_type: 'reativacao_lead',
            contact_id: contact.id,
            thread_id: thread.id,
            action_taken: 'mensagem_enviada',
            details: {
              classificacao: lead.classificacao,
              template_usado: template.nome,
              modo
            }
          });
          
          // Delay anti-spam
          await new Promise(r => setTimeout(r, 800));
        }
        
        detalhes.push({
          contact_id: contact.id,
          nome: contact.nome,
          classificacao: lead.classificacao,
          mensagem_preview: mensagem,
          enviado: modo === 'automatico'
        });
        
      } catch (error) {
        console.error(`[REATIVAR_LEADS] Erro ao processar lead ${lead.contact_id}:`, error.message);
        total_erros++;
      }
    }
    
    console.log(`[REATIVAR_LEADS] ✅ Concluído: ${total_enviados} enviados, ${total_erros} erros`);
    
    // Registrar execução
    ;(async () => {
      try {
        await base44.asServiceRole.entities.SkillExecution.create({
          skill_name: 'reativar_leads',
          triggered_by: 'user_action',
          execution_mode: modo === 'automatico' ? 'copilot' : 'autonomous_safe',
          context: {
            total_leads: leads.length,
            modo,
            whatsapp_integration_id
          },
          success: true,
          duration_ms: Date.now() - _tsInicio,
          metricas: {
            total_leads: leads.length,
            total_enviados,
            total_erros,
            modo
          }
        });
      } catch (e) {
        console.warn('[reativarLeads] SkillExecution falhou (non-blocking):', e.message);
      }
    })();
    
    return Response.json({
      success: true,
      total_enviados,
      total_erros,
      detalhes
    });
    
  } catch (error) {
    console.error('[REATIVAR_LEADS] Erro crítico:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

// ============ FUNÇÕES AUXILIARES ============

async function carregarTemplatesReativacao(base44: any) {
  try {
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: 'templates_reativacao'
    }, null, 1);
    
    if (configs[0]?.valor) return configs[0].valor;
  } catch (error) {
    console.warn('[REATIVAR_LEADS] Usando templates padrão:', error.message);
  }
  
  // Templates padrão
  return {
    alto_potencial: {
      nome: 'alto_potencial_com_orcamento',
      texto: 'Oi {nome}! 👋 Vi que estamos negociando um orçamento de {valor_orcamento}. Posso te ajudar a finalizar? 😊'
    },
    medio_potencial: {
      nome: 'medio_potencial_generico',
      texto: 'Oi {nome}! Tudo bem? Faz {dias_sem_contato} dias que não conversamos. Há algo em que posso te ajudar? 💬'
    },
    baixo_potencial: {
      nome: 'baixo_potencial_checkin',
      texto: 'Oi {nome}! Como vão as coisas? Se precisar de algo, estamos por aqui! 👋✨'
    }
  };
}

function selecionarTemplate(templates: any, classificacao: string, lead: any) {
  if (classificacao === 'alto_potencial' && lead.valor_orcamentos_abertos > 0) {
    return templates.alto_potencial;
  }
  if (classificacao === 'medio_potencial') {
    return templates.medio_potencial;
  }
  return templates.baixo_potencial;
}

function personalizarMensagem(template: any, dados: any): string {
  return template.texto
    .replace('{nome}', dados.nome)
    .replace('{dias_sem_contato}', String(dados.dias_sem_contato))
    .replace('{valor_orcamento}', dados.valor_orcamento.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }));
}