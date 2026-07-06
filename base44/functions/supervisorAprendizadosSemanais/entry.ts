import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Agente Supervisor — sumariza os 3 maiores aprendizados da semana
// e cria sugestões pendentes (aprovado=false) na BaseConhecimento.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const db = base44.asServiceRole.entities;

    // Coleta dados da semana
    const [vendas, orcamentos, logsErro, conhecimentosRecentes] = await Promise.all([
      db.Venda.filter({ created_date: { $gte: seteDiasAtras } }, '-created_date', 50).catch(() => []),
      db.Orcamento.filter({ updated_date: { $gte: seteDiasAtras } }, '-updated_date', 100).catch(() => []),
      db.AutomationLog.filter({ resultado: 'erro', created_date: { $gte: seteDiasAtras } }, '-created_date', 30).catch(() => []),
      db.BaseConhecimento.filter({ created_date: { $gte: seteDiasAtras } }, '-created_date', 30).catch(() => [])
    ]);

    const resumoOrcamentos = orcamentos.map(o => ({
      status: o.status, valor: o.valor_total, cliente: o.cliente_nome, probabilidade: o.probabilidade
    }));
    const resumoVendas = vendas.map(v => ({ valor: v.valor_total || v.valor, cliente: v.cliente_nome }));
    const resumoErros = logsErro.map(l => ({ acao: l.acao, erro: l.detalhes?.erro_mensagem || l.detalhes?.mensagem }));

    const prompt = `Você é o Agente Supervisor do Nexus360 (CRM/Comunicação da NeuralTec).
Analise os dados operacionais da última semana e extraia os 3 MAIORES aprendizados estratégicos.
Inclua aprendizados positivos (padrões de sucesso) e negativos (o que evitar — "conhecimento imunológico").
Seja concreto e acionável: cada aprendizado deve dizer QUANDO usar e o que fazer.

DADOS DA SEMANA:
- Orçamentos movimentados (${orcamentos.length}): ${JSON.stringify(resumoOrcamentos).slice(0, 3000)}
- Vendas (${vendas.length}): ${JSON.stringify(resumoVendas).slice(0, 1500)}
- Erros de automação (${logsErro.length}): ${JSON.stringify(resumoErros).slice(0, 1500)}
- Conhecimentos já registrados esta semana (não repita): ${JSON.stringify(conhecimentosRecentes.map(c => c.titulo)).slice(0, 1000)}

Responda em português brasileiro.`;

    const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          aprendizados: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                titulo: { type: 'string' },
                conteudo: { type: 'string', description: 'Aprendizado detalhado e acionável' },
                tipo_registro: { type: 'string', enum: ['melhor_pratica', 'objecao_comum', 'estrategia_fechamento', 'padrao_comunicacao', 'aprendizado_ia', 'resultado_acao'] },
                categoria: { type: 'string', enum: ['estrategia', 'inteligencia', 'procedimento', 'script_vendas', 'objecoes'] },
                quando_usar: { type: 'string' },
                quando_nao_usar: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } }
              },
              required: ['titulo', 'conteudo', 'tipo_registro', 'categoria']
            }
          }
        },
        required: ['aprendizados']
      }
    });

    const aprendizados = (resultado.aprendizados || []).slice(0, 3);
    const agora = new Date().toISOString();

    const criados = await db.BaseConhecimento.bulkCreate(aprendizados.map(a => ({
      titulo: a.titulo,
      tipo_registro: a.tipo_registro,
      categoria: a.categoria,
      conteudo: a.conteudo,
      tags: [...(a.tags || []), 'supervisor_semanal'],
      entidade_origem: 'Sistema',
      relevancia_score: 80,
      aprovado: false,
      ativo: true,
      contexto_aplicacao: {
        quando_usar: a.quando_usar || '',
        quando_nao_usar: a.quando_nao_usar || ''
      },
      origem_ia: {
        motor_gerador: 'NexusEngine',
        timestamp_geracao: agora,
        modelo_llm: 'InvokeLLM'
      },
      criado_por: 'Agente Supervisor'
    })));

    return Response.json({
      success: true,
      total_criados: criados.length,
      titulos: aprendizados.map(a => a.titulo),
      dados_analisados: { orcamentos: orcamentos.length, vendas: vendas.length, erros: logsErro.length }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});