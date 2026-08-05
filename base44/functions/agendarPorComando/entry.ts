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

    const { texto } = await req.json();
    if (!texto || !texto.trim()) {
      return Response.json({ success: false, mensagem: 'Comando vazio' }, { status: 400 });
    }

    const agora = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short'
    });

    // Usuários internos para resolver destinatário ("para o Matheus")
    const usuarios = await base44.asServiceRole.entities.User.list('', 200);
    const listaNomes = usuarios.map(u => u.full_name).filter(Boolean).join(' | ');

    const intent = await base44.integrations.Core.InvokeLLM({
      prompt: `Você interpreta comandos de agenda em português. Agora é ${agora} (America/Sao_Paulo).
Usuário que está falando: ${user.full_name}.
Usuários internos disponíveis: ${listaNomes}

COMANDO DO USUÁRIO:
"${texto}"

Extraia o item de agenda. Regras:
- destinatario: se o comando for para outra pessoa da lista de usuários internos, coloque o nome EXATO dela. Se for para o próprio solicitante, use "self".
- categoria: "agendamento" (reunião/compromisso com hora marcada), "tarefa" (algo a fazer), "lembrete" (só lembrar), "retorno" (retornar contato), "solicitacao".
- tipo_atividade: "ligacao" se for ligar para alguém, "reuniao_preparacao" se for reunião, "visita", "cobranca", "orcamento", "documento", "follow_up" ou "tarefa".
- prioridade: baixa | media | alta | critica (padrão media).
- data no formato YYYY-MM-DD e hora HH:MM (24h). Se não houver hora, use 09:00. Se não houver data, use hoje ou o próximo dia útil coerente com o comando.
- titulo: curto e objetivo, sem a palavra "agendar".`,
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

    // Destinatário: para outra pessoa → vira SOLICITAÇÃO no fluxo dela
    const alvoNome = (intent.destinatario || 'self').trim();
    const destinatario = alvoNome && alvoNome.toLowerCase() !== 'self'
      ? usuarios.find(u => (u.full_name || '').toLowerCase() === alvoNome.toLowerCase())
        || usuarios.find(u => (u.full_name || '').toLowerCase().includes(alvoNome.toLowerCase()))
      : null;

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