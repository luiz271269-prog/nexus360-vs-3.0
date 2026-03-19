import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// MOTOR DE DECISÃO DE PRÉ-ATENDIMENTO - v1.0.0
// ============================================================================
// Cérebro único que decide todo o roteamento ANTES de qualquer bot/menu
// Camadas:
// H - Horário de atendimento
// 1 - Continuidade (retorno rápido)
// 2 - Intenção (keywords/IA) [opcional]
// 3 - Fidelização
// Fallback - Pré-atendimento único com botões
// ============================================================================

const VERSION = 'v1.0.0';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================================================
// VERIFICAR HORÁRIO DE ATENDIMENTO
// ============================================================================
function verificarHorario(config) {
  const agora = new Date();
  const diaSemana = agora.getDay();
  const horaMinuto = agora.getHours() * 60 + agora.getMinutes();
  
  const diasAtendimento = config.dias_atendimento_semana || [1, 2, 3, 4, 5];
  if (!diasAtendimento.includes(diaSemana)) {
    return { dentroHorario: false, motivo: 'fora_dia_semana' };
  }
  
  const inicio = config.horario_atendimento_inicio || '08:00';
  const fim = config.horario_atendimento_fim || '18:00';
  
  const [hI, mI] = inicio.split(':').map(Number);
  const [hF, mF] = fim.split(':').map(Number);
  
  const minutoInicio = hI * 60 + mI;
  const minutoFim = hF * 60 + mF;
  
  if (horaMinuto < minutoInicio || horaMinuto > minutoFim) {
    return { dentroHorario: false, motivo: 'fora_horario' };
  }
  
  return { dentroHorario: true };
}

