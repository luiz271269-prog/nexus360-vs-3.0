// claudeAgendaAgent - v1.0.0
// Agente de agendamento automático via WhatsApp usando Claude (Anthropic)
// Integrado ao fluxo: processInbound → claudeAgendaAgent
// Capaz de: criar, consultar, cancelar e reagendar compromissos via conversa natural

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

// ============================================================
// ✏️ PERSONALIZE AQUI
// ============================================================
const CONFIG = {
  modelo: 'claude-3-5-sonnet-20241022', // Sonnet para raciocínio de agenda
  max_tokens: 800,
  historico_msgs: 15,
  horario_inicio: 8,
  horario_fim: 18,
  duracao_padrao_min: 60,
  dias_uteis: [1, 2, 3, 4, 5], // seg-sex (0=dom, 6=sab)
  antecedencia_min_horas: 2,
  max_dias_frente: 30,
  fuso_horario: 'America/Sao_Paulo',
};

const EMPRESA = {
  nome: '[NOME DA EMPRESA]',
  servicos: [
    // ✏️ Edite com seus serviços reais
    { nome: 'Consulta Técnica',      duracao_min: 60, descricao: 'Avaliação técnica do equipamento' },
    { nome: 'Reparo Express',        duracao_min: 30, descricao: 'Reparos rápidos no balcão'        },
    { nome: 'Instalação',            duracao_min: 90, descricao: 'Instalação de equipamentos'       },
    { nome: 'Manutenção Preventiva', duracao_min: 45, descricao: 'Check-up e limpeza'              },
  ],
};
// ============================================================

function buildAgendaSystemPrompt(contexto) {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: CONFIG.fuso_horario });
  const servicosLista = EMPRESA.servicos
    .map(s => `- ${s.nome} (${s.duracao_min} min): ${s.descricao}`)
    .join('\n');

  return `Você é o assistente de agendamento da ${EMPRESA.nome}. Sua função é ajudar clientes a agendar, consultar, cancelar e reagendar serviços via WhatsApp de forma simples e eficiente.

## DATA E HORA ATUAL
${agora} (horário de Brasília)

## SERVIÇOS DISPONÍVEIS
${servicosLista}

## HORÁRIO DE ATENDIMENTO
Segunda a Sexta: ${CONFIG.horario_inicio}h às ${CONFIG.horario_fim}h
Agendamentos com no mínimo ${CONFIG.antecedencia_min_horas}h de antecedência.

## AGENDAMENTOS EXISTENTES DO CLIENTE
${contexto.agendamentos?.length > 0
  ? contexto.agendamentos.map(a => `- ID: ${a.id} | ${a.servico} | ${a.data_hora} | Status: ${a.status}`).join('\n')
  : 'Nenhum agendamento encontrado para este cliente.'}

## HORÁRIOS DISPONÍVEIS (próximos dias)
${contexto.horariosDisponiveis?.length > 0
  ? contexto.horariosDisponiveis.join('\n')
  : 'Consulte disponibilidade perguntando a data desejada.'}

## SEU FLUXO DE ATENDIMENTO
1. IDENTIFICAR a intenção: agendar, consultar, cancelar ou reagendar
2. COLETAR informações necessárias (serviço, data, horário preferido)
3. CONFIRMAR disponibilidade com base nos horários acima
4. CONFIRMAR com o cliente antes de finalizar
5. REGISTRAR o agendamento respondendo em JSON no formato abaixo

## FORMATO DE RESPOSTA (OBRIGATÓRIO — sempre JSON válido)
{
  "mensagem": "Texto da resposta para o cliente (linguagem natural, amigável)",
  "acao": "aguardar | criar_agendamento | cancelar_agendamento | reagendar | consultar | escalar_humano",
  "dados_agendamento": {
    "servico": "nome do serviço ou null",
    "data_hora_iso": "2025-03-10T14:00:00 ou null",
    "agendamento_id": "id para cancelar/reagendar ou null",
    "confirmado": true/false
  },
  "motivo_escalar": "motivo se acao=escalar_humano, senão null"
}

## REGRAS IMPORTANTES
- Nunca confirme um horário sem verificar os disponíveis acima
- Peça confirmação ANTES de criar ou cancelar
- Se o cliente estiver frustrado ou o caso for complexo → escalar para humano
- Mantenha respostas curtas e diretas (WhatsApp)
- Use emojis com moderação 📅
${contexto.nomeCliente ? `\nO cliente se chama ${contexto.nomeCliente}. Use o nome para personalizar.` : ''}`;
}

