import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// ENVIO EM MASSA - Mensagem customizada para múltiplos contatos
// ============================================================================
// Envia MESMA mensagem (com personalização) para lista de contatos
// SEM delay, SEM IA, SEM promoções - apenas broadcast direto
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { contact_ids, mensagem, personalizar = true } = await req.json();

    if (!contact_ids?.length) {
      return Response.json({ success: false, error: 'contact_ids obrigatório' }, { status: 400 });
    }

    if (!mensagem?.trim()) {
      return Response.json({ success: false, error: 'mensagem obrigatória' }, { status: 400 });
    }

    console.log(`[ENVIO-MASSA] 📤 Processando ${contact_ids.length} contatos`);

    const now = new Date();
    const resultados = { enviados: 0, erros: 0, detalhes: [] };

    // Buscar contatos em lote
    const contatos = await base44.asServiceRole.entities.Contact.filter({
      id: { $in: contact_ids }
    });

    const contatosMap = new Map(contatos.map(c => [c.id, c]));

    for (const contact_id of contact_ids) {
      try {
        const contato = contatosMap.get(contact_id);
        
        if (!contato) {
          console.log(`[ENVIO-MASSA] ⚠️ Contato ${contact_id} não encontrado`);
          resultados.erros++;
          continue;
        }

        // Buscar thread canônica
        const threads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id,
          is_canonical: true,
          thread_type: 'contact_external'
        }, '-last_message_at', 1);

        if (!threads.length) {
          console.log(`[ENVIO-MASSA] ⚠️ Thread não encontrada: ${contato.nome}`);
          resultados.erros++;
          resultados.detalhes.push({ nome: contato.nome, erro: 'Thread não encontrada' });
          continue;
        }

        const thread = threads[0];

        // Personalizar mensagem
        let textoFinal = mensagem;
        
        if (personalizar) {
          textoFinal = textoFinal
            .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
            .replace(/\{\{empresa\}\}/gi, contato.empresa || '');
        }

        // ✅ ENVIO DIRETO: Usa enviarWhatsApp que funciona com service role
        const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: thread.whatsapp_integration_id,
          numero_destino: contato.telefone,
          mensagem: textoFinal
        });

        if (resp.data?.success) {
          resultados.enviados++;
          console.log(`[ENVIO-MASSA] ✅ ${contato.nome}`);
        } else {
          throw new Error(resp.data?.error || 'Erro no envio');
        }

        // Anti-rate-limit
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        resultados.erros++;
        const contato = contatosMap.get(contact_id);
        resultados.detalhes.push({
          nome: contato?.nome || contact_id,
          erro: error.message
        });
        console.error(`[ENVIO-MASSA] ❌ ${contact_id}:`, error.message);
      }
    }

    console.log('[ENVIO-MASSA] ✅ Concluído:', resultados);

    return Response.json({
      success: true,
      enviados: resultados.enviados,
      erros: resultados.erros,
      detalhes: resultados.detalhes,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[ENVIO-MASSA] ❌ Erro geral:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});