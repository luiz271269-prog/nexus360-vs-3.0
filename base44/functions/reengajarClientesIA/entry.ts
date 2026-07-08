import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// REENGAJAMENTO IA — v1.0.0
// Varre threads WhatsApp paradas (7 a 90 dias sem inbound), analisa as últimas
// 20 mensagens com IA e envia mensagem de reengajamento personalizada.
// Guards: cooldown 14 dias por thread, thread bloqueada, horário comercial,
// limite de envios por execução.
// Payload: { dry_run?: boolean, limite?: number }
// ============================================================================

const COOLDOWN_DIAS = 14;
const IDLE_MIN_DIAS = 7;
const IDLE_MAX_DIAS = 90;
const LIMITE_PADRAO = 5;

function dentroHorarioComercial() {
  // BRT = UTC-3
  const agora = new Date(Date.now() - 3 * 3600000);
  const dia = agora.getUTCDay();
  const hora = agora.getUTCHours();
  return dia >= 1 && dia <= 5 && hora >= 8 && hora < 18;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite execução via automação agendada (sem usuário) ou por admin
    let user = null;
    try { user = await base44.auth.me(); } catch (_e) { user = null; }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }
    const dryRun = payload.dry_run === true;
    const limite = Math.min(payload.limite || LIMITE_PADRAO, 10);

    if (!dryRun && !dentroHorarioComercial()) {
      return Response.json({ success: true, skipped: 'fora_horario_comercial', enviados: 0 });
    }

    const svc = base44.asServiceRole;
    const agora = Date.now();
    const idleMin = new Date(agora - IDLE_MIN_DIAS * 86400000).toISOString();
    const idleMax = new Date(agora - IDLE_MAX_DIAS * 86400000).toISOString();
    const cooldownLimite = agora - COOLDOWN_DIAS * 86400000;

    // Threads WhatsApp externas, abertas, paradas entre 7 e 90 dias
    const threads = await svc.entities.MessageThread.filter({
      channel: 'whatsapp',
      thread_type: 'contact_external',
      status: 'aberta',
      is_canonical: true,
      last_inbound_at: { $lte: idleMin, $gte: idleMax }
    }, '-last_inbound_at', 50);

    const resultados = [];
    let enviados = 0;

    for (const thread of threads) {
      if (enviados >= limite) break;
      if (thread.bloqueado === true) continue;
      if (!thread.contact_id || !thread.whatsapp_integration_id) continue;

      // Cooldown de reengajamento por thread
      const ultimoReengajamento = thread.campos_personalizados?.reengajamento_ia_em;
      if (ultimoReengajamento && new Date(ultimoReengajamento).getTime() > cooldownLimite) continue;

      const contato = await svc.entities.Contact.get(thread.contact_id).catch(() => null);
      if (!contato) continue;
      const telefone = contato.telefone_canonico || contato.telefone;
      if (!telefone) continue;

      // Últimas 20 mensagens da conversa (mais recentes primeiro → reordenar)
      const mensagens = await svc.entities.Message.filter(
        { thread_id: thread.id }, '-created_date', 20
      );
      if (mensagens.length < 3) continue; // sem histórico suficiente para personalizar

      const historico = mensagens.reverse()
        .filter(m => m.content && m.visibility !== 'internal_only')
        .map(m => `${m.sender_type === 'contact' ? 'CLIENTE' : 'ATENDENTE'}: ${m.content.slice(0, 300)}`)
        .join('\n');

      const diasParado = Math.floor((agora - new Date(thread.last_inbound_at).getTime()) / 86400000);
      const nomeContato = contato.nome || contato.full_name || 'cliente';

      const analise = await svc.integrations.Core.InvokeLLM({
        prompt: `Você é assistente comercial da NeuralTec (distribuidora de tecnologia/informática, Brasil).
Analise a conversa de WhatsApp abaixo com o cliente "${nomeContato}", parada há ${diasParado} dias, e decida se vale reengajar.

CONVERSA (últimas ${mensagens.length} mensagens):
${historico}

REGRAS:
- Se o cliente pediu para não ser contatado, demonstrou irritação, ou o assunto foi claramente encerrado (compra concluída sem pendência, reclamação resolvida), NÃO reengajar.
- Se houve interesse em produto/orçamento sem conclusão, dúvida sem resposta, ou relacionamento ativo interrompido, REENGAJAR.
- A mensagem deve: ser curta (máx 3 frases), em português brasileiro informal-profissional, citar o assunto específico da última conversa, terminar com pergunta aberta. Sem promoções genéricas, sem "Olá, tudo bem?" isolado.`,
        response_json_schema: {
          type: 'object',
          properties: {
            deve_reengajar: { type: 'boolean' },
            motivo: { type: 'string' },
            mensagem: { type: 'string' }
          },
          required: ['deve_reengajar', 'motivo', 'mensagem']
        }
      });

      if (!analise.deve_reengajar) {
        resultados.push({ thread_id: thread.id, contato: nomeContato, acao: 'ignorado', motivo: analise.motivo });
        continue;
      }

      if (dryRun) {
        resultados.push({ thread_id: thread.id, contato: nomeContato, acao: 'sugerido (dry_run)', mensagem: analise.mensagem, motivo: analise.motivo });
        enviados++;
        continue;
      }

      // Envio real via função unificada
      const envio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
        integration_id: thread.whatsapp_integration_id,
        numero_destino: telefone,
        mensagem: analise.mensagem
      });
      const envioData = envio?.data || envio;

      if (!envioData?.success) {
        resultados.push({ thread_id: thread.id, contato: nomeContato, acao: 'falha_envio', erro: envioData?.error || 'desconhecido' });
        continue;
      }

      const agoraISO = new Date().toISOString();

      // Persistir mensagem no histórico da Central
      await svc.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'sistema-reengajamento-ia',
        sender_type: 'user',
        recipient_id: thread.contact_id,
        recipient_type: 'contact',
        content: analise.mensagem,
        channel: 'whatsapp',
        provider: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: envioData.message_id,
        sent_at: agoraISO,
        metadata: {
          user_name: 'Reengajamento IA',
          whatsapp_integration_id: thread.whatsapp_integration_id
        }
      });

      // Atualizar thread (cache + cooldown)
      await svc.entities.MessageThread.update(thread.id, {
        last_message_content: analise.mensagem,
        last_message_at: agoraISO,
        last_outbound_at: agoraISO,
        last_message_sender: 'user',
        last_message_sender_name: 'Reengajamento IA',
        campos_personalizados: {
          ...(thread.campos_personalizados || {}),
          reengajamento_ia_em: agoraISO
        }
      });

      // Auditoria
      await svc.entities.AutomationLog.create({
        acao: 'follow_up_automatico',
        contato_id: thread.contact_id,
        thread_id: thread.id,
        integracao_id: thread.whatsapp_integration_id,
        resultado: 'sucesso',
        timestamp: agoraISO,
        origem: 'cron',
        detalhes: {
          mensagem: `Reengajamento IA (${diasParado} dias parado): ${analise.mensagem}`,
          dados_contexto: { motivo_ia: analise.motivo, mensagens_analisadas: mensagens.length }
        }
      });

      resultados.push({ thread_id: thread.id, contato: nomeContato, acao: 'enviado', mensagem: analise.mensagem });
      enviados++;
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      threads_candidatas: threads.length,
      enviados,
      resultados
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});