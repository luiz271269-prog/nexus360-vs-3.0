import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Classifica um EmailSincronizado por URGÊNCIA e SETOR usando IA,
// a partir dos dados que o organizador já leu (remetente, assunto, corpo_preview).
// Idempotente: se já tiver classificado_em, não reclassifica (a menos que force=true).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    const body = await req.json().catch(() => ({}));
    const event = body?.event || {};
    const force = body?.force === true;
    const emailId = body?.email_id || event?.entity_id || body?.data?.id || null;

    if (!emailId) {
      return Response.json({ error: 'email_id ausente' }, { status: 400 });
    }

    const email = await db.EmailSincronizado.get(emailId).catch(() => null);
    if (!email) {
      return Response.json({ error: 'E-mail não encontrado' }, { status: 404 });
    }

    // Idempotência: não reclassifica salvo se forçado
    if (email.classificado_em && !force) {
      return Response.json({ skipped: true, reason: 'ja_classificado' });
    }

    const remetente = `${email.remetente_nome || ''} <${email.remetente_email || ''}>`.trim();
    const assunto = email.assunto || '(sem assunto)';
    const corpo = (email.corpo_preview || '').slice(0, 1500);

    const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Você é um classificador de e-mails corporativos de uma empresa de tecnologia/varejo (Liesch).
Classifique o e-mail abaixo por SETOR e URGÊNCIA.

SETORES possíveis:
- vendas: pedidos, orçamentos, cotações, propostas comerciais, dúvidas de produto
- financeiro: boletos, notas fiscais, cobranças, pagamentos, faturas, impostos
- assistencia: suporte técnico, defeitos, garantia, problemas com produtos
- fornecedor: ofertas de fornecedores, distribuidores, compras de insumos
- geral: newsletters, marketing, spam, avisos automáticos, qualquer coisa que não se encaixe

URGÊNCIA:
- alta: prazo curto explícito, problema crítico, cliente irritado, palavras como "urgente", "imediato", "parado", "sem funcionar"
- media: solicitações comuns que precisam de resposta mas sem prazo crítico
- baixa: newsletters, marketing, automáticos, informativos

E-MAIL:
Remetente: ${remetente}
Assunto: ${assunto}
Corpo: ${corpo}`,
      response_json_schema: {
        type: 'object',
        properties: {
          setor: { type: 'string', enum: ['vendas', 'financeiro', 'assistencia', 'fornecedor', 'geral'] },
          urgencia: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          motivo: { type: 'string', description: 'Justificativa curta (1 frase)' }
        },
        required: ['setor', 'urgencia', 'motivo']
      }
    });

    const setor = resultado?.setor || 'geral';
    const urgencia = resultado?.urgencia || 'baixa';
    const motivo = resultado?.motivo || '';

    await db.EmailSincronizado.update(emailId, {
      setor_classificado: setor,
      urgencia,
      motivo_classificacao: motivo,
      classificado_em: new Date().toISOString()
    });

    return Response.json({ ok: true, email_id: emailId, setor, urgencia, motivo });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});