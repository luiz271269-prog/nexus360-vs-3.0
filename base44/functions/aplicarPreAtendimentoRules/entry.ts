// ============================================================================
// aplicarPreAtendimentoRules.js — v1.0
// ============================================================================
// Avalia as PreAtendimentoRule ativas contra o contexto de uma thread/contato/
// mensagem recebida e retorna a PRIMEIRA regra que casa (ordenada por prioridade
// ASC — menor número = avaliada primeiro).
//
// Esta função é PASSIVA: apenas classifica e retorna a ação adequada. Quem
// aplica os efeitos é o caller (primeiroAtendimentoUnificado, Camada 2.5).
//
// INPUT:
//   { thread_id, contact_id, setor_detectado, intencao, confidence, message_content }
//
// OUTPUT:
//   {
//     success: true,
//     matched: true|false,
//     rule: { id, nome, categoria, tipo_acao, prioridade, acao_configuracao } | null,
//     reason: 'bloquear' | 'rotear_direto' | 'enviar_mensagem' | 'seguir_fluxo_padrao'
//   }
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HORA_INICIO = 8;
const HORA_FIM = 18;

function ehForaHorario() {
  const agora = new Date();
  const brt = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dia = brt.getDay(); // 0=Dom, 6=Sab
  const hora = brt.getHours();
  if (dia === 0 || dia === 6) return true;
  return hora < HORA_INICIO || hora >= HORA_FIM;
}

function casaGatilhoTexto(gatilhos, texto) {
  if (!Array.isArray(gatilhos) || gatilhos.length === 0) return null; // sem gatilhos = neutro
  const t = (texto || '').toLowerCase();
  return gatilhos.some(g => t.includes(String(g).toLowerCase()));
}

function regraCasa(regra, ctx, contact) {
  const cond = regra.condicoes || {};
  const setor = ctx.setor_detectado;
  const confidencePct = (ctx.confidence || 0) * 100;

  // bloqueio
  if (cond.verifica_bloqueio && contact?.bloqueado) return true;
  if (cond.verifica_bloqueio && !contact?.bloqueado) return false;

  // fidelizado
  if (cond.verifica_fidelizacao) {
    const setoresFid = ['vendas', 'assistencia', 'financeiro', 'fornecedor'];
    const temFidelizado = setoresFid.some(s => contact?.[`atendente_fidelizado_${s}`]);
    if (!temFidelizado) return false;
  }

  // horário
  if (cond.verifica_horario && !ehForaHorario()) return false;

  // setores aplicáveis
  if (Array.isArray(cond.setores_aplicaveis) && cond.setores_aplicaveis.length > 0) {
    if (!cond.setores_aplicaveis.includes(setor)) return false;
  }

  // confiança IA mínima
  if (cond.confianca_minima_ia != null && confidencePct < cond.confianca_minima_ia) return false;

  // gatilhos de texto (se definido, exige match)
  const gatilhoMatch = casaGatilhoTexto(cond.gatilhos_texto, ctx.message_content);
  if (gatilhoMatch === false) return false; // tem gatilhos mas nenhum casou

  return true;
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    const ctx = await req.json();

    if (!ctx.contact_id) {
      return Response.json({ success: false, error: 'contact_id obrigatório' }, { status: 400, headers });
    }

    const [regras, contact] = await Promise.all([
      base44.asServiceRole.entities.PreAtendimentoRule.filter({ ativa: true }, 'prioridade', 50),
      base44.asServiceRole.entities.Contact.get(ctx.contact_id).catch(() => null)
    ]);

    if (!regras || regras.length === 0) {
      return Response.json({ success: true, matched: false, rule: null, reason: 'seguir_fluxo_padrao' }, { headers });
    }

    // primeira regra que casa (já vem ordenada por prioridade ASC)
    for (const r of regras) {
      if (regraCasa(r, ctx, contact)) {
        return Response.json({
          success: true,
          matched: true,
          rule: {
            id: r.id,
            nome: r.nome,
            categoria: r.categoria,
            tipo_acao: r.tipo_acao,
            prioridade: r.prioridade,
            acao_configuracao: r.acao_configuracao || {}
          },
          reason: r.tipo_acao
        }, { headers });
      }
    }

    return Response.json({ success: true, matched: false, rule: null, reason: 'seguir_fluxo_padrao' }, { headers });

  } catch (error) {
    console.error('[aplicarPreAtendimentoRules] erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});