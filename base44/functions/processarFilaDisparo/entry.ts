import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// PROCESSAR FILA DISPARO v2.0
// ============================================================================
// Monitora FilaDisparo aprovadas → executa sequência Z-API → notifica interna + WhatsApp

const NOTIF_NUMERO = '48999322400';

// ── Notificação WhatsApp externo ─────────────────────────────────────────────
async function notificarWA(base44, integrationId, mensagem) {
  try {
    if (!integrationId) return;
    await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: integrationId,
      numero_destino: NOTIF_NUMERO,
      mensagem
    });
  } catch (e) {
    console.warn('[PROCESSAR-FILA] ⚠️ Falha ao notificar WA:', e.message);
  }
}

// ── Notificação interna (grupo do setor + DM ao vendedor) ────────────────────
async function notificarInterno(base44, fila, conteudo) {
  try {
    const agora = new Date().toISOString();
    const setor = fila.setor || 'vendas';

    // Busca thread do setor
    const threadsSetor = await base44.asServiceRole.entities.MessageThread.filter(
      { thread_type: 'sector_group', sector_key: `sector:${setor}` },
      '-created_date', 1
    );

    const criarMsg = async (threadId) => {
      await base44.asServiceRole.entities.Message.create({
        thread_id: threadId,
        sender_id: 'jarvis_copiloto_ia',
        sender_type: 'user',
        content: conteudo,
        channel: 'interno',
        visibility: 'internal_only',
        provider: 'internal_system',
        status: 'enviada',
        sent_at: agora,
        metadata: {
          is_internal_message: true,
          is_1on1: false,
          sender_name: '🤖 Nexus Disparos',
          fila_disparo_id: fila.id
        }
      });
      await base44.asServiceRole.entities.MessageThread.update(threadId, {
        last_message_at: agora,
        last_message_content: conteudo.substring(0, 200),
        last_message_sender: 'user',
        last_message_sender_name: '🤖 Nexus Disparos'
      });
    };

    // Enviar no grupo do setor
    if (threadsSetor[0]) {
      await criarMsg(threadsSetor[0].id);
    }

    // Enviar DM ao vendedor responsável
    if (fila.vendedor_responsavel_id) {
      const SYSTEM_ID = 'jarvis_copiloto_ia';
      const pairKey = [SYSTEM_ID, fila.vendedor_responsavel_id].sort().join(':');
      const threadsDM = await base44.asServiceRole.entities.MessageThread.filter(
        { pair_key: pairKey, thread_type: 'team_internal' },
        '-created_date', 1
      );
      if (threadsDM[0]) {
        await criarMsg(threadsDM[0].id);
      }
    }
  } catch (e) {
    console.warn('[PROCESSAR-FILA] ⚠️ Falha ao notificar internamente:', e.message);
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const agora = new Date();

  try {
    console.log('[PROCESSAR-FILA] 🚀 Iniciando processamento de filas...');

    const filasAprovadas = await base44.asServiceRole.entities.FilaDisparo.filter(
      { status: 'aprovado' }, '-aprovado_em', 10
    );

    if (filasAprovadas.length === 0) {
      console.log('[PROCESSAR-FILA] ✅ Nenhuma fila aprovada');
      return Response.json({ success: true, processados: 0, message: 'Nenhuma fila aprovada' });
    }

    console.log(`[PROCESSAR-FILA] 📊 ${filasAprovadas.length} filas aprovadas`);

    const integracoesAtivas = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { status: 'conectado' }, '-created_date', 1
    );
    const notifIntegrationId = integracoesAtivas[0]?.id || null;

    let processadas = 0;
    let erros = 0;

    for (const fila of filasAprovadas) {
      try {
        // Validar integração
        const integracao = fila.integracacao_whatsapp_id
          ? await base44.asServiceRole.entities.WhatsAppIntegration.get(fila.integracacao_whatsapp_id)
          : null;

        if (!integracao) {
          const motivo = 'Integração WhatsApp não disponível';
          await base44.asServiceRole.entities.FilaDisparo.update(fila.id, { status: 'bloqueado', motivo_bloqueio: motivo });
          const msg = `🔴 *BLOQUEADO — Integração indisponível*\n🆔 Fila: \`${fila.id}\`\nMotivo: ${motivo}`;
          await notificarWA(base44, notifIntegrationId, msg);
          await notificarInterno(base44, fila, msg);
          erros++; continue;
        }

        // Buscar contato
        const contato = await base44.asServiceRole.entities.Contact.get(fila.contact_id);
        if (!contato || !contato.telefone) {
          const motivo = 'Contato sem telefone válido';
          await base44.asServiceRole.entities.FilaDisparo.update(fila.id, { status: 'bloqueado', motivo_bloqueio: motivo });
          const msg = `🔴 *BLOQUEADO — Sem telefone*\n🆔 Fila: \`${fila.id}\`\nContato ID: ${fila.contact_id}`;
          await notificarWA(base44, notifIntegrationId, msg);
          await notificarInterno(base44, fila, msg);
          erros++; continue;
        }

        const nome = contato.nome || 'Contato';
        const tel = contato.telefone;

        // Anti-duplicata 7 dias
        if (contato.last_any_promo_sent_at) {
          const dias = (agora - new Date(contato.last_any_promo_sent_at)) / (1000 * 60 * 60 * 24);
          if (dias < 7) {
            const motivo = `Anti-duplicata: último envio há ${dias.toFixed(1)} dias`;
            await base44.asServiceRole.entities.FilaDisparo.update(fila.id, { status: 'bloqueado', motivo_bloqueio: motivo });
            const msg = `⏸️ *BLOQUEADO — Anti-duplicata*\n👤 ${nome}\n🆔 Fila: \`${fila.id}\`\nÚltimo envio há ${dias.toFixed(1)} dias`;
            await notificarWA(base44, notifIntegrationId, msg);
            await notificarInterno(base44, fila, msg);
            erros++; continue;
          }
        }

        // ── MSG1 ─────────────────────────────────────────────────────────────
        console.log(`[PROCESSAR-FILA] 📤 MSG1 → ${nome}`);
        const respMsg1 = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: fila.integracacao_whatsapp_id,
          numero_destino: tel,
          mensagem: fila.mensagem_1
        });

        if (!respMsg1.data?.success) {
          const motivo = 'Falha ao enviar MSG1 via Z-API';
          await base44.asServiceRole.entities.FilaDisparo.update(fila.id, { status: 'bloqueado', motivo_bloqueio: motivo });
          const msg = `🔴 *BLOQUEADO — Falha MSG1*\n👤 ${nome} (${tel})\n🆔 Fila: \`${fila.id}\`\nErro: ${respMsg1.data?.error || 'desconhecido'}\n\n📝 *Conteúdo MSG1:*\n${fila.mensagem_1 || 'N/A'}`;
          await notificarWA(base44, notifIntegrationId, msg);
          await notificarInterno(base44, fila, msg);
          erros++; continue;
        }

        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'msg1_enviada',
          msg1_enviada_em: agora.toISOString(),
          msg1_z_api_id: respMsg1.data?.messageId || respMsg1.data?.id
        });
        {
          const msg = `✅ *MSG1 enviada*\n👤 ${nome} (${tel})\n🆔 Fila: \`${fila.id}\`\n\n📝 *Conteúdo:*\n${fila.mensagem_1 || 'N/A'}`;
          await notificarWA(base44, notifIntegrationId, msg);
          await notificarInterno(base44, fila, msg);
        }

        // ── Aguardar 1 min ────────────────────────────────────────────────────
        await new Promise(r => setTimeout(r, 60000));

        // ── MSG2 ─────────────────────────────────────────────────────────────
        console.log(`[PROCESSAR-FILA] 📤 MSG2 → ${nome}`);
        const respMsg2 = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: fila.integracacao_whatsapp_id,
          numero_destino: tel,
          mensagem: fila.mensagem_2
        });

        if (!respMsg2.data?.success) {
          await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
            status: 'concluido',
            motivo_bloqueio: 'MSG2 falhou, MSG1 enviada',
            concluido_em: new Date().toISOString()
          });
          const msg = `⚠️ *MSG2 falhou (MSG1 ok)*\n👤 ${nome} (${tel})\n🆔 Fila: \`${fila.id}\`\nErro: ${respMsg2.data?.error || 'desconhecido'}\n\n📝 *Conteúdo MSG2 tentado:*\n${fila.mensagem_2 || 'N/A'}`;
          await notificarWA(base44, notifIntegrationId, msg);
          await notificarInterno(base44, fila, msg);
          erros++; continue;
        }

        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'msg2_enviada',
          msg2_enviada_em: new Date().toISOString(),
          msg2_z_api_id: respMsg2.data?.messageId || respMsg2.data?.id
        });
        {
          const msg = `✅ *MSG2 enviada*\n👤 ${nome} (${tel})\n🆔 Fila: \`${fila.id}\`\n\n📝 *Conteúdo:*\n${fila.mensagem_2 || 'N/A'}`;
          await notificarWA(base44, notifIntegrationId, msg);
          await notificarInterno(base44, fila, msg);
        }

        // ── Aguardar 3 min ────────────────────────────────────────────────────
        await new Promise(r => setTimeout(r, 180000));

        // ── MSG3 (áudio) ──────────────────────────────────────────────────────
        if (fila.mensagem_3_audio_url) {
          console.log(`[PROCESSAR-FILA] 🎤 MSG3 (áudio) → ${nome}`);
          const respMsg3 = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
            integration_id: fila.integracacao_whatsapp_id,
            numero_destino: tel,
            tipo: 'audio',
            audio_url: fila.mensagem_3_audio_url
          });

          if (respMsg3.data?.success) {
            await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
              status: 'msg3_enviada',
              msg3_enviada_em: new Date().toISOString(),
              msg3_z_api_id: respMsg3.data?.messageId || respMsg3.data?.id
            });
            const msg = `🎤 *MSG3 (áudio) enviada*\n👤 ${nome} (${tel})\n🆔 Fila: \`${fila.id}\`\n🔗 URL: ${fila.mensagem_3_audio_url}`;
            await notificarWA(base44, notifIntegrationId, msg);
            await notificarInterno(base44, fila, msg);
          } else {
            const msg = `⚠️ *MSG3 (áudio) falhou*\n👤 ${nome} (${tel})\n🆔 Fila: \`${fila.id}\`\nErro: ${respMsg3.data?.error || 'desconhecido'}\n🔗 URL tentada: ${fila.mensagem_3_audio_url}`;
            await notificarWA(base44, notifIntegrationId, msg);
            await notificarInterno(base44, fila, msg);
          }
        }

        // ── Concluído ─────────────────────────────────────────────────────────
        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'concluido',
          concluido_em: new Date().toISOString()
        });
        {
          const msg =
            `🏁 *Sequência CONCLUÍDA*\n👤 ${nome} (${tel})\n🆔 Fila: \`${fila.id}\`\n\n` +
            `📋 *Resumo do que foi enviado:*\n` +
            `1️⃣ MSG1: ${fila.mensagem_1?.substring(0, 80) || 'N/A'}...\n` +
            `2️⃣ MSG2: ${fila.mensagem_2?.substring(0, 80) || 'N/A'}...\n` +
            `3️⃣ MSG3 (áudio): ${fila.mensagem_3_audio_url ? '✅ enviado' : '—'}`;
          await notificarWA(base44, notifIntegrationId, msg);
          await notificarInterno(base44, fila, msg);
        }

        processadas++;
        console.log(`[PROCESSAR-FILA] ✅ Completo: ${nome} (${fila.id})`);

      } catch (err) {
        console.error(`[PROCESSAR-FILA] ❌ Erro fila ${fila.id}:`, err.message);
        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'bloqueado',
          motivo_bloqueio: err.message
        }).catch(() => {});
        const msg = `🔴 *ERRO INESPERADO*\n🆔 Fila: \`${fila.id}\`\nErro: ${err.message}`;
        await notificarWA(base44, notifIntegrationId, msg);
        await notificarInterno(base44, fila, msg);
        erros++;
      }
    }

    console.log(`[PROCESSAR-FILA] 📊 ${processadas} processadas, ${erros} erros`);
    return Response.json({ success: erros === 0, processados: processadas, erros, timestamp: agora.toISOString() });

  } catch (error) {
    console.error('[PROCESSAR-FILA] ❌ Erro crítico:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});