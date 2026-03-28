/**
 * Gera Resumo Executivo Matinal por Atendente
 * Executado às 08:00 (via automação agendada)
 * - Metas do dia
 * - Top 3 clientes prioritários
 * - Pontos de atenção das últimas 24h
 * - Enviado via WhatsApp ou exibido no Dashboard
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const antropikKey = Deno.env.get('ANTROPIK_API');
    if (!antropikKey) {
      throw new Error('ANTROPIK_API secret not configured');
    }

    console.log('[RESUMO_MATINAL] 🌅 Iniciando geração de resumos executivos...');

    // 1. Buscar todos os atendentes ativos (users com role='user' e status ativo)
    const atendentes = await base44.asServiceRole.entities.User.filter(
      { role: 'user' },
      '-created_date',
      1000
    );

    if (!atendentes || atendentes.length === 0) {
      console.log('[RESUMO_MATINAL] ⚠️ Nenhum atendente encontrado');
      return Response.json({ 
        success: true, 
        resumos_gerados: 0,
        detalhes: 'Nenhum atendente para processar'
      });
    }

    const resumos = [];
    const erros = [];
    const agora = new Date();
    const _24hAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    // 2. Para cada atendente
    for (const atendente of atendentes) {
      try {
        console.log(`[RESUMO_MATINAL] 📋 Processando atendente: ${atendente.full_name}`);

        // A. Buscar tarefas do dia (pendentes, alta/crítica prioridade)
        const tarefasHoje = await base44.asServiceRole.entities.TarefaInteligente.filter(
          {
            vendedor_responsavel: atendente.full_name,
            status: 'pendente',
            prioridade: { $in: ['alta', 'critica'] }
          },
          '-data_prazo',
          10
        );

        const metasDodia = tarefasHoje.length > 0
          ? tarefasHoje.slice(0, 5).map(t => `${t.titulo} (${t.prioridade})`).join(', ')
          : 'Nenhuma meta crítica definida';

        // B. Buscar contatos prioritários (score alto, últimas interações)
        const contatos = await base44.asServiceRole.entities.Contact.filter(
          {
            vendedor_responsavel: atendente.full_name,
            tipo_contato: { $in: ['lead', 'cliente'] }
          },
          '-cliente_score',
          50
        );

        const top3Clientes = contatos
          .slice(0, 3)
          .map(c => `${c.nome} (Score: ${c.cliente_score || 0})`)
          .join(' | ');

        // C. Buscar threads do atendente nas últimas 24h
        const threads = await base44.asServiceRole.entities.MessageThread.filter(
          {
            assigned_user_id: atendente.id,
            last_message_at: { $gte: _24hAtras.toISOString() }
          },
          '-last_message_at',
          20
        );

        // Contar tipos de interação e alertas
        const contadoresUltimas24h = {
          total_threads_ativos: threads.length,
          threads_sem_resposta: threads.filter(t => t.last_message_sender === 'contact' && !t.last_human_message_at).length,
          threads_urgentes: threads.filter(t => t.status === 'aberta' && t.categorias?.includes('urgente')).length
        };

        // D. Chamar Anthropic para gerar resumo executivo
        const prompt = `Você é um assistente executivo de vendas. Com base nos dados abaixo, gere um resumo matinal conciso e acionável para o atendente ${atendente.full_name}.

**DADOS DO ATENDENTE:**
- Metas Críticas: ${metasDodia}
- Top 3 Clientes: ${top3Clientes || 'Nenhum cliente assinalado'}
- Threads Ativas (24h): ${contadoresUltimas24h.total_threads_ativos}
- Aguardando Resposta: ${contadoresUltimas24h.threads_sem_resposta}
- Threads Urgentes: ${contadoresUltimas24h.threads_urgentes}

**GERE:**
1. **Foco do Dia** (1-2 linhas): O principal objetivo
2. **Clientes Prioritários** (1-2 linhas): Quem focar primeiro
3. **Atenção** (2-3 linhas): Riscos/pontos críticos observados
4. **Dica Rápida** (1 linha): Um conselho prático

Responda em português, tom profissional mas amigável.`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': antropikKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (!response.ok) {
          throw new Error(`Anthropic error: ${response.status}`);
        }

        const ia_response = await response.json();
        const conteudo_resumo = ia_response.content[0]?.text || '';

        // E. Criar registro de resumo para exibição/envio
        const resumoRecord = await base44.asServiceRole.entities.ResumenExecutivoMatinal.create({
          atendente_id: atendente.id,
          atendente_nome: atendente.full_name,
          data_geracao: agora.toISOString(),
          metas_dia: metasDodia,
          clientes_prioritarios: top3Clientes,
          alertas_24h: JSON.stringify(contadoresUltimas24h),
          resumo_ia: conteudo_resumo,
          enviado_whatsapp: false,
          exibido_dashboard: true,
          email_atendente: atendente.email
        });

        // F. Entregar resumo via nexusNotificar → grupo do setor + DM ao atendente
        const setor = atendente.attendant_sector || 'geral';
        const msgResumo =
          `🌅 *Resumo Matinal — ${atendente.full_name}*\n\n` +
          conteudo_resumo +
          `\n\n📋 _Gerado automaticamente em ${new Date(agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}_`;

        await base44.asServiceRole.functions.invoke('nexusNotificar', {
          setor,
          conteudo: msgResumo,
          vendedor_responsavel_id: atendente.id,
          metadata: { resumo_matinal_id: resumoRecord.id }
        }).catch(e => console.warn(`[RESUMO_MATINAL] ⚠️ nexusNotificar falhou para ${atendente.full_name}:`, e.message));

        resumos.push({
          atendente: atendente.full_name,
          id_resumo: resumoRecord.id,
          status: 'sucesso'
        });

        console.log(`[RESUMO_MATINAL] ✅ Resumo gerado e entregue para ${atendente.full_name}`);

      } catch (erro) {
        console.error(`[RESUMO_MATINAL] ❌ Erro ao processar ${atendente.full_name}:`, erro.message);
        erros.push({
          atendente: atendente.full_name,
          erro: erro.message
        });
      }
    }

    console.log(`[RESUMO_MATINAL] ✅ Concluído: ${resumos.length} resumos gerados, ${erros.length} erros`);

    return Response.json({
      success: true,
      timestamp: agora.toISOString(),
      resumos_gerados: resumos.length,
      erros: erros,
      detalhes: resumos
    });

  } catch (error) {
    console.error('[RESUMO_MATINAL] ❌ Erro crítico:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});