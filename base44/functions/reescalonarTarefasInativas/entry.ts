import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

// ============================================================================
// REESCALONADOR DE TAREFAS INATIVAS v1.0
// Roda a cada 6h via automação agendada
// Identifica TarefaInteligente pendentes há >72h e:
//   1. Regenera mensagem de follow-up via Anthropic (contexto atualizado)
//   2. Incrementa contador de reescalonamento
//   3. Eleva prioridade (baixa→media→alta→critica)
//   4. Avisa admin no 3º reescalonamento
// ============================================================================

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTROPIK_API') });

const PRIORIDADE_ESCALADA = {
  baixa: 'media',
  media: 'alta',
  alta: 'critica',
  critica: 'critica'
};

async function gerarMensagemFollowUp(base44, contact, thread, orcamentos, diasInativo, numeroReescalonamento) {
  // Buscar últimas 8 mensagens para contexto
  let historicoTexto = '(sem histórico disponível)';
  if (thread?.id) {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { thread_id: thread.id },
      '-created_date',
      8
    ).catch(() => []);

    if (mensagens.length > 0) {
      historicoTexto = mensagens
        .slice().reverse()
        .filter(m => m.content?.length > 0)
        .map(m => {
          const quem = m.sender_type === 'contact' ? contact.nome : '🏢 Atendente';
          return `${quem}: ${m.content.slice(0, 150)}`;
        })
        .join('\n');
    }
  }

  const orcamentosTexto = orcamentos.length > 0
    ? orcamentos.map(o => `• ${o.numero_orcamento || 'ORC'}: R$ ${o.valor_total?.toLocaleString('pt-BR') || '?'} (${o.status})`).join('\n')
    : 'Nenhum orçamento em aberto';

  const urgenciaTexto = numeroReescalonamento === 0
    ? 'Este é o primeiro lembrete.'
    : numeroReescalonamento === 1
    ? 'Já passaram 72h sem resposta. Use tom mais direto mas ainda respeitoso.'
    : 'Já passaram 144h+ sem resposta. Tom mais urgente, ofereça alternativas concretas.';

  const prompt = `Você é um especialista em vendas B2B. Gere UMA mensagem de follow-up curta e personalizada para WhatsApp.

CONTATO:
- Nome: ${contact.nome || 'Cliente'}
- Empresa: ${contact.empresa || 'N/D'}
- Tipo: ${contact.tipo_contato || 'lead'}
- Fidelizado: ${contact.is_cliente_fidelizado ? 'Sim (VIP)' : 'Não'}

SITUAÇÃO: ${diasInativo} dias sem resposta
${urgenciaTexto}

ORÇAMENTOS ABERTOS:
${orcamentosTexto}

ÚLTIMAS MENSAGENS DA CONVERSA:
${historicoTexto}

REGRAS:
1. Máximo 3 parágrafos curtos
2. Personalizado para este contato específico (use o nome, mencione o contexto real)
3. Inclua uma pergunta ou call-to-action claro
4. Tom: profissional mas humano
5. NÃO use templates genéricos como "espero que esteja bem"
6. Responda APENAS com o texto da mensagem, sem explicações

Mensagem:`;

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });
    return resp.content[0]?.text?.trim() || null;
  } catch (claudeErr) {
    console.warn('[REESCALONADOR] Anthropic falhou, usando fallback Base44:', claudeErr.message);
    const fallback = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: null
    }).catch(() => null);
    return typeof fallback === 'string' ? fallback.trim() : null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const agora = new Date();
    const limite72h = new Date(agora.getTime() - 72 * 60 * 60 * 1000).toISOString();

    console.log('[REESCALONADOR] 🔄 Iniciando ciclo de reescalonamento...');

    // Buscar tarefas pendentes criadas há mais de 72h com motivo de inatividade automático
    const tarefasVencidas = await base44.asServiceRole.entities.TarefaInteligente.filter(
      {
        status: 'pendente',
        created_date: { $lte: limite72h }
      },
      'created_date',
      50
    );

    // Filtrar apenas as criadas pelo sistema de alerta de inativos
    const tarefasParaReescalonar = tarefasVencidas.filter(t => {
      const ctx = t.contexto_ia || {};
      const motivo = ctx.motivo || ctx.motivo_criacao || '';
      const reesc = ctx.numero_reescalonamento ?? 0;
      // Reescalar apenas tarefas automáticas de inatividade, máx 3 vezes
      return motivo.includes('inativo_7d_automatico') && reesc < 3;
    });

    console.log(`[REESCALONADOR] 📋 ${tarefasVencidas.length} vencidas | ${tarefasParaReescalonar.length} para reescalonar`);

    const resultados = { reescalonadas: 0, admin_alertados: 0, erros: [] };

    for (const tarefa of tarefasParaReescalonar) {
      try {
        const ctx = tarefa.contexto_ia || {};
        const contactId = ctx.contact_id || tarefa.cliente_id;
        const threadId = ctx.thread_id;
        const numeroReesc = (ctx.numero_reescalonamento ?? 0) + 1;
        const atendente_user_id = ctx.atendente_user_id;

        if (!contactId) {
          console.warn(`[REESCALONADOR] ⚠️ Tarefa ${tarefa.id} sem contact_id — pulando`);
          continue;
        }

        // Carregar dados atualizados em paralelo
        const [contact, thread, orcamentos] = await Promise.all([
          base44.asServiceRole.entities.Contact.get(contactId).catch(() => null),
          threadId ? base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null) : Promise.resolve(null),
          base44.asServiceRole.entities.Orcamento.filter(
            { cliente_id: contactId, status: { $in: ['enviado', 'negociando', 'liberado', 'cotando'] } },
            '-updated_date', 3
          ).catch(() => [])
        ]);

        if (!contact) {
          console.warn(`[REESCALONADOR] ⚠️ Contato ${contactId} não encontrado — pulando`);
          continue;
        }

        // Verificar se o contato voltou a responder (thread tem msg nova)
        if (thread?.last_message_at) {
          const ultimaMsgDt = new Date(thread.last_message_at);
          const criadaEm = new Date(tarefa.created_date);
          if (ultimaMsgDt > criadaEm) {
            // Contato respondeu após a tarefa ser criada → marcar como resolvida
            await base44.asServiceRole.entities.TarefaInteligente.update(tarefa.id, {
              status: 'cancelada',
              resultado_execucao: {
                sucesso: true,
                observacoes: 'Contato retornou antes da ação manual. Reescalonamento cancelado automaticamente.',
                data_execucao: agora.toISOString()
              }
            });
            console.log(`[REESCALONADOR] ✅ ${contact.nome} retornou — tarefa ${tarefa.id} cancelada`);
            continue;
          }
        }

        // Calcular dias de inatividade atualizados
        const refDate = thread?.last_message_at || contact.ultima_interacao || tarefa.created_date;
        const diasInativo = Math.floor((agora.getTime() - new Date(refDate).getTime()) / 86400000);

        // Gerar nova mensagem via Anthropic com contexto atualizado
        const novaMensagem = await gerarMensagemFollowUp(
          base44, contact, thread, orcamentos, diasInativo, numeroReesc - 1
        );

        // Nova prioridade escalada
        const novaPrioridade = PRIORIDADE_ESCALADA[tarefa.prioridade] || 'alta';

        // Marcar tarefa antiga como adiada
        await base44.asServiceRole.entities.TarefaInteligente.update(tarefa.id, {
          status: 'adiada',
          resultado_execucao: {
            sucesso: false,
            observacoes: `Reescalonado automaticamente. Reescalonamento #${numeroReesc}. Nova tarefa criada com prioridade ${novaPrioridade}.`,
            data_execucao: agora.toISOString()
          }
        });

        // Criar nova tarefa com prioridade elevada e mensagem atualizada
        const novaTarefa = await base44.asServiceRole.entities.TarefaInteligente.create({
          titulo: `[${numeroReesc}º Reesc.] Follow-up: ${contact.nome} — ${diasInativo}d sem contato`,
          descricao: `Reescalonamento automático #${numeroReesc}. ${contact.nome} de ${contact.empresa || 'N/D'} está ${diasInativo} dias sem resposta.`,
          tipo_tarefa: orcamentos.length > 0 ? 'follow_up_orcamento' : 'reativacao_cliente',
          prioridade: novaPrioridade,
          cliente_id: contact.cliente_id || null,
          cliente_nome: contact.nome,
          vendedor_responsavel: tarefa.vendedor_responsavel,
          data_prazo: new Date(agora.getTime() + 12 * 60 * 60 * 1000).toISOString(), // 12h (mais urgente)
          status: 'pendente',
          contexto_ia: {
            ...ctx,
            motivo_criacao: `${diasInativo} dias sem contato. Reescalonamento #${numeroReesc} — ação urgente necessária.`,
            suggested_message: novaMensagem,
            numero_reescalonamento: numeroReesc,
            dias_inativo: diasInativo,
            reescalonado_em: agora.toISOString(),
            tarefa_anterior_id: tarefa.id,
            atendente_user_id,
            contact_id: contactId,
            thread_id: threadId
          }
        });

        console.log(`[REESCALONADOR] ⬆️ ${contact.nome}: ${tarefa.prioridade}→${novaPrioridade} | Reesc. #${numeroReesc}`);

        // Notificar vendedor responsável via nexusNotificar (DM + grupo do setor)
        if (atendente_user_id) {
          const setor = contact.atendente_fidelizado_vendas ? 'vendas' : 'geral';
          const prioEmoji = { baixa: '🟡', media: '🟠', alta: '🔴', critica: '🚨' }[novaPrioridade] || '⚠️';
          const msgNotif =
            `${prioEmoji} *Tarefa reescalonada — ${contact.nome}*\n\n` +
            `👤 Contato: ${contact.nome}${contact.empresa ? ` (${contact.empresa})` : ''}\n` +
            `⏱️ Inativo há: *${diasInativo} dias*\n` +
            `📈 Prioridade: ${tarefa.prioridade} → *${novaPrioridade}*\n` +
            `🔢 Reescalonamento: #${numeroReesc}\n\n` +
            (novaMensagem ? `💬 *Mensagem sugerida:*\n${novaMensagem}` : '');

          await base44.asServiceRole.functions.invoke('nexusNotificar', {
            setor,
            conteudo: msgNotif,
            vendedor_responsavel_id: atendente_user_id,
            metadata: { tarefa_id: novaTarefa.id, contact_id: contactId, reescalonamento: numeroReesc }
          }).catch(e => console.warn(`[REESCALONADOR] ⚠️ nexusNotificar falhou:`, e.message));
        }

        // No 3º reescalonamento → alertar admin com WorkQueueItem crítico
        if (numeroReesc >= 3) {
          await base44.asServiceRole.entities.WorkQueueItem.create({
            contact_id: contactId,
            thread_id: threadId,
            tipo: 'idle_reativacao',
            reason: 'idle_14d',
            severity: 'critical',
            status: 'open',
            notes: `🚨 CRÍTICO: ${contact.nome} está ${diasInativo} dias sem contato. 3 lembretes enviados ao atendente sem resposta. Intervenção do gestor necessária.`,
            payload: {
              tarefa_id: novaTarefa.id,
              contact_id: contactId,
              thread_id: threadId,
              dias_inativo: diasInativo,
              atendente: tarefa.vendedor_responsavel,
              numero_reescalonamento: numeroReesc
            }
          });
          resultados.admin_alertados++;
          console.log(`[REESCALONADOR] 🚨 Admin alertado para ${contact.nome} (3º reesc.)`);
        }

        // Log de automação
        await base44.asServiceRole.entities.AutomationLog.create({
          acao: 'follow_up_automatico',
          contato_id: contactId,
          thread_id: threadId,
          resultado: 'sucesso',
          timestamp: agora.toISOString(),
          origem: 'cron',
          prioridade: novaPrioridade === 'critica' ? 'critica' : 'alta',
          detalhes: {
            mensagem: `Reescalonamento #${numeroReesc}: ${tarefa.prioridade}→${novaPrioridade}`,
            dados_contexto: {
              dias_inativo: diasInativo,
              nova_tarefa_id: novaTarefa.id,
              atendente: tarefa.vendedor_responsavel
            }
          }
        }).catch(() => {});

        resultados.reescalonadas++;

        // Throttle: evitar sobrecarga na API
        await new Promise(r => setTimeout(r, 800));

      } catch (err) {
        console.error(`[REESCALONADOR] ❌ Erro na tarefa ${tarefa.id}:`, err.message);
        resultados.erros.push({ tarefa_id: tarefa.id, erro: err.message });
      }
    }

    console.log('[REESCALONADOR] ✅ Concluído:', resultados);

    return Response.json({
      success: true,
      timestamp: agora.toISOString(),
      total_vencidas: tarefasVencidas.length,
      total_elegíveis: tarefasParaReescalonar.length,
      summary: resultados
    });

  } catch (error) {
    console.error('[REESCALONADOR] ❌ Erro crítico:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});