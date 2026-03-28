// reativarThreadsForaHorario - v1.0.0
// Função matinal: reativa threads que chegaram fora do horário de atendimento
// Executa às 08:00 seg-sab via automação agendada

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SETOR_HUMANIZADO = {
  vendas: 'Vendas',
  assistencia: 'Suporte Técnico',
  financeiro: 'Financeiro',
  fornecedor: 'Compras',
  geral: 'Atendimento'
};

function processTextWithEmojis(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '').replace(/\s+/g, ' ').trim();
}

async function enviarMensagemDireta(integracao, contact, texto) {
  try {
    const textoLimpo = processTextWithEmojis(texto);
    const numero = (contact.telefone || '').replace(/\D/g, '');
    const numeroFormatado = numero.startsWith('55') ? numero : '55' + numero;

    let endpoint, body, headers;

    if (integracao.api_provider === 'w_api') {
      endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${integracao.instance_id_provider}`;
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integracao.api_key_provider}` };
      body = { phone: numeroFormatado, message: textoLimpo, delayMessage: 1 };
    } else {
      const baseUrl = integracao.base_url_provider || 'https://api.z-api.io';
      endpoint = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
      headers = { 'Content-Type': 'application/json', 'Client-Token': integracao.security_client_token_header };
      body = { phone: numeroFormatado, message: textoLimpo };
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    return res.ok && !data.error;
  } catch (e) {
    console.warn('[REATIVAR] Falha ao enviar msg:', e.message);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  const agora = new Date();
  const resultados = { processadas: 0, erros: 0, puladas: 0 };

  console.log('[REATIVAR] 🌅 Iniciando reativação matinal...');

  try {
    // 1. Buscar todas as threads aguardando horário comercial
    const threadsAguardando = await base44.asServiceRole.entities.MessageThread.filter({
      routing_stage: 'WAITING_BUSINESS_HOURS',
      status: 'aberta',
      thread_type: 'contact_external'
    }, '-last_message_at', 50);

    console.log(`[REATIVAR] 📋 ${threadsAguardando.length} threads aguardando reativação`);

    // 2. Buscar integrações ativas
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { status: 'conectado' }, '-created_date', 10
    );
    const integracaoMap = Object.fromEntries(integracoes.map(i => [i.id, i]));

    // 3. Buscar todos os usuários para roteamento
    const todosUsuarios = await base44.asServiceRole.entities.User.list('-created_date', 100);

    // 4. Processar cada thread
    for (const thread of threadsAguardando) {
      try {
        if (!thread.contact_id) {
          resultados.puladas++;
          continue;
        }

        // Buscar contato
        const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null);
        if (!contact) {
          resultados.puladas++;
          continue;
        }

        const nome = contact.nome && !/^\d+$/.test(contact.nome) ? contact.nome.split(' ')[0] : null;
        const ultimaMensagem = thread.last_message_content || '';

        // 5. Classificar intenção via IA para definir setor
        let setorDetectado = thread.sector_id || 'geral';

        if (ultimaMensagem.length > 2) {
          try {
            const intencao = await base44.asServiceRole.functions.invoke('analisarIntencao', {
              mensagem: ultimaMensagem,
              contexto: { contact_id: contact.id }
            });

            if (intencao?.data?.success && intencao.data.analise?.sector_slug) {
              const SLUG_NORMALIZER = {
                'suporte': 'assistencia', 'support': 'assistencia', 'tecnico': 'assistencia',
                'vendas': 'vendas', 'comercial': 'vendas', 'sales': 'vendas',
                'financeiro': 'financeiro', 'finance': 'financeiro',
                'fornecedor': 'fornecedor', 'fornecedores': 'fornecedor', 'compras': 'fornecedor'
              };
              setorDetectado = SLUG_NORMALIZER[intencao.data.analise.sector_slug?.toLowerCase()] || intencao.data.analise.sector_slug || 'geral';
              console.log(`[REATIVAR] 🎯 Setor detectado para ${contact.nome}: ${setorDetectado}`);
            }
          } catch (e) {
            console.warn('[REATIVAR] IA falhou, usando setor anterior:', e.message);
          }
        }

        // 6. Buscar atendente disponível do setor
        let atendenteId = null;
        let atendenteNome = null;

        // Verificar fidelizado primeiro
        const campoFidelizado = {
          vendas: 'atendente_fidelizado_vendas',
          assistencia: 'atendente_fidelizado_assistencia',
          financeiro: 'atendente_fidelizado_financeiro',
          fornecedor: 'atendente_fidelizado_fornecedor'
        }[setorDetectado];

        if (campoFidelizado && contact[campoFidelizado]) {
          const fidelizado = todosUsuarios.find(u => u.id === contact[campoFidelizado]);
          if (fidelizado) {
            atendenteId = fidelizado.id;
            atendenteNome = fidelizado.full_name || fidelizado.email;
            console.log('[REATIVAR] 🎯 Fidelizado:', atendenteNome);
          }
        }

        // Fallback: qualquer atendente do setor
        if (!atendenteId) {
          const candidatos = todosUsuarios.filter(u => {
            if (u.role === 'admin') return true; // admins sempre elegíveis
            const setorMatch = u.attendant_sector === setorDetectado || setorDetectado === 'geral';
            return setorMatch && u.is_whatsapp_attendant !== false;
          });

          if (candidatos.length > 0) {
            const escolhido = candidatos[Math.floor(Math.random() * candidatos.length)];
            atendenteId = escolhido.id;
            atendenteNome = escolhido.full_name || escolhido.email;
            console.log('[REATIVAR] ✅ Atendente escolhido:', atendenteNome);
          }
        }

        // 7. Atualizar thread
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          sector_id: setorDetectado,
          assigned_user_id: atendenteId || null,
          routing_stage: 'ROUTED',
          pre_atendimento_state: 'COMPLETED',
          pre_atendimento_ativo: false
        });

        // 8. Enviar mensagem de retomada
        const integracao = integracaoMap[thread.whatsapp_integration_id] || integracoes[0];
        if (integracao && contact.telefone) {
          const setorLabel = SETOR_HUMANIZADO[setorDetectado] || 'Atendimento';
          const atendenteLabel = atendenteNome ? ` com ${atendenteNome.split(' ')[0]}` : '';
          const nomeLabel = nome ? `${nome}! ` : '';
          const msg = `☀️ Bom dia, ${nomeLabel}Estamos de volta! 😊\n\nVou te conectar${atendenteLabel} na nossa equipe de *${setorLabel}* agora.`;

          await enviarMensagemDireta(integracao, contact, msg);

          // Salvar mensagem no histórico
          await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: 'nexus_agent',
            sender_type: 'user',
            content: msg,
            channel: 'whatsapp',
            status: 'enviada',
            sent_at: agora.toISOString(),
            visibility: 'public_to_customer',
            metadata: { is_ai_response: true, ai_agent: 'reativarThreadsForaHorario', trigger: 'morning_reactivation' }
          }).catch(() => {});
        }

        // 9. Registrar AgentRun
        await base44.asServiceRole.entities.AgentRun.create({
          trigger_type: 'scheduled.check',
          trigger_event_id: thread.id,
          playbook_selected: 'reativacao_matinal',
          execution_mode: 'auto_execute',
          status: 'concluido',
          context_snapshot: {
            thread_id: thread.id,
            contact_id: contact.id,
            setor: setorDetectado,
            atendente_id: atendenteId,
            ultima_mensagem: ultimaMensagem.slice(0, 100)
          },
          started_at: agora.toISOString(),
          completed_at: new Date().toISOString()
        }).catch(() => {});

        resultados.processadas++;
        console.log(`[REATIVAR] ✅ Thread ${thread.id} reativada → setor: ${setorDetectado}`);

        // Throttle entre threads
        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        console.error(`[REATIVAR] ❌ Erro na thread ${thread.id}:`, e.message);
        resultados.erros++;
      }
    }

    // 10. Registrar em NexusMemory
    try {
      await base44.asServiceRole.entities.NexusMemory.create({
        owner_user_id: 'system',
        tipo: 'reativacao_matinal',
        conteudo: `Reativação matinal: ${resultados.processadas} threads reativadas, ${resultados.erros} erros, ${resultados.puladas} puladas.`,
        contexto: {
          data: agora.toISOString().split('T')[0],
          ...resultados
        },
        score_utilidade: 80
      });
    } catch (e) {
      console.warn('[REATIVAR] Falha ao salvar NexusMemory:', e.message);
    }

    console.log('[REATIVAR] ✅ Concluído:', resultados);
    return Response.json({ success: true, ...resultados });

  } catch (error) {
    console.error('[REATIVAR] ❌ Erro geral:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});