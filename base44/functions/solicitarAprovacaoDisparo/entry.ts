import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ============================================================================
// SOLICITAR APROVAÇÃO DISPARO v1.0
// ============================================================================
// Lê FilaDisparo pendentes → cria Message interna para vendedor → seta status

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const agora = new Date();

  try {
    console.log('[SOLICITAR-APROVACAO] 🔍 Buscando FilaDisparo pendentes...');

    // 1. Buscar FilaDisparo com status "pendente"
    const filasPendentes = await base44.asServiceRole.entities.FilaDisparo.filter(
      { status: 'pendente' },
      '-created_date',
      20
    );

    if (filasPendentes.length === 0) {
      console.log('[SOLICITAR-APROVACAO] ✅ Nenhuma fila pendente');
      return Response.json({
        success: true,
        processados: 0,
        message: 'Nenhuma fila pendente para aprovação'
      });
    }

    console.log(`[SOLICITAR-APROVACAO] 📋 ${filasPendentes.length} filas encontradas`);

    let processadas = 0;
    let erros = 0;

    for (const fila of filasPendentes) {
      try {
        // 2. Buscar dados do contato e usuário
        const [contato, vendedor] = await Promise.all([
          base44.asServiceRole.entities.Contact.get(fila.contact_id),
          fila.vendedor_responsavel_id
            ? base44.asServiceRole.entities.User.get(fila.vendedor_responsavel_id)
            : null
        ]);

        if (!contato) {
          console.warn(`[SOLICITAR-APROVACAO] ⚠️ Contato ${fila.contact_id} não encontrado`);
          erros++;
          continue;
        }

        // 3. Resolver thread de setor para mensagem interna
        const setor = fila.setor || 'vendas';
        const sectorThreads = await base44.asServiceRole.entities.MessageThread.filter(
          { thread_type: 'sector_group', sector_key: `sector:${setor}` },
          '-created_date',
          1
        );

        let threadInternal = sectorThreads[0];

        // Criar thread de setor se não existir
          if (!threadInternal) {
            console.log(`[SOLICITAR-APROVACAO] 🆕 Criando thread de setor: ${setor}`);
            threadInternal = await base44.asServiceRole.entities.MessageThread.create({
              thread_type: 'sector_group',
              sector_key: `sector:${setor}`,
              sector_id: setor,
              group_name: `Setor ${setor}`,
              status: 'aberta',
              is_group_chat: true,
              participants: [] // Inicializar vazio — Jarvis vai populating em outras operações
            });
          }

        // 4. Criar Message interna pedindo aprovação
        const nomeContato = contato.nome || 'Contato';
        const msgContent = `📋 *Solicitação de Aprovação*\n\nContato: *${nomeContato}*\nMotivo: ${fila.motivo_reativacao || 'manual'}\n\n💬 MSG1: ${fila.mensagem_1?.substring(0, 100) || 'N/A'}...\n\nApova? (SIM/NÃO)\n\n🔗 Fila ID: ${fila.id}`;

        await base44.asServiceRole.entities.Message.create({
          thread_id: threadInternal.id,
          sender_id: 'jarvis_copiloto_ia',
          sender_type: 'user',
          content: msgContent,
          channel: 'interno',
          visibility: 'internal_only',
          provider: 'internal_system',
          status: 'enviada',
          sent_at: agora.toISOString(),
          metadata: {
            is_internal_message: true,
            is_1on1: false,
            sender_name: '🤖 Nexus Disparos',
            approval_request: true,
            fila_disparo_id: fila.id,
            contact_id: fila.contact_id
          }
        });

        // 5. Atualizar status da fila
        await base44.asServiceRole.entities.FilaDisparo.update(fila.id, {
          status: 'aguardando_aprovacao'
        });

        processadas++;
        console.log(`[SOLICITAR-APROVACAO] ✅ Notificação enviada: ${nomeContato} (fila ${fila.id})`);

      } catch (err) {
        console.error(`[SOLICITAR-APROVACAO] ❌ Erro ao processar fila ${fila.id}:`, err.message);
        erros++;
      }
    }

    console.log(`[SOLICITAR-APROVACAO] 📊 Resumo: ${processadas} processadas, ${erros} erros`);

    return Response.json({
      success: erros === 0,
      processados: processadas,
      erros,
      timestamp: agora.toISOString()
    });

  } catch (error) {
    console.error('[SOLICITAR-APROVACAO] ❌ Erro crítico:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});