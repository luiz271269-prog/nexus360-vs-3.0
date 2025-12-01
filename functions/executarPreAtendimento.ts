import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// MOTOR DE PRÉ-ATENDIMENTO - v1.0.0
// ============================================================================
// Responsável por:
// 1. Enviar saudação dinâmica com botões de setor
// 2. Processar resposta do contato
// 3. Rotear para atendente fidelizado ou setor
// ============================================================================

const VERSION = 'v1.0.0';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Determinar saudação baseada no horário
function getSaudacao() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Mapear texto de resposta para setor
function mapearSetorDeResposta(resposta, opcoesSetor) {
  if (!resposta || !opcoesSetor) return null;
  
  const textoLower = resposta.toLowerCase().trim();
  
  // Buscar correspondência exata ou parcial
  for (const opcao of opcoesSetor) {
    const labelLower = opcao.label.toLowerCase();
    if (textoLower === labelLower || textoLower.includes(opcao.setor) || labelLower.includes(textoLower)) {
      return opcao.setor;
    }
  }
  
  // Mapeamento por palavras-chave
  const mapeamento = {
    'vendas': ['venda', 'comprar', 'compra', 'preço', 'orçamento', 'cotação', '1', 'comercial'],
    'assistencia': ['suporte', 'assistencia', 'assistência', 'técnico', 'problema', 'ajuda', '2', 'reparo'],
    'financeiro': ['financeiro', 'boleto', 'pagamento', 'nota', 'fiscal', '3', 'cobrança'],
    'fornecedor': ['fornecedor', 'parceiro', 'fornecimento', '4'],
    'geral': ['outro', 'outros', 'geral', '5', 'não sei']
  };
  
  for (const [setor, palavras] of Object.entries(mapeamento)) {
    if (palavras.some(p => textoLower.includes(p))) {
      return setor;
    }
  }
  
  return null;
}