async function buscarHorariosDisponiveis(base44, dias = 5) {
  const horarios = [];
  try {
    const agora = new Date();
    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() + dias);

    const agendamentosExistentes = await base44.asServiceRole.entities.Agendamento
      .filter({
        status: { $in: ['confirmado', 'pendente'] },
        data_hora: { $gte: agora.toISOString(), $lte: dataFim.toISOString() }
      }, 'data_hora', 100)
      .catch(() => []);

    const ocupados = new Set((agendamentosExistentes || []).map(a => a.data_hora?.substring(0, 16)));

    const cursor = new Date(agora);
    cursor.setMinutes(0, 0, 0);
    cursor.setHours(cursor.getHours() + CONFIG.antecedencia_min_horas);

    while (cursor < dataFim && horarios.length < 20) {
      const diaSemana = cursor.getDay();
      const hora = cursor.getHours();

      if (CONFIG.dias_uteis.includes(diaSemana) && hora >= CONFIG.horario_inicio && hora < CONFIG.horario_fim) {
        const isoSlot = cursor.toISOString().substring(0, 16);
        if (!ocupados.has(isoSlot)) {
          horarios.push(cursor.toLocaleString('pt-BR', {
            timeZone: CONFIG.fuso_horario,
            weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          }));
        }
      }

      cursor.setMinutes(cursor.getMinutes() + CONFIG.duracao_padrao_min);
      if (cursor.getHours() >= CONFIG.horario_fim) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(CONFIG.horario_inicio, 0, 0, 0);
      }
    }
  } catch (err) {
    console.warn('[AGENDA] ⚠️ Erro ao buscar horários:', err.message);
  }
  return horarios;
}

async function buscarAgendamentosCliente(base44, contatoId) {
  try {
    const agora = new Date().toISOString();
    return await base44.asServiceRole.entities.Agendamento
      .filter({ contact_id: contatoId, data_hora: { $gte: agora }, status: { $in: ['confirmado', 'pendente'] } }, 'data_hora', 5)
      .catch(() => []);
  } catch {
    return [];
  }
}

async function executarAcao(acao, dadosAgendamento, contatoId, threadId, base44) {
  if (!dadosAgendamento?.confirmado) return { ok: true, executado: false };

  try {
    switch (acao) {
      case 'criar_agendamento': {
        if (!dadosAgendamento.servico || !dadosAgendamento.data_hora_iso) {
          return { ok: false, erro: 'Dados incompletos para criar agendamento' };
        }
        const novo = await base44.asServiceRole.entities.Agendamento.create({
          contact_id: contatoId,
          thread_id: threadId,
          servico: dadosAgendamento.servico,
          data_hora: new Date(dadosAgendamento.data_hora_iso).toISOString(),
          status: 'confirmado',
          origem: 'whatsapp_ia',
        });
        console.log(`[AGENDA] ✅ Agendamento criado: ${novo.id}`);
        return { ok: true, executado: true, agendamento_id: novo.id };
      }
      case 'cancelar_agendamento': {
        if (!dadosAgendamento.agendamento_id) return { ok: false, erro: 'ID necessário para cancelar' };
        await base44.asServiceRole.entities.Agendamento.update(dadosAgendamento.agendamento_id, {
          status: 'cancelado', cancelado_em: new Date().toISOString()
        });
        return { ok: true, executado: true };
      }
      case 'reagendar': {
        if (!dadosAgendamento.agendamento_id || !dadosAgendamento.data_hora_iso) {
          return { ok: false, erro: 'ID e nova data necessários para reagendar' };
        }
        await base44.asServiceRole.entities.Agendamento.update(dadosAgendamento.agendamento_id, {
          data_hora: new Date(dadosAgendamento.data_hora_iso).toISOString(),
          status: 'confirmado',
          reagendado_em: new Date().toISOString()
        });
        return { ok: true, executado: true };
      }
      default:
        return { ok: true, executado: false };
    }
  } catch (err) {
    console.error(`[AGENDA] ❌ Erro ao executar ${acao}:`, err.message);
    return { ok: false, erro: err.message };
  }
}

