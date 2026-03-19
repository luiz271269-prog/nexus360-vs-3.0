import { createClient } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// PROCESSAR FILA DISPARO v1.0
// ============================================================================
// Monitora FilaDisparo aprovadas → executa sequência Z-API → atualiza status

Deno.serve(async (req) => {
  const base44 = createClient();
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
          erros++;
          continue;
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

        // 6. Aguardar 3 minutos
        await new Promise(resolve => setTimeout(resolve, 180000));

        // Marcar como concluído
        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'concluido',
          concluido_em: agora.toISOString()
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