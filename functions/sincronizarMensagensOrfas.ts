import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Helper: Normalizar telefone (remover caracteres especiais, manter apenas dígitos)
function normalizarTelefone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[\s\-\(\)\+]/g, '').replace(/^0+/, '');
}

// Helper: Comparar últimos 10-11 dígitos
function telefonesBatam(phone1, phone2) {
  const norm1 = normalizarTelefone(phone1);
  const norm2 = normalizarTelefone(phone2);
  
  if (!norm1 || !norm2) return false;
  
  // Pega últimos 11 dígitos (para número com 9 dígito celular + 2 DDD)
  const suffix1 = norm1.slice(-11);
  const suffix2 = norm2.slice(-11);
  
  return suffix1 === suffix2;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Apenas admin pode usar
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode usar' }, { status: 403 });
    }

    const body = await req.json();
    const { thread_id, contact_id, periodo_horas = 48, modo = 'diagnostico' } = body;

    console.log(`[sincronizarMensagensOrfas] Iniciando ${modo} com periodo=${periodo_horas}h`);

    // STEP 1: Buscar threads suspeitas
    const query = {
      thread_type: 'contact_external',
      status: { $in: ['aberta', 'Aberta'] }
    };

    if (thread_id) {
      query.id = thread_id;
    }
    if (contact_id) {
      query.contact_id = contact_id;
    }

    const threadsSuspeitas = await base44.asServiceRole.entities.MessageThread.filter(query, '-created_date', 1000);
    console.log(`[sincronizarMensagensOrfas] ${threadsSuspeitas.length} threads suspeitas encontradas`);

    const detalhes = [];
    let totalOrfas = 0;
    let totalRevinculadas = 0;
    let totalErros = 0;

    // STEP 2-4: Para cada thread suspeita
    for (const thread of threadsSuspeitas) {
      try {
        // Obter contato
        const contatos = await base44.asServiceRole.entities.Contact.filter({ id: thread.contact_id });
        if (!contatos || contatos.length === 0) {
          console.warn(`[sincronizarMensagensOrfas] Contato não encontrado: ${thread.contact_id}`);
          continue;
        }

        const contato = contatos[0];
        const telefoneContato = contato.telefone || contato.telefone_canonico;

        if (!telefoneContato) {
          console.warn(`[sincronizarMensagensOrfas] Contato sem telefone: ${contato.id}`);
          continue;
        }

        console.log(`[sincronizarMensagensOrfas] Analisando thread ${thread.id} - contato ${contato.nome}`);

        // Calcular período
        const agora = new Date();
        const periodoAtras = new Date(agora.getTime() - periodo_horas * 60 * 60 * 1000);

        // STEP 2: Buscar mensagens órfãs
        // Critério 1: Mensagens com sender_id = contato mas thread_id diferente OU vazio
        const msgsSuspeitas = await base44.asServiceRole.entities.Message.filter({
          sender_id: contato.id,
          sender_type: 'contact',
          sent_at: { $gte: periodoAtras.toISOString() }
        }, '-sent_at', 1000);

        console.log(`[sincronizarMensagensOrfas] ${msgsSuspeitas.length} mensagens recebidas encontradas`);

        const orfasEncontradas = [];

        // Filtrar apenas as órfãs (thread_id diferente ou vazio)
        for (const msg of msgsSuspeitas) {
          if (!msg.thread_id || msg.thread_id !== thread.id) {
            orfasEncontradas.push(msg);
          }
        }

        console.log(`[sincronizarMensagensOrfas] ${orfasEncontradas.length} mensagens órfãs encontradas para este thread`);

        totalOrfas += orfasEncontradas.length;

        // STEP 3-4: Revinculação (apenas se modo = 'correcao')
        let revinculadas = 0;

        if (modo === 'correcao' && orfasEncontradas.length > 0) {
          for (const msg of orfasEncontradas) {
            try {
              await base44.asServiceRole.entities.Message.update(msg.id, {
                thread_id: thread.id,
                // Certifica que o contact_id está correto também
                recipient_id: contato.id
              });

              revinculadas++;
              console.log(`[sincronizarMensagensOrfas] ✅ Revinculada mensagem ${msg.id}`);
            } catch (err) {
              totalErros++;
              console.error(`[sincronizarMensagensOrfas] ❌ Erro ao revincular ${msg.id}:`, err.message);
            }
          }

          // STEP 5: Atualizar contadores da thread
          if (revinculadas > 0) {
            try {
              // Recontar mensagens
              const todasAsMsgs = await base44.asServiceRole.entities.Message.filter(
                { thread_id: thread.id },
                '-sent_at'
              );

              // Recontar não lidas (aqui simplificamos: contamos recebidas com status !== 'lida')
              const naoLidas = todasAsMsgs.filter(m => m.sender_type === 'contact' && m.status !== 'lida').length;

              const ultimaMsg = todasAsMsgs.length > 0 ? todasAsMsgs[0] : null;

              await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                total_mensagens: todasAsMsgs.length,
                unread_count: naoLidas,
                last_message_at: ultimaMsg?.sent_at || ultimaMsg?.created_date,
                last_message_sender: ultimaMsg?.sender_type
              });

              console.log(`[sincronizarMensagensOrfas] ✅ Thread ${thread.id} atualizada: ${todasAsMsgs.length} msgs, ${naoLidas} não lidas`);
            } catch (err) {
              console.error(`[sincronizarMensagensOrfas] ❌ Erro ao atualizar contadores:`, err.message);
            }
          }
        }

        totalRevinculadas += revinculadas;

        // Adicionar ao relatório
        detalhes.push({
          thread_id: thread.id,
          contato_nome: contato.nome,
          contato_id: contato.id,
          telefone_contato: telefoneContato,
          mensagens_encontradas: orfasEncontradas.length,
          mensagens_revinculadas: revinculadas,
          status: orfasEncontradas.length === 0 ? 'ok' : (revinculadas > 0 ? 'sucesso' : 'pendente')
        });
      } catch (err) {
        totalErros++;
        console.error(`[sincronizarMensagensOrfas] ❌ Erro processando thread ${thread.id}:`, err.message);
      }
    }

    // STEP 6: Retornar resultado
    const resultado = {
      success: true,
      threads_analisadas: threadsSuspeitas.length,
      mensagens_orfas_encontradas: totalOrfas,
      mensagens_revinculadas: totalRevinculadas,
      erro_count: totalErros,
      modo: modo,
      detalhes: detalhes
    };

    console.log(`[sincronizarMensagensOrfas] ✅ Concluído: ${totalOrfas} órfãs encontradas, ${totalRevinculadas} revinculadas`);

    return Response.json(resultado);
  } catch (error) {
    console.error('[sincronizarMensagensOrfas] Erro fatal:', error);
    return Response.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
});