// ============================================================================
// BUSCAR ÚLTIMA THREAD (CONTINUIDADE)
// ============================================================================
async function buscarUltimaThread(base44, contact_id, integration_id, janela_horas) {
  try {
    const limiteData = new Date(Date.now() - janela_horas * 60 * 60 * 1000);
    
    const threads = await base44.asServiceRole.entities.MessageThread.filter({
      contact_id: contact_id,
      whatsapp_integration_id: integration_id
    }, '-last_message_at', 5);
    
    for (const thread of threads) {
      if (!thread.last_message_at) continue;
      
      const ultimaMsgData = new Date(thread.last_message_at);
      if (ultimaMsgData >= limiteData && thread.assigned_user_id) {
        return thread;
      }
    }
  } catch (e) {
    console.log('[MOTOR] ⚠️ Erro ao buscar última thread:', e?.message);
  }
  
  return null;
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return Response.json({ success: false, error: 'JSON inválido' }, { status: 400, headers: corsHeaders });
  }

  const { thread_id, contact_id, integration_id, texto } = payload;
  const inicio = Date.now();
  
  console.log(`[MOTOR ${VERSION}] 🧠 Iniciando decisão | Thread: ${thread_id}`);

  try {
    // Carregar dados básicos
    const [thread, contato] = await Promise.all([
      base44.asServiceRole.entities.MessageThread.get(thread_id),
      base44.asServiceRole.entities.Contact.get(contact_id)
    ]);

    if (!thread || !contato) {
      return Response.json({ success: false, error: 'thread_ou_contato_nao_encontrado' }, { headers: corsHeaders });
    }

    // ========================================================================
    // VERIFICAR FLAGS DO CONTATO (BYPASS IMEDIATO)
    // ========================================================================
    const ignorarPA = contato.pre_atendimento_ignorar === true;
    const forcarPA = contato.pre_atendimento_forcar === true;
    
    if (ignorarPA && !forcarPA) {
      console.log('[MOTOR] 🚫 Contato configurado para IGNORAR pré-atendimento');
      return Response.json({ 
        success: true, 
        decisao: 'ignorar_pa', 
        motivo: 'contato_ignorar_flag' 
      }, { headers: corsHeaders });
    }

    // Carregar configuração do motor
    let config;
    try {
      const configs = await base44.asServiceRole.entities.MotorDecisaoConfig.filter({
        integration_id: integration_id,
        ativo: true
      }, '-prioridade', 1);
      
      if (configs.length === 0) {
        const configsGlobal = await base44.asServiceRole.entities.MotorDecisaoConfig.filter({
          integration_id: null,
          ativo: true
        }, '-prioridade', 1);
        
        if (configsGlobal.length > 0) {
          config = configsGlobal[0];
        }
      } else {
        config = configs[0];
      }
    } catch (e) {
      console.log('[MOTOR] ⚠️ Erro ao carregar config:', e?.message);
    }

    // Se não tem config ou está desativado
    if (!config || config.ativo !== true) {
      console.log('[MOTOR] ⚠️ Motor desativado ou sem configuração');
      return Response.json({ 
        success: true, 
        decisao: 'motor_desativado' 
      }, { headers: corsHeaders });
    }

    // ========================================================================
    // CAMADA H - HORÁRIO DE ATENDIMENTO
    // ========================================================================
    const horario = verificarHorario(config);
    if (!horario.dentroHorario) {
      console.log('[MOTOR] ⏰ Fora de horário:', horario.motivo);

      // COOLDOWN: se já avisamos nas últimas 4h, não repetir
      const ultimaSaida = thread.last_outbound_at;
      if (ultimaSaida) {
        const horasDesdeUltimaSaida = (Date.now() - new Date(ultimaSaida).getTime()) / (1000 * 60 * 60);
        if (horasDesdeUltimaSaida < 4) {
          console.log(`[MOTOR] ⏭️ Cooldown ativo (${Math.round(horasDesdeUltimaSaida * 60)}min) — não repetindo mensagem de fora de horário`);
          return Response.json({
            success: true,
            decisao: 'fora_horario_cooldown',
            motivo: 'mensagem_ja_enviada_recentemente'
          }, { headers: corsHeaders });
        }
      }
      
      if (config.playbook_fora_horario_id) {
        // Iniciar playbook de fora de horário
        try {
          await base44.functions.invoke('executarPreAtendimento', {
            action: 'iniciar',
            thread_id: thread_id,
            contact_id: contact_id,
            integration_id: integration_id,
            playbook_override_id: config.playbook_fora_horario_id
          });
          
          return Response.json({
            success: true,
            decisao: 'fora_horario',
            playbook_id: config.playbook_fora_horario_id
          }, { headers: corsHeaders });
        } catch (e) {
          console.error('[MOTOR] ❌ Erro ao iniciar playbook fora de horário:', e?.message);
        }
      }
      
      return Response.json({
        success: true,
        decisao: 'fora_horario',
        sem_playbook: true
      }, { headers: corsHeaders });
    }

    // ========================================================================
    // CAMADA 1 - CONTINUIDADE
    // ========================================================================
    const ultimaThread = await buscarUltimaThread(
      base44, 
      contact_id, 
      integration_id, 
      config.janela_continuidade_horas || 48
    );
    
    if (ultimaThread && ultimaThread.assigned_user_id) {
      console.log('[MOTOR] 🔄 Continuidade detectada | Último atendente:', ultimaThread.assigned_user_name);
      
      const modoContinuidade = config.modo_continuidade || 'auto';
      
      if (modoContinuidade === 'auto') {
        // Modo AUTO: Retorna direto ao atendente
        await base44.asServiceRole.entities.MessageThread.update(thread_id, {
          assigned_user_id: ultimaThread.assigned_user_id,
          assigned_user_name: ultimaThread.assigned_user_name,
          assigned_user_email: ultimaThread.assigned_user_email,
          sector_id: ultimaThread.sector_id,
          motor_decisao_origem: 'continuidade_auto',
          motor_decisao_motivo: `Retorno ao atendente ${ultimaThread.assigned_user_name} (janela ${config.janela_continuidade_horas}h)`,
          motor_decisao_timestamp: new Date().toISOString()
        });
        
        console.log('[MOTOR] ✅ CAMADA 1: Continuidade AUTO');
        return Response.json({
          success: true,
          decisao: 'continuidade_auto',
          assigned_user_id: ultimaThread.assigned_user_id,
          duracao_ms: Date.now() - inicio
        }, { headers: corsHeaders });
      }
      
      if (modoContinuidade === 'perguntar') {
        // Modo PERGUNTAR: Pergunta ao cliente
        console.log('[MOTOR] ❓ CAMADA 1: Perguntando continuidade');
        
        await base44.asServiceRole.entities.MessageThread.update(thread_id, {
          pre_atendimento_state: 'WAITING_CONTINUITY_CHOICE',
          pre_atendimento_ativo: true,
          continuity_metadata: {
            last_assigned_user_id: ultimaThread.assigned_user_id,
            last_assigned_user_name: ultimaThread.assigned_user_name,
            last_sector: ultimaThread.sector_id
          }
        });
        
        // Chamar executarPreAtendimento para enviar a pergunta
        await base44.functions.invoke('executarPreAtendimento', {
          action: 'perguntar_continuidade',
          thread_id: thread_id,
          contact_id: contact_id,
          integration_id: integration_id,
          last_assigned_user_name: ultimaThread.assigned_user_name
        });
        
        return Response.json({
          success: true,
          decisao: 'perguntando_continuidade',
          duracao_ms: Date.now() - inicio
        }, { headers: corsHeaders });
      }
    }

    // ========================================================================
    // CAMADA 2 - INTENÇÃO (OPCIONAL - simplificada por hora)
    // ========================================================================
    // Aqui você poderia adicionar detecção de intenção por keywords/IA
    // Por hora, pulamos para manter simples

    // ========================================================================
    // CAMADA 3 - FIDELIZAÇÃO
    // ========================================================================
    if (config.usar_fidelizacao && !forcarPA) {
      // Verificar se tem vendedor responsável
      if (contato.vendedor_responsavel) {
        try {
          const vendedores = await base44.asServiceRole.entities.Vendedor.filter({
            nome: contato.vendedor_responsavel,
            status: 'ativo'
          }, '-created_date', 1);
          
          if (vendedores.length > 0) {
            const vendedor = vendedores[0];
            
            // Buscar User correspondente
            if (vendedor.email) {
              const users = await base44.asServiceRole.entities.User.filter({
                email: vendedor.email
              }, '-created_date', 1);
              
              if (users.length > 0) {
                const user = users[0];
                
                await base44.asServiceRole.entities.MessageThread.update(thread_id, {
                  assigned_user_id: user.id,
                  assigned_user_name: user.full_name,
                  assigned_user_email: user.email,
                  sector_id: 'vendas',
                  motor_decisao_origem: 'fidelizacao',
                  motor_decisao_motivo: `Vendedor responsável: ${user.full_name}`,
                  motor_decisao_timestamp: new Date().toISOString()
                });
                
                console.log('[MOTOR] ✅ CAMADA 3: Fidelização | Vendedor:', user.full_name);
                return Response.json({
                  success: true,
                  decisao: 'fidelizacao',
                  assigned_user_id: user.id,
                  duracao_ms: Date.now() - inicio
                }, { headers: corsHeaders });
              }
            }
          }
        } catch (e) {
          console.log('[MOTOR] ⚠️ Erro na camada de fidelização:', e?.message);
        }
      }
    }

    // ========================================================================
    // FALLBACK - PRÉ-ATENDIMENTO ÚNICO COM BOTÕES
    // ========================================================================
    console.log('[MOTOR] 📋 FALLBACK: Verificando playbooks de pré-atendimento ativos...');
    
    // ✅ VERIFICAR SE EXISTE PLAYBOOK ATIVO ANTES DE QUALQUER AÇÃO
    try {
      const playbooksAtivos = await base44.asServiceRole.entities.FlowTemplate.filter({
        is_pre_atendimento_padrao: true,
        ativo: true
      }, '-created_date', 1);
      
      if (!playbooksAtivos || playbooksAtivos.length === 0) {
        console.log('[MOTOR] 🚫 Nenhum playbook de pré-atendimento ATIVO - sistema bloqueado');
        return Response.json({
          success: true,
          decisao: 'pre_atendimento_desativado',
          motivo: 'nenhum_playbook_ativo',
          duracao_ms: Date.now() - inicio
        }, { headers: corsHeaders });
      }
      
      console.log('[MOTOR] ✅ Playbook ativo encontrado:', playbooksAtivos[0].nome);
      
      const playbookId = playbooksAtivos[0].id;
      
      await base44.functions.invoke('executarPreAtendimento', {
        action: 'iniciar',
        thread_id: thread_id,
        contact_id: contact_id,
        integration_id: integration_id,
        playbook_override_id: playbookId
      });
      
      return Response.json({
        success: true,
        decisao: 'pre_atendimento_botoes',
        playbook_id: playbookId,
        duracao_ms: Date.now() - inicio
      }, { headers: corsHeaders });
      
    } catch (e) {
      console.error('[MOTOR] ❌ Erro no fallback de pré-atendimento:', e?.message);
      return Response.json({
        success: false,
        error: e.message
      }, { status: 500, headers: corsHeaders });
    }

  } catch (error) {
    console.error(`[MOTOR ${VERSION}] ❌ ERRO:`, error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});