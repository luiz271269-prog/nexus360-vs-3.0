import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// PROCESSAR FILA DISPARO v1.0
// ============================================================================
// Monitora FilaDisparo aprovadas → executa sequência Z-API → atualiza status

const NOTIF_NUMERO = '48999322400';
const NOTIF_INTEGRATION_ID = null; // será buscado dinamicamente

async function notificar(base44, integrationId, mensagem) {
  try {
    if (!integrationId) return;
    await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: integrationId,
      numero_destino: NOTIF_NUMERO,
      mensagem
    });
  } catch (e) {
    console.warn('[PROCESSAR-FILA] ⚠️ Falha ao notificar:', e.message);
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const agora = new Date();

  try {
    console.log('[PROCESSAR-FILA] 🚀 Iniciando processamento de filas...');

    // 1. Buscar filas APROVADAS prontas para envio
    const filasAprovadas = await base44.asServiceRole.entities.FilaDisparo.filter(
      { status: 'aprovado' },
      '-aprovado_em',
      10
    );

    if (filasAprovadas.length === 0) {
      console.log('[PROCESSAR-FILA] ✅ Nenhuma fila aprovada para processar');
      return Response.json({
        success: true,
        processados: 0,
        message: 'Nenhuma fila aprovada'
      });
    }

    console.log(`[PROCESSAR-FILA] 📊 ${filasAprovadas.length} filas aprovadas encontradas`);

    // Buscar primeira integração conectada para notificações
    const integracoesAtivas = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { status: 'conectado' }, '-created_date', 1
    );
    const notifIntegrationId = integracoesAtivas[0]?.id || null;

    let processadas = 0;
    let erros = 0;

    for (const fila of filasAprovadas) {
      try {
        // 2. Validar integração WhatsApp
        const integracao = fila.integracacao_whatsapp_id
          ? await base44.asServiceRole.entities.WhatsAppIntegration.get(
              fila.integracacao_whatsapp_id
            )
          : null;

        if (!integracao) {
          console.warn(`[PROCESSAR-FILA] ⚠️ Integração não encontrada para fila ${fila.id}`);
          await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
            status: 'bloqueado',
            motivo_bloqueio: 'Integração WhatsApp não disponível'
          });
          await notificar(base44, notifIntegrationId, `🔴 *FilaDisparo BLOQUEADA*\nFila: ${fila.id}\nMotivo: Integração WhatsApp não disponível`);
          erros++;
          continue;
        }

        // 3. Buscar contato
        const contato = await base44.asServiceRole.entities.Contact.get(fila.contact_id);
        if (!contato || !contato.telefone) {
          console.warn(`[PROCESSAR-FILA] ⚠️ Contato sem telefone: ${fila.contact_id}`);
          await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
            status: 'bloqueado',
            motivo_bloqueio: 'Contato sem telefone válido'
          });
          await notificar(base44, notifIntegrationId, `🔴 *FilaDisparo BLOQUEADA*\nContato: ${fila.contact_id}\nMotivo: Sem telefone válido`);
          erros++;
          continue;
        }

        // 3.5. Validar 7 dias anti-duplicata
        if (contato.last_any_promo_sent_at) {
          const diasDesdeUltimo = (agora - new Date(contato.last_any_promo_sent_at)) / (1000 * 60 * 60 * 24);
          if (diasDesdeUltimo < 7) {
            console.warn(`[PROCESSAR-FILA] ⏸️ Contato ${contato.nome} enviado há ${diasDesdeUltimo.toFixed(1)}d (< 7 dias) — bloqueado`);
            await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
              status: 'bloqueado',
              motivo_bloqueio: `Anti-duplicata: último envio há ${diasDesdeUltimo.toFixed(1)} dias`
            });
            await notificar(base44, notifIntegrationId, `⏸️ *FilaDisparo BLOQUEADA (anti-duplicata)*\nContato: ${contato.nome}\nÚltimo envio há ${diasDesdeUltimo.toFixed(1)} dias`);
            erros++;
            continue;
          }
        }

        // 4. Enviar MSG1 via Z-API
        console.log(`[PROCESSAR-FILA] 📤 Enviando MSG1 para ${contato.nome}...`);

        const respMsg1 = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: fila.integracacao_whatsapp_id,
          numero_destino: contato.telefone,
          mensagem: fila.mensagem_1
        });

        if (!respMsg1.data?.success) {
          console.error(`[PROCESSAR-FILA] ❌ Falha ao enviar MSG1:`, respMsg1.data?.error);
          await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
            status: 'bloqueado',
            motivo_bloqueio: 'Falha ao enviar MSG1 via Z-API'
          });
          await notificar(base44, notifIntegrationId, `🔴 *FilaDisparo BLOQUEADA*\nContato: ${contato.nome}\nMotivo: Falha ao enviar MSG1`);
          erros++;
          continue;
        }

        // Atualizar status para msg1_enviada
        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'msg1_enviada',
          msg1_enviada_em: agora.toISOString(),
          msg1_z_api_id: respMsg1.data?.messageId || respMsg1.data?.id
        });

        console.log(`[PROCESSAR-FILA] ✅ MSG1 enviada (${fila.id})`);

        // 5. Aguardar 1 minuto e enviar MSG2
        await new Promise(resolve => setTimeout(resolve, 60000));

        console.log(`[PROCESSAR-FILA] 📤 Enviando MSG2 para ${contato.nome}...`);

        const respMsg2 = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: fila.integracacao_whatsapp_id,
          numero_destino: contato.telefone,
          mensagem: fila.mensagem_2
        });

        if (!respMsg2.data?.success) {
          console.warn(`[PROCESSAR-FILA] ⚠️ Falha ao enviar MSG2:`, respMsg2.data?.error);
          // Marcar como concluído mesmo com falha em MSG2
          await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
            status: 'concluido',
            motivo_bloqueio: 'MSG2 falhou, mas MSG1 foi enviada',
            concluido_em: agora.toISOString()
          });
          erros++;
          continue;
        }

        // Atualizar para msg2_enviada
        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'msg2_enviada',
          msg2_enviada_em: agora.toISOString(),
          msg2_z_api_id: respMsg2.data?.messageId || respMsg2.data?.id
        });

        // 6. Aguardar 3 minutos e enviar MSG3 (áudio)
        await new Promise(resolve => setTimeout(resolve, 180000));

        if (fila.mensagem_3_audio_url) {
          console.log(`[PROCESSAR-FILA] 🎤 Enviando MSG3 (áudio) para ${contato.nome}...`);

          const respMsg3 = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
            integration_id: fila.integracacao_whatsapp_id,
            numero_destino: contato.telefone,
            tipo: 'audio',
            audio_url: fila.mensagem_3_audio_url
          });

          if (respMsg3.data?.success) {
            await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
              status: 'msg3_enviada',
              msg3_enviada_em: new Date().toISOString(),
              msg3_z_api_id: respMsg3.data?.messageId || respMsg3.data?.id
            });
            console.log(`[PROCESSAR-FILA] ✅ MSG3 (áudio) enviada (${fila.id})`);
          } else {
            console.warn(`[PROCESSAR-FILA] ⚠️ Falha ao enviar MSG3 (áudio):`, respMsg3.data?.error);
          }
        }

        // Marcar como concluído
        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'concluido',
          concluido_em: new Date().toISOString()
        });

        processadas++;
        console.log(`[PROCESSAR-FILA] ✅ Sequência completa: ${contato.nome} (fila ${fila.id})`);

      } catch (err) {
        console.error(`[PROCESSAR-FILA] ❌ Erro ao processar fila ${fila.id}:`, err.message);
        
        // Atualizar fila com status de erro
        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'bloqueado',
          motivo_bloqueio: err.message
        }).catch(() => {});

        erros++;
      }
    }

    console.log(`[PROCESSAR-FILA] 📊 Resumo: ${processadas} processadas, ${erros} erros`);

    return Response.json({
      success: erros === 0,
      processados: processadas,
      erros,
      timestamp: agora.toISOString()
    });

  } catch (error) {
    console.error('[PROCESSAR-FILA] ❌ Erro crítico:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});