// Buscar atendente fidelizado para o contato e setor
async function buscarAtendenteFidelizado(base44, contato, setor) {
  if (!contato || !setor) return null;
  
  const campoFidelizado = {
    'vendas': 'atendente_fidelizado_vendas',
    'assistencia': 'atendente_fidelizado_assistencia',
    'financeiro': 'atendente_fidelizado_financeiro',
    'fornecedor': 'atendente_fidelizado_fornecedor'
  };
  
  const campo = campoFidelizado[setor];
  if (!campo || !contato[campo]) return null;
  
  try {
    const atendente = await base44.asServiceRole.entities.User.get(contato[campo]);
    return atendente;
  } catch (e) {
    return null;
  }
}

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

  const { action, thread_id, contact_id, integration_id, resposta_usuario } = payload;

  try {
    // ========================================================================
    // AÇÃO: INICIAR PRÉ-ATENDIMENTO
    // ========================================================================
    if (action === 'iniciar') {
      // Buscar FlowTemplate padrão ativo
      const templates = await base44.asServiceRole.entities.FlowTemplate.filter({
        is_pre_atendimento_padrao: true,
        ativo: true
      }, '-created_date', 1);

      if (templates.length === 0) {
        return Response.json({ 
          success: false, 
          error: 'Nenhum FlowTemplate de pré-atendimento configurado',
          action_required: 'criar_template'
        }, { headers: corsHeaders });
      }

      const template = templates[0];

      // Verificar se está ativado
      if (template.activation_mode === 'disabled') {
        return Response.json({ 
          success: false, 
          skipped: true,
          reason: 'pre_atendimento_desativado'
        }, { headers: corsHeaders });
      }

      // Buscar thread e contato
      const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
      const contato = await base44.asServiceRole.entities.Contact.get(contact_id);

      if (!thread || !contato) {
        return Response.json({ success: false, error: 'Thread ou contato não encontrado' }, { headers: corsHeaders });
      }

      // Montar mensagem de saudação
      const saudacao = getSaudacao();
      let mensagemTexto = template.mensagem_saudacao || 'Olá! {saudacao}, para qual setor você gostaria de falar?';
      mensagemTexto = mensagemTexto.replace('{saudacao}', saudacao);
      
      // Personalizar com nome se disponível
      if (contato.nome && contato.nome !== contato.telefone) {
        mensagemTexto = mensagemTexto.replace('Olá!', `Olá, ${contato.nome}!`);
      }

      // Montar opções de setor
      const opcoesSetor = template.opcoes_setor || [
        { label: '💼 Vendas', setor: 'vendas' },
        { label: '🔧 Suporte', setor: 'assistencia' },
        { label: '💰 Financeiro', setor: 'financeiro' }
      ];

      // Adicionar lista de opções à mensagem
      const listaOpcoes = opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n');
      const mensagemCompleta = `${mensagemTexto}\n\n${listaOpcoes}\n\n_Responda com o número ou nome da opção desejada._`;

      // Enviar mensagem via WhatsApp
      const resultadoEnvio = await base44.functions.invoke('enviarWhatsApp', {
        integration_id: integration_id,
        numero_destino: contato.telefone,
        mensagem: mensagemCompleta
      });

      if (!resultadoEnvio.data.success) {
        throw new Error(resultadoEnvio.data.error || 'Falha ao enviar mensagem');
      }

      // Criar FlowExecution
      const flowExecution = await base44.asServiceRole.entities.FlowExecution.create({
        flow_template_id: template.id,
        contact_id: contact_id,
        thread_id: thread_id,
        whatsapp_integration_id: integration_id,
        status: 'ativo',
        current_step: 0,
        started_at: new Date().toISOString(),
        variables: {
          saudacao: saudacao,
          opcoes_setor: opcoesSetor
        }
      });

      // Atualizar thread
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        pre_atendimento_ativo: true,
        pre_atendimento_state: 'WAITING_SECTOR_CHOICE',
        pre_atendimento_started_at: new Date().toISOString()
      });

      // Salvar mensagem do bot no banco
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread_id,
        sender_id: 'system',
        sender_type: 'user',
        content: mensagemCompleta,
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resultadoEnvio.data.message_id,
        sent_at: new Date().toISOString(),
        metadata: {
          whatsapp_integration_id: integration_id,
          pre_atendimento: true,
          flow_execution_id: flowExecution.id
        }
      });

      console.log(`[${VERSION}] ✅ Pré-atendimento iniciado | Thread: ${thread_id} | FlowExec: ${flowExecution.id}`);

      return Response.json({
        success: true,
        flow_execution_id: flowExecution.id,
        message_sent: true,
        state: 'WAITING_SECTOR_CHOICE'
      }, { headers: corsHeaders });
    }

    // ========================================================================
    // AÇÃO: PROCESSAR RESPOSTA DO CONTATO
    // ========================================================================
    if (action === 'processar_resposta') {
      // Buscar FlowExecution ativa
      const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
        thread_id: thread_id,
        status: 'ativo'
      }, '-created_date', 1);

      if (execucoes.length === 0) {
        return Response.json({ 
          success: false, 
          error: 'Nenhuma execução de pré-atendimento ativa',
          should_start_new: true
        }, { headers: corsHeaders });
      }

      const execucao = execucoes[0];
      const opcoesSetor = execucao.variables?.opcoes_setor || [];

      // Mapear resposta para setor
      const setorEscolhido = mapearSetorDeResposta(resposta_usuario, opcoesSetor);

      if (!setorEscolhido) {
        // Resposta não reconhecida - enviar mensagem de erro
        const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
        
        await base44.functions.invoke('enviarWhatsApp', {
          integration_id: integration_id,
          numero_destino: contato.telefone,
          mensagem: '❓ Não entendi sua escolha. Por favor, responda com o número ou nome do setor desejado:\n\n' + 
                    opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n')
        });

        return Response.json({
          success: true,
          understood: false,
          state: 'WAITING_SECTOR_CHOICE',
          message: 'Resposta não reconhecida, solicitado novamente'
        }, { headers: corsHeaders });
      }

      // Buscar contato para verificar atendente fidelizado
      const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
      const atendenteFidelizado = await buscarAtendenteFidelizado(base44, contato, setorEscolhido);

      // Atualizar thread com setor escolhido e possível atribuição
      const threadUpdate = {
        sector_id: setorEscolhido,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      };

      let mensagemConfirmacao = '';

      if (atendenteFidelizado) {
        // Atribuir ao atendente fidelizado
        threadUpdate.assigned_user_id = atendenteFidelizado.id;
        threadUpdate.assigned_user_name = atendenteFidelizado.full_name;
        mensagemConfirmacao = `✅ Perfeito! Você será atendido por *${atendenteFidelizado.full_name}* do setor de *${setorEscolhido}*. Aguarde um momento, por favor.`;
      } else {
        // Deixar visível para o setor
        mensagemConfirmacao = `✅ Entendido! Sua conversa foi direcionada para o setor de *${setorEscolhido}*. Um atendente entrará em contato em breve.`;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);

      // Atualizar FlowExecution
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        variables: {
          ...execucao.variables,
          setor_escolhido: setorEscolhido,
          atendente_fidelizado_id: atendenteFidelizado?.id || null
        }
      });

      // Enviar confirmação
      await base44.functions.invoke('enviarWhatsApp', {
        integration_id: integration_id,
        numero_destino: contato.telefone,
        mensagem: mensagemConfirmacao
      });

      // Salvar mensagem de confirmação
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread_id,
        sender_id: 'system',
        sender_type: 'user',
        content: mensagemConfirmacao,
        channel: 'whatsapp',
        status: 'enviada',
        sent_at: new Date().toISOString(),
        metadata: {
          whatsapp_integration_id: integration_id,
          pre_atendimento: true,
          setor_roteado: setorEscolhido
        }
      });

      console.log(`[${VERSION}] ✅ Pré-atendimento concluído | Thread: ${thread_id} | Setor: ${setorEscolhido} | Fidelizado: ${atendenteFidelizado?.id || 'N/A'}`);

      return Response.json({
        success: true,
        setor_escolhido: setorEscolhido,
        atendente_fidelizado: atendenteFidelizado ? {
          id: atendenteFidelizado.id,
          nome: atendenteFidelizado.full_name
        } : null,
        state: 'COMPLETED'
      }, { headers: corsHeaders });
    }

    return Response.json({ success: false, error: 'Ação inválida' }, { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error(`[${VERSION}] ❌ ERRO:`, error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});