async function enviarMensagem(provider, integration, telefone, texto) {
  if (!integration || !telefone) throw new Error('Integração ou telefone ausentes');

  if (provider === 'z_api') {
    const url = `${integration.base_url_provider}/instances/${integration.instance_id_provider}/token/${integration.api_key_provider}/send-text`;
    const headers = { 'Content-Type': 'application/json' };
    if (integration.security_client_token_header) headers['Client-Token'] = integration.security_client_token_header;
    await fetch(url, { method: 'POST', headers, body: JSON.stringify({ phone: telefone, message: texto }) });
  } else if (provider === 'w_api') {
    await fetch(`${integration.base_url_provider}/messages/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integration.api_key_provider}` },
      body: JSON.stringify({ instanceId: integration.instance_id_provider, number: telefone, text: texto }),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  let base44;
  try { base44 = createClientFromRequest(req); } catch {
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  let payload;
  try { payload = await req.json(); } catch {
    return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const { thread_id, contact_id, message_content, integration_id, provider } = payload;
  if (!thread_id || !contact_id || !message_content) {
    return Response.json({ success: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const reqId = Math.random().toString(36).slice(2, 10);
  console.log(`[AGENDA:${reqId}] 📅 thread=${thread_id} | msg="${message_content.substring(0, 60)}"`);

  try {
    // 1. Buscar tudo em paralelo
    const [mensagens, contact, integration, agendamentosCliente, horariosDisponiveis] = await Promise.all([
      base44.asServiceRole.entities.Message.filter({ thread_id }, '-created_date', CONFIG.historico_msgs),
      base44.asServiceRole.entities.Contact.get(contact_id),
      integration_id ? base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id) : Promise.resolve(null),
      buscarAgendamentosCliente(base44, contact_id),
      buscarHorariosDisponiveis(base44),
    ]);

    // 2. Montar histórico limpo
    const historico = mensagens
      .reverse()
      .filter(m => m.content && m.content !== '[mídia]' && !m.metadata?.ai_escalation)
      .map(m => ({ role: m.sender_type === 'contact' ? 'user' : 'assistant', content: m.content }));

    const historicoFinal = historico.length > 0 && historico[0].role === 'user'
      ? historico
      : [{ role: 'user', content: message_content }];

    // 3. Chamar Claude
    const systemPrompt = buildAgendaSystemPrompt({ nomeCliente: contact?.nome, agendamentos: agendamentosCliente, horariosDisponiveis });
    console.log(`[AGENDA:${reqId}] 🤖 Chamando Claude com ${historicoFinal.length} msgs...`);

    const response = await anthropic.messages.create({
      model: CONFIG.modelo,
      max_tokens: CONFIG.max_tokens,
      system: systemPrompt,
      messages: historicoFinal,
    });

    const respostaTexto = response.content[0]?.text;
    if (!respostaTexto) throw new Error('Claude retornou resposta vazia');

    // 4. Parsear JSON do Claude
    let respostaJson;
    try {
      respostaJson = JSON.parse(respostaTexto.replace(/```json|```/g, '').trim());
    } catch {
      console.warn(`[AGENDA:${reqId}] ⚠️ Resposta não-JSON, usando como texto`);
      respostaJson = { mensagem: respostaTexto, acao: 'aguardar', dados_agendamento: null, motivo_escalar: null };
    }

    const { mensagem, acao, dados_agendamento, motivo_escalar } = respostaJson;
    console.log(`[AGENDA:${reqId}] 🎯 Ação: ${acao} | Confirmado: ${dados_agendamento?.confirmado}`);

    // 5. Escalar para humano se necessário
    if (acao === 'escalar_humano') {
      if (integration && contact?.telefone) await enviarMensagem(provider, integration, contact.telefone, mensagem);
      await base44.asServiceRole.entities.Message.create({
        thread_id, sender_id: 'claude_ai', sender_type: 'user', content: mensagem,
        channel: 'whatsapp', status: 'enviada', sent_at: new Date().toISOString(),
        metadata: { is_ai_response: true, ai_escalation: true, escalation_reason: 'agenda_escalar_humano' },
      });
      await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
        thread_id, contact_id, whatsapp_integration_id: integration_id,
        user_input: { type: 'text', content: message_content },
      }).catch(e => console.warn(`[AGENDA:${reqId}] ⚠️ Erro URA:`, e.message));
      return Response.json({ success: true, action: 'escalated', reason: motivo_escalar });
    }

    // 6. Executar ação (criar/cancelar/reagendar)
    let resultadoAcao = { ok: true, executado: false };
    if (['criar_agendamento', 'cancelar_agendamento', 'reagendar'].includes(acao)) {
      resultadoAcao = await executarAcao(acao, dados_agendamento, contact_id, thread_id, base44);
    }

    // 7. Enviar resposta ao cliente e salvar no banco
    if (!integration) throw new Error(`Integração ${integration_id} não encontrada`);
    await enviarMensagem(provider, integration, contact.telefone, mensagem);
    await base44.asServiceRole.entities.Message.create({
      thread_id, sender_id: 'claude_ai', sender_type: 'user', content: mensagem,
      channel: 'whatsapp', status: 'enviada', sent_at: new Date().toISOString(),
      metadata: {
        whatsapp_integration_id: integration_id,
        is_ai_response: true, ai_model: CONFIG.modelo, ai_provider: 'anthropic',
        ai_agent: 'agenda', agenda_acao: acao,
        agenda_executado: resultadoAcao.executado,
        agenda_agendamento_id: resultadoAcao.agendamento_id ?? null,
      },
    });

    console.log(`[AGENDA:${reqId}] ✅ ação=${acao} | executado=${resultadoAcao.executado}`);
    return Response.json({ success: true, response: mensagem, acao, executado: resultadoAcao.executado, model: CONFIG.modelo });

  } catch (error) {
    console.error(`[AGENDA:${reqId}] ❌ Erro:`, error.message);
    try {
      const [fb_integration, fb_contact] = await Promise.all([
        integration_id ? base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id) : Promise.resolve(null),
        base44.asServiceRole.entities.Contact.get(contact_id),
      ]);
      if (fb_integration && fb_contact?.telefone) {
        await enviarMensagem(provider, fb_integration, fb_contact.telefone,
          'Desculpe, tive uma instabilidade ao processar seu agendamento. Nossa equipe entrará em contato em breve. 🙏');
      }
    } catch { /* silencioso */ }
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});