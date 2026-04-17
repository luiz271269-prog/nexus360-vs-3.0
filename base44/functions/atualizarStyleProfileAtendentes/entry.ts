// ============================================================================
// atualizarStyleProfileAtendentes.js — v1.0
// ============================================================================
// Analisa o corpus real de mensagens enviadas por cada atendente e gera/atualiza
// um AtendenteStyleProfile via LLM. Usado depois pelo AIResponseAssistant para
// gerar sugestões de resposta na VOZ do atendente dono da thread.
//
// Payload:
//   { user_ids?: string[], dry_run?: boolean, sample_size?: number }
//
// Se user_ids omitido: processa todos os is_whatsapp_attendant=true
// dry_run=true (padrão): retorna o que FARIA sem gravar
// sample_size: quantas mensagens analisar por atendente (padrão 50, max 150)
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_SAMPLE_SIZE = 50;
const MAX_SAMPLE_SIZE = 150;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: apenas admin pode atualizar style profiles' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { user_ids = null, dry_run = true, sample_size = DEFAULT_SAMPLE_SIZE } = payload;
    const sampleSize = Math.min(Math.max(parseInt(sample_size) || DEFAULT_SAMPLE_SIZE, 10), MAX_SAMPLE_SIZE);

    // 1) Listar atendentes a processar
    let atendentes;
    if (Array.isArray(user_ids) && user_ids.length > 0) {
      atendentes = [];
      for (const id of user_ids) {
        try {
          const u = await base44.asServiceRole.entities.User.get(id);
          if (u) atendentes.push(u);
        } catch (_) { /* skip inválidos */ }
      }
    } else {
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);
      atendentes = allUsers.filter(u => u.is_whatsapp_attendant === true && (u.full_name || u.display_name));
    }

    console.log(`[StyleProfile] Processando ${atendentes.length} atendente(s) | sample=${sampleSize} | dry_run=${dry_run}`);

    const resultados = [];

    for (const atendente of atendentes) {
      const atendenteResult = {
        user_id: atendente.id,
        display_name: atendente.display_name || atendente.full_name || atendente.email,
        sector: atendente.attendant_sector || 'geral',
        status: 'pending',
        profile_gerado: null,
        erro: null,
        corpus_size: 0
      };

      try {
        // 2) Buscar corpus de mensagens do atendente (só suas, só WhatsApp)
        const mensagens = await base44.asServiceRole.entities.Message.filter({
          sender_id: atendente.id,
          sender_type: 'user',
          channel: 'whatsapp',
          visibility: 'public_to_customer'
        }, '-sent_at', sampleSize);

        const corpusValido = mensagens
          .filter(m => (m.content || '').trim().length > 3)
          .map(m => (m.content || '').replace(/\n\n_~.*?_$/s, '').trim()) // remove assinatura
          .filter(t => t.length > 0);

        atendenteResult.corpus_size = corpusValido.length;

        if (corpusValido.length < 10) {
          atendenteResult.status = 'insufficient_corpus';
          atendenteResult.erro = `Apenas ${corpusValido.length} mensagens — mínimo 10`;
          resultados.push(atendenteResult);
          continue;
        }

        // 3) Detectar assinatura mais usada
        const assinaturas = {};
        for (const m of mensagens) {
          const match = (m.content || '').match(/_~\s*([^_]+?)_\s*$/);
          if (match) {
            const key = match[0].trim();
            assinaturas[key] = (assinaturas[key] || 0) + 1;
          }
        }
        const assinaturaMaisUsada = Object.entries(assinaturas).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        // 4) Enviar corpus para LLM extrair features
        const corpusAmostra = corpusValido.slice(0, 40).map((t, i) => `${i + 1}. ${t}`).join('\n');

        const llmResp = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: 'gemini_3_flash',
          prompt: `Analise o corpus abaixo de mensagens reais enviadas pelo atendente "${atendenteResult.display_name}" do setor "${atendenteResult.sector}" para clientes via WhatsApp.

Extraia o ESTILO DE COMUNICAÇÃO dele/dela em formato JSON estruturado. Baseie-se APENAS no que os dados mostram, não no que seria "ideal".

CORPUS (${corpusValido.length} mensagens, mostrando até 40 primeiras):
${corpusAmostra}

Retorne JSON com estas chaves:
- formalidade: "baixa" | "media" | "alta"
- uso_emoji: "nunca" | "raro" | "moderado" | "frequente"
- uso_risadas: "nunca" | "raro" | "moderado" | "frequente" (contando kkk, haha, rsrs)
- comprimento_medio_chars: número (média de chars por mensagem)
- pontuacao_formal: true | false (maioria tem pontuação correta?)
- chama_pelo_nome: true | false (tende a usar primeiro nome do cliente?)
- girias_regionais: array de strings (ex: ["bah", "tchê"]) — só gírias realmente frequentes
- tom_geral: "consultivo" | "rapport" | "tecnico" | "direto" | "misto"
- frases_abertura: array de 3-5 exemplos REAIS do corpus de abertura de conversas
- frases_encerramento: array de 3-5 exemplos REAIS de encerramento
- frases_agradecimento: array de até 3 exemplos REAIS de como responde agradecimentos
- frases_saudacao_por_hora: { manha: string, tarde: string, noite: string } — exemplos prováveis no estilo dele
- call_to_action_fechamento: array de até 3 frases REAIS de fechamento de venda
- confidence_score: número 0-1 (quão confiante você está no perfil)`,
          response_json_schema: {
            type: 'object',
            properties: {
              formalidade: { type: 'string' },
              uso_emoji: { type: 'string' },
              uso_risadas: { type: 'string' },
              comprimento_medio_chars: { type: 'number' },
              pontuacao_formal: { type: 'boolean' },
              chama_pelo_nome: { type: 'boolean' },
              girias_regionais: { type: 'array', items: { type: 'string' } },
              tom_geral: { type: 'string' },
              frases_abertura: { type: 'array', items: { type: 'string' } },
              frases_encerramento: { type: 'array', items: { type: 'string' } },
              frases_agradecimento: { type: 'array', items: { type: 'string' } },
              frases_saudacao_por_hora: {
                type: 'object',
                properties: {
                  manha: { type: 'string' },
                  tarde: { type: 'string' },
                  noite: { type: 'string' }
                }
              },
              call_to_action_fechamento: { type: 'array', items: { type: 'string' } },
              confidence_score: { type: 'number' }
            }
          }
        });

        // 5) Montar profile
        const ordenadas = [...mensagens].sort((a, b) => new Date(a.sent_at || a.created_date) - new Date(b.sent_at || b.created_date));
        const profileData = {
          user_id: atendente.id,
          display_name: atendenteResult.display_name,
          sector: atendenteResult.sector,
          assinatura: assinaturaMaisUsada,
          style_features: {
            formalidade: llmResp.formalidade || 'media',
            uso_emoji: llmResp.uso_emoji || 'raro',
            uso_risadas: llmResp.uso_risadas || 'raro',
            comprimento_medio_chars: llmResp.comprimento_medio_chars || 40,
            pontuacao_formal: llmResp.pontuacao_formal ?? true,
            chama_pelo_nome: llmResp.chama_pelo_nome ?? false,
            girias_regionais: llmResp.girias_regionais || [],
            tom_geral: llmResp.tom_geral || 'misto'
          },
          frases_abertura: llmResp.frases_abertura || [],
          frases_encerramento: llmResp.frases_encerramento || [],
          frases_agradecimento: llmResp.frases_agradecimento || [],
          frases_saudacao_por_hora: llmResp.frases_saudacao_por_hora || { manha: '', tarde: '', noite: '' },
          call_to_action_fechamento: llmResp.call_to_action_fechamento || [],
          corpus_sample_size: corpusValido.length,
          periodo_analise_inicio: ordenadas[0]?.sent_at || ordenadas[0]?.created_date || null,
          periodo_analise_fim: ordenadas[ordenadas.length - 1]?.sent_at || ordenadas[ordenadas.length - 1]?.created_date || null,
          inferred_by: 'llm_analysis',
          modelo_llm_usado: 'gemini_3_flash',
          confidence_score: llmResp.confidence_score || 0.7,
          ativo: true
        };

        atendenteResult.profile_gerado = profileData;

        // 6) Persistir (se não for dry-run)
        if (!dry_run) {
          const existentes = await base44.asServiceRole.entities.AtendenteStyleProfile.filter({ user_id: atendente.id }, '-created_date', 1);
          if (existentes.length > 0) {
            await base44.asServiceRole.entities.AtendenteStyleProfile.update(existentes[0].id, profileData);
            atendenteResult.status = 'updated';
          } else {
            const novo = await base44.asServiceRole.entities.AtendenteStyleProfile.create(profileData);
            atendenteResult.status = 'created';
            atendenteResult.profile_id = novo.id;
          }
        } else {
          atendenteResult.status = 'dry_run_ok';
        }

      } catch (e) {
        atendenteResult.status = 'error';
        atendenteResult.erro = e.message;
        console.error(`[StyleProfile] Erro para ${atendenteResult.display_name}:`, e.message);
      }

      resultados.push(atendenteResult);
    }

    const summary = {
      total_processados: resultados.length,
      created: resultados.filter(r => r.status === 'created').length,
      updated: resultados.filter(r => r.status === 'updated').length,
      dry_run_ok: resultados.filter(r => r.status === 'dry_run_ok').length,
      insufficient_corpus: resultados.filter(r => r.status === 'insufficient_corpus').length,
      errors: resultados.filter(r => r.status === 'error').length,
      dry_run
    };

    return Response.json({ success: true, summary, resultados });

  } catch (error) {
    console.error('[StyleProfile] Erro fatal:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});