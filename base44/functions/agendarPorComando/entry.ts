import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ═══════════════════════════════════════════════════════════════════
// 🎙️ AGENDAR POR COMANDO (voz ou texto) — Agenda Nexus
// Interpreta o comando natural e cria o item CORRETO:
//  - tarefa / lembrete / retorno / ligação  → ScheduleTask
//  - agendamento / reunião (evento com hora) → ScheduleEvent
// ENTRADA: { texto }
// SAÍDA:   { success, tipo, id, mensagem }
// ═══════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, mensagem: 'Não autenticado' }, { status: 401 });
    }

    const { texto, thread_id } = await req.json();
    if (!texto || !texto.trim()) {
      return Response.json({ success: false, mensagem: 'Comando vazio' }, { status: 400 });
    }

    // ── Enriquecimento de contexto: quando o comando nasce de uma conversa,
    // carregamos identificação do contato/cliente e as últimas mensagens.
    let contextoConversa = '';
    let vinculo = { thread_id: null, contact_id: null, cliente_id: null };

    if (thread_id) {
      const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id).catch(() => null);
      if (thread) {
        vinculo = {
          thread_id: thread.id,
          contact_id: thread.contact_id || null,
          cliente_id: thread.cliente_id || null
        };

        let nomeContato = '';
        if (thread.contact_id) {
          const contato = await base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null);
          nomeContato = contato ? `${contato.nome}${contato.empresa ? ` (${contato.empresa})` : ''}` : '';
        }

        const mensagens = await base44.asServiceRole.entities.Message
          .filter({ thread_id: thread.id }, '-created_date', 8)
          .catch(() => []);

        const historico = mensagens.reverse()
          .map(m => `- ${m.sender_type === 'contact' ? (nomeContato || 'Contato') : 'Nós'}: ${String(m.content || '').slice(0, 300)}`)
          .join('\n');

        contextoConversa = `
CONTEXTO DA CONVERSA (use para deixar título e descrição específicos):
Contato/Empresa: ${nomeContato || 'não identificado'}
Últimas mensagens:
${historico || '(sem mensagens recentes)'}
`;
      }
    }

    const agora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short'
    });

    // Catálogo único de usuários ativos, nomes funcionais e apelidos reconhecidos.
    const normalizar = (valor) => String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9@.]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    const usuarios = (await base44.asServiceRole.entities.User.list('', 200))
      .filter(u => u.is_active !== false && u.disabled !== true);

    const aliasesPorLogin = {
      financeiro: ['financeiro', 'tiffany', 'tifhany', 'tifany'],
      comprasneural360: ['compras', 'compras tec360', 'mateus', 'matheus'],
      vendas1: ['vendas 1', 'vendas1', 'tiago'],
      vendas5: ['vendas 5', 'vendas5', 'vendas', 'thais', 'thaís']
    };

    const catalogo = usuarios.map(u => {
      const login = normalizar((u.email || '').split('@')[0]);
      const aliases = [
        u.full_name,
        u.display_name,
        login,
        ...(aliasesPorLogin[login] || [])
      ].map(normalizar).filter(Boolean);
      return { usuario: u, login, aliases: [...new Set(aliases)] };
    });

    const resolverDestinatario = (referencia) => {
      const alvo = normalizar(referencia);
      if (!alvo || ['self', 'eu', 'mim', 'me'].includes(alvo)) return null;

      const exatos = catalogo.filter(item => item.aliases.includes(alvo));
      if (exatos.length === 1) return exatos[0].usuario;

      const parciais = catalogo.filter(item => item.aliases.some(alias => alias.length >= 4 && alvo.includes(alias)));
      return parciais.length === 1 ? parciais[0].usuario : undefined;
    };

    const listaNomes = catalogo.map(({ usuario: u, aliases }) =>
      `${u.id} | cadastro=${u.full_name || ''} | pessoa=${u.display_name || ''} | setor=${u.attendant_sector || 'geral'} | reconhece=${aliases.join(', ')}`
    ).join('\n');

    const intent = await base44.integrations.Core.InvokeLLM({
      prompt: `Você interpreta comandos de agenda em português. Agora é ${agora} (America/Sao_Paulo).
Usuário que está falando: ${user.full_name}.
CATÁLOGO INTERNO (ID, cadastro, pessoa, setor e nomes reconhecidos):
${listaNomes}

${contextoConversa}
COMANDO DO USUÁRIO:
"${texto}"

Extraia o item de agenda. Regras:
- destinatario: identifique por nome de cadastro, nome da pessoa, apelido ou setor e devolva um nome reconhecido do catálogo. Se for para o próprio solicitante, use "self".
- Mapeamentos obrigatórios: Financeiro/Tiffany/Tifhany = financeiro; Compras/Mateus/Matheus = comprasneural360; Vendas 1/Tiago = vendas1; Vendas 5/Vendas/Thaís/Thais = vendas5.
- Nunca invente destinatário. Se não houver indicação explícita de outra pessoa ou setor, use "self".
- categoria: "agendamento" (reunião/compromisso com hora marcada), "tarefa" (algo a fazer), "lembrete" (só lembrar), "retorno" (retornar contato), "solicitacao".
- tipo_atividade: "ligacao" se for ligar para alguém, "reuniao_preparacao" se for reunião, "visita", "cobranca", "orcamento", "documento", "follow_up" ou "tarefa".
- prioridade: baixa | media | alta | critica (padrão media).
- data no formato YYYY-MM-DD e hora HH:MM (24h). Se não houver hora, use 09:00. Se não houver data, use hoje ou o próximo dia útil coerente com o comando.
- titulo: curto e objetivo, sem a palavra "agendar". Se houver CONTEXTO DA CONVERSA, o título DEVE citar quem/empresa e o assunto concreto (ex.: "Ligar para Pamplona sobre orçamento das fechaduras") — nunca use termos genéricos como "o fornecedor" ou "o cliente".
- descricao: 1 a 3 frases com os detalhes concretos do contexto (valores, produtos, prazos e pendências citados). Nunca escreva "conforme combinado" sem dizer o que foi combinado.`,
      response_json_schema: {
        type: 'object',
        properties: {
          destinatario: { type: 'string' },
          categoria: { type: 'string', enum: ['solicitacao', 'tarefa', 'agendamento', 'lembrete', 'retorno'] },
          tipo_atividade: { type: 'string' },
          titulo: { type: 'string' },
          descricao: { type: 'string' },
          data: { type: 'string' },
          hora: { type: 'string' },
          prioridade: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] }
        },
        required: ['categoria', 'titulo', 'data', 'hora']
      }
    });

    const quando = `${intent.data}T${intent.hora.length === 5 ? intent.hora : '09:00'}:00`;
    const tiposValidos = ['tarefa', 'follow_up', 'ligacao', 'reuniao_preparacao', 'visita', 'cobranca', 'orcamento', 'atendimento', 'documento', 'atividade_interna'];
    const tipoAtividade = tiposValidos.includes(intent.tipo_atividade) ? intent.tipo_atividade : 'tarefa';

    // Validação determinística: a IA sugere, mas o backend só aceita um cadastro único.
    const alvoNome = (intent.destinatario || 'self').trim();
    const destinatario = resolverDestinatario(alvoNome);
    if (destinatario === undefined) {
      return Response.json({
        success: false,
        mensagem: `Não identifiquei com segurança o destinatário "${alvoNome}". Use o nome da pessoa ou do usuário cadastrado.`
      }, { status: 422 });
    }

    const responsavelId = destinatario?.id || user.id;
    const categoria = destinatario ? 'solicitacao' : (intent.categoria || 'tarefa');

    // Agendamento/reunião para si mesmo → evento no calendário
    if (categoria === 'agendamento') {
      const evento = await base44.asServiceRole.entities.ScheduleEvent.create({
        created_by_type: 'internal_user',
        created_by_id: user.id,
        organizer_id: user.id,
        assigned_user_id: user.id,
        title: intent.titulo,
        description: intent.descricao || '',
        categoria: 'agendamento',
        start_at: quando,
        timezone: 'America/Sao_Paulo',
        status: 'scheduled',
        event_type: tipoAtividade === 'ligacao' ? 'ligacao' : 'reuniao',
        source_thread_id: vinculo.thread_id,
        contact_id: vinculo.contact_id,
        cliente_id: vinculo.cliente_id,
        auto_committed: true
      });

      return Response.json({
        success: true,
        tipo: 'evento',
        id: evento.id,
        mensagem: `📅 Agendado: ${intent.titulo} — ${intent.data} às ${intent.hora}`
      });
    }

    // Tarefa / lembrete / retorno / ligação → ScheduleTask
    const tarefa = await base44.asServiceRole.entities.ScheduleTask.create({
      titulo: intent.titulo,
      descricao: intent.descricao || '',
      categoria,
      status: 'pendente',
      prioridade: intent.prioridade || 'media',
      tipo_atividade: tipoAtividade,
      origem: 'ia',
      responsavel_id: responsavelId,
      participantes_ids: destinatario ? [user.id] : [],
      thread_id: vinculo.thread_id,
      contact_id: vinculo.contact_id,
      cliente_id: vinculo.cliente_id,
      context_type: vinculo.thread_id ? 'MessageThread' : null,
      context_id: vinculo.thread_id,
      prazo_em: quando
    });

    const rotulo = { tarefa: '✅ Tarefa', lembrete: '🔔 Lembrete', retorno: '↩️ Retorno', solicitacao: '📨 Solicitação' }[categoria] || '✅ Tarefa';
    const paraQuem = destinatario ? ` → ${destinatario.full_name}` : '';

    return Response.json({
      success: true,
      tipo: 'tarefa',
      id: tarefa.id,
      mensagem: `${rotulo}${paraQuem}: ${intent.titulo} — ${intent.data} às ${intent.hora}`
    });

  } catch (error) {
    console.error('[AGENDAR-COMANDO] Erro:', error.message);
    return Response.json({ success: false, mensagem: error.message }, { status: 500 });
  }
});