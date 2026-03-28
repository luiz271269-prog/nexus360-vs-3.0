import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// SOLICITAR APROVAÇÃO DISPARO v3.0 — Refatorado para usar nexusNotificar
// ============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const agora = new Date();

  try {
    console.log('[SOLICITAR-APROVACAO] 🔍 Buscando FilaDisparo pendentes...');

    const filasPendentes = await base44.asServiceRole.entities.FilaDisparo.filter(
      { status: 'pendente' }, '-created_date', 20
    );

    if (filasPendentes.length === 0) {
      console.log('[SOLICITAR-APROVACAO] ✅ Nenhuma fila pendente');
      return Response.json({ success: true, processados: 0, message: 'Nenhuma fila pendente' });
    }

    console.log(`[SOLICITAR-APROVACAO] 📋 ${filasPendentes.length} filas encontradas`);

    let processadas = 0;
    let erros = 0;

    for (const fila of filasPendentes) {
      try {
        const [contato, vendedor] = await Promise.all([
          base44.asServiceRole.entities.Contact.get(fila.contact_id),
          fila.vendedor_responsavel_id
            ? base44.asServiceRole.entities.User.get(fila.vendedor_responsavel_id)
            : Promise.resolve(null)
        ]);

        if (!contato) {
          console.warn(`[SOLICITAR-APROVACAO] ⚠️ Contato ${fila.contact_id} não encontrado`);
          erros++;
          continue;
        }

        const setor = fila.setor || 'vendas';
        const nomeContato = contato.nome || 'Contato';
        const nomeVendedor = vendedor?.full_name || 'Vendedor';

        const msgContent =
          `📋 *Solicitação de Aprovação de Disparo*\n\n` +
          `👤 Contato: *${nomeContato}*\n` +
          `📞 Telefone: ${contato.telefone || 'N/A'}\n` +
          `🏷️ Motivo: ${fila.motivo_reativacao || 'manual'}\n` +
          `👔 Vendedor: ${nomeVendedor}\n` +
          `🆔 Fila ID: \`${fila.id}\`\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💬 *MSG1 (texto):*\n${fila.mensagem_1 || 'N/A'}\n\n` +
          `💬 *MSG2 (texto):*\n${fila.mensagem_2 || 'N/A'}\n\n` +
          `🎤 *MSG3 (áudio):* ${fila.mensagem_3_audio_url || 'Não configurado'}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `✅ Responda *APROVAR* ou ❌ *REJEITAR*`;

        // Delegar envio ao nexusNotificar (grupo do setor + DM ao vendedor)
        await base44.asServiceRole.functions.invoke('nexusNotificar', {
          setor,
          conteudo: msgContent,
          vendedor_responsavel_id: fila.vendedor_responsavel_id || undefined,
          metadata: {
            approval_request: true,
            fila_disparo_id: fila.id,
            contact_id: fila.contact_id
          }
        });

        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'aguardando_aprovacao'
        });

        processadas++;
        console.log(`[SOLICITAR-APROVACAO] ✅ Fila processada: ${nomeContato} (${fila.id})`);

      } catch (err) {
        console.error(`[SOLICITAR-APROVACAO] ❌ Erro fila ${fila.id}:`, err.message);
        erros++;
      }
    }

    console.log(`[SOLICITAR-APROVACAO] 📊 ${processadas} processadas, ${erros} erros`);

    return Response.json({
      success: erros === 0,
      processados: processadas,
      erros,
      timestamp: agora.toISOString()
    });

  } catch (error) {
    console.error('[SOLICITAR-APROVACAO] ❌ Erro crítico:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});