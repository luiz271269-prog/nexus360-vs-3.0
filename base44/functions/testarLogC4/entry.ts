// testarLogC4 — função descartável de validação cirúrgica do helper logC4
// Invoca o helper com os 6 cenários esperados, verifica no banco e limpa.
// USAR APENAS PARA VALIDAÇÃO. Pode ser deletada após o teste.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Réplica EXATA do logC4 que está em skillPreAtendimentos linha 539
const logC4 = (b, t, c, e, d) => b.asServiceRole.entities.AutomationLog.create({
  thread_id: t,
  contato_id: c,
  acao: d.acao || 'outro',
  resultado: d.resultado || (d.erro ? 'erro' : 'ignorado'),
  origem: 'sistema',
  timestamp: new Date().toISOString(),
  detalhes: {
    mensagem: d.mensagem || e,
    dados_contexto: { ...d, camada: d.camada || '4-micro' }
  },
  metadata: { event_type: e, ...d, camada: d.camada || '4-micro' }
}).catch((err) => ({ __error: err.message }));

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403, headers });
    }

    const TEST_TAG = `TESTE_LOGC4_${Date.now()}`;
    const TEST_THREAD_ID = `test_thread_${Date.now()}`;
    const TEST_CONTACT_ID = `test_contact_${Date.now()}`;

    // Os 6 cenários replicados das linhas 1004, 1015, 1026, 1032, 1063, 1073 do skillPreAtendimentos
    const cenarios = [
      {
        nome: '1_midia_pura',
        event_type: 'micro_intent_midia_pura',
        details: { mensagem: 'Mídia image sem texto — silêncio', media_type: 'image', action: 'silent', __test: TEST_TAG }
      },
      {
        nome: '2_spam_detectado',
        event_type: 'micro_intent_spam_detectado',
        details: { mensagem: 'Spam detectado: "Vi seu cadastro..."', texto: 'Vi seu cadastro, teria 1 min?', action: 'silent', __test: TEST_TAG }
      },
      {
        nome: '3_confirmacao_sem_atendente',
        event_type: 'micro_intent_confirmacao_sem_atendente',
        details: { mensagem: 'Confirmação curta sem atendente: "sim" — segue fluxo antigo', texto: 'sim', action: 'fallthrough_fluxo_antigo', __test: TEST_TAG }
      },
      {
        nome: '4_saudacao_sem_atendente',
        event_type: 'micro_intent_saudacao_sem_atendente',
        details: { tipo: 'saudacao_pura', action: 'fallthrough_sem_atendente', texto: 'Bom dia', __test: TEST_TAG }
      },
      {
        nome: '5_cooldown_skip',
        event_type: 'micro_intent_cooldown_skip',
        details: { mensagem: 'Cooldown 2min ativo — saudacao_pura ignorado', tipo: 'saudacao_pura', action: 'cooldown_skip_2min', ultima_resp_id: 'fake_msg_id', __test: TEST_TAG }
      },
      {
        nome: '6_envio_falhou',
        event_type: 'micro_intent_envio_falhou',
        details: { tipo: 'saudacao_pura', integration_id: 'fake_integ_id', action: 'send_failed', erro: true, __test: TEST_TAG }
      }
    ];

    // FASE 1: Disparar os 6 logs
    const startInvoke = Date.now();
    const invocacoes = await Promise.all(
      cenarios.map(c => logC4(base44, TEST_THREAD_ID, TEST_CONTACT_ID, c.event_type, c.details))
    );
    const durationInvoke = Date.now() - startInvoke;

    const errosInvocacao = invocacoes.filter(r => r?.__error).map((r, i) => ({ cenario: cenarios[i].nome, error: r.__error }));

    // FASE 2: Aguardar 1.5s para garantir persistência e indexação
    await new Promise(resolve => setTimeout(resolve, 1500));

    // FASE 3: Buscar logs criados pela tag de teste
    const logsCriados = await base44.asServiceRole.entities.AutomationLog.filter({
      thread_id: TEST_THREAD_ID
    }, '-timestamp', 50).catch(() => []);

    // FASE 4: Validar cada cenário
    const validacoes = cenarios.map(c => {
      const log = logsCriados.find(l => l.metadata?.event_type === c.event_type);
      if (!log) {
        return { cenario: c.nome, event_type: c.event_type, status: '❌ NAO_ENCONTRADO', detalhes: null };
      }

      // Validar campos obrigatórios do schema
      const validacoesCampo = {
        tem_acao: !!log.acao,
        acao_valor: log.acao,
        tem_resultado: !!log.resultado,
        resultado_valor: log.resultado,
        tem_timestamp: !!log.timestamp,
        tem_metadata_event_type: log.metadata?.event_type === c.event_type,
        tem_camada: log.metadata?.camada === '4-micro',
        tem_thread_id: log.thread_id === TEST_THREAD_ID,
        tem_contato_id: log.contato_id === TEST_CONTACT_ID,
        tem_mensagem_detalhes: !!log.detalhes?.mensagem
      };

      const todosOk = Object.values(validacoesCampo).every(v => v === true || typeof v === 'string');
      const expectativaResultado = c.details.erro ? 'erro' : 'ignorado';
      const resultadoCorreto = log.resultado === expectativaResultado;

      return {
        cenario: c.nome,
        event_type: c.event_type,
        log_id: log.id,
        status: todosOk && resultadoCorreto ? '✅ OK' : '⚠️ DIVERGENCIA',
        validacoes: validacoesCampo,
        resultado_esperado: expectativaResultado,
        resultado_recebido: log.resultado,
        resultado_correto: resultadoCorreto
      };
    });

    // FASE 5: Limpar logs de teste
    const idsParaDeletar = logsCriados.map(l => l.id);
    let deletados = 0;
    let errosDelete = [];
    for (const id of idsParaDeletar) {
      try {
        await base44.asServiceRole.entities.AutomationLog.delete(id);
        deletados++;
      } catch (e) {
        errosDelete.push({ id, error: e.message });
      }
    }

    // FASE 6: Relatório final
    const todasOk = validacoes.every(v => v.status === '✅ OK');
    const totalEsperado = cenarios.length;
    const totalEncontrado = logsCriados.length;

    return Response.json({
      success: todasOk,
      veredicto: todasOk
        ? '✅ logC4 VALIDADO — todos os 6 cenários gravaram corretamente com os defaults do Patch 1'
        : '⚠️ DIVERGÊNCIA DETECTADA — verificar validacoes abaixo',
      resumo: {
        cenarios_disparados: totalEsperado,
        logs_encontrados_no_banco: totalEncontrado,
        validacoes_ok: validacoes.filter(v => v.status === '✅ OK').length,
        validacoes_divergencia: validacoes.filter(v => v.status === '⚠️ DIVERGENCIA').length,
        validacoes_nao_encontradas: validacoes.filter(v => v.status === '❌ NAO_ENCONTRADO').length,
        logs_deletados: deletados,
        erros_invocacao: errosInvocacao.length,
        erros_delete: errosDelete.length,
        tempo_invoke_ms: durationInvoke
      },
      validacoes,
      erros_invocacao: errosInvocacao.length > 0 ? errosInvocacao : undefined,
      erros_delete: errosDelete.length > 0 ? errosDelete : undefined,
      test_metadata: {
        thread_id: TEST_THREAD_ID,
        contact_id: TEST_CONTACT_ID,
        test_tag: TEST_TAG
      }
    }, { headers });

  } catch (error) {
    return Response.json({ success: false, error: error.message, stack: error.stack }, { status: 500, headers });
  }
});