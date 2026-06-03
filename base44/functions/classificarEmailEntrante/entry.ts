import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Classifica automaticamente um EmailSincronizado por URGÊNCIA e SETOR usando IA,
// a partir dos dados que o organizador já leu (remetente, assunto, prévia do corpo).
// Disparada por automação entity (create) sobre EmailSincronizado.
// Idempotente: se já tiver classificado_em, não reprocessa.

function decodeMimeWord(str) {
  if (!str) return '';
  // Decodifica =?UTF-8?B?...?= e =?UTF-8?Q?...?= de forma best-effort
  try {
    return str.replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, b64) =>
      decodeURIComponent(escape(atob(b64)))
    ).replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_, q) =>
      q.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    );
  } catch {
    return str;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    const body = await req.json().catch(() => ({}));
    const event = body?.event || {};
    let data = body?.data || null;
    const entityId = event?.entity_id || data?.id || null;

    if (!data && entityId) {
      data = await db.EmailSincronizado.get(entityId).catch(() => null);
    }
    if (!data || !entityId) {
      return Response.json({ skipped: true, reason: 'sem_dados' });
    }

    // Idempotência: já classificado
    if (data.classificado_em) {
      return Response.json({ skipped: true, reason: 'ja_classificado' });
    }

    const remetente = (data.remetente_email || '').toLowerCase();
    const assunto = decodeMimeWord(data.assunto || '');
    const corpo = (data.corpo_preview || '').slice(0, 1200);

    const prompt = `Você é um classificador de e-mails corporativos de uma empresa de tecnologia/varejo (Liesch/NeuralTec).
Classifique o e-mail abaixo em URGÊNCIA e SETOR.

REGRAS DE URGÊNCIA:
- "alta": cliente reclamando, problema/erro/falha em produto ou serviço, prazo vencendo, pagamento atrasado, palavra "urgente", solicitação de orçamento com pressa, assunto crítico.
- "media": dúvidas comerciais, pedidos de orçamento sem pressa, follow-up, agendamentos, cobranças padrão.
- "baixa": newsletters, marketing, propaganda, notificações automáticas, confirmações genéricas, "no-reply".

REGRAS DE SETOR:
- "vendas": orçamentos, propostas, pedidos de compra de clientes, interesse em produtos.
- "financeiro": boletos, pagamentos, notas fiscais, cobranças, faturas.
- "assistencia": suporte técnico, defeitos, garantia, problemas em produtos/serviços.
- "fornecedor": e-mails vindos de fornecedores, distribuidores, cotações de compra recebidas.
- "geral": tudo que não se encaixa, RH, institucional, newsletters/marketing.

DADOS DO E-MAIL:
Remetente: ${remetente}
Nome remetente: ${data.remetente_nome || ''}
Assunto: ${assunto}
Prévia do corpo: ${corpo}`;

    const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          urgencia: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          setor: { type: 'string', enum: ['vendas', 'financeiro', 'assistencia', 'fornecedor', 'geral'] },
          motivo: { type: 'string' }
        },
        required: ['urgencia', 'setor', 'motivo']
      }
    });

    await db.EmailSincronizado.update(entityId, {
      urgencia: resultado.urgencia,
      setor_classificado: resultado.setor,
      motivo_classificacao: resultado.motivo,
      classificado_em: new Date().toISOString()
    });

    return Response.json({
      ok: true,
      email_id: entityId,
      urgencia: resultado.urgencia,
      setor: resultado.setor,
      motivo: resultado.motivo
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});