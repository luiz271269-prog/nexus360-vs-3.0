// ============================================================================
// DETECTOR DE SOLICITAÇÃO DE DOCUMENTOS FISCAIS v1.0.0
// ============================================================================
// Analisa uma mensagem de cliente e identifica se é uma solicitação de
// documento fiscal (NF-e, NFS-e, boleto, recibo, etc.) via LLM + keywords.
// Se detectado, busca a nota no banco e retorna os dados para envio.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Palavras-chave de alto valor para detecção sem LLM (fast-track)
const KEYWORDS_DOC_FISCAL = [
  'nota fiscal', 'nota fis', 'nf ', 'nfe', 'nf-e', 'nfs-e', 'nfse',
  'danfe', 'xml da nota', 'pdf da nota', 'segunda via', '2ª via',
  'boleto', 'recibo', 'comprovante fiscal', 'documento fiscal',
  'fatura', 'cupom fiscal', 'emitir nota', 'me manda a nota',
  'enviar nota', 'preciso da nota', 'onde está a nota', 'nota de serviço',
  'nota de produto', 'chave de acesso', 'chave nfe'
];

function detectarPorKeyword(mensagem) {
  const txt = mensagem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return KEYWORDS_DOC_FISCAL.some(kw => txt.includes(kw.toLowerCase()));
}

async function analisarComIA(base44, mensagem) {
  const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Analise a mensagem de um cliente e determine se ele está solicitando um documento fiscal (nota fiscal, boleto, recibo, DANFE, XML, fatura, comprovante fiscal, etc.).

MENSAGEM: "${mensagem}"

Responda com JSON:
- eh_solicitacao_fiscal: boolean — true se é pedido de documento fiscal
- tipo_documento: "nfe" | "nfse" | "boleto" | "recibo" | "generico" | null
- numero_referencia: string ou null — número de NF, pedido, orçamento mencionado
- urgencia: "baixa" | "media" | "alta"
- confianca: número de 0 a 100`,
    response_json_schema: {
      type: "object",
      properties: {
        eh_solicitacao_fiscal: { type: "boolean" },
        tipo_documento: { type: ["string", "null"] },
        numero_referencia: { type: ["string", "null"] },
        urgencia: { type: "string" },
        confianca: { type: "number" }
      },
      required: ["eh_solicitacao_fiscal", "confianca"]
    }
  });
  return llm;
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    const { mensagem, contact_id, thread_id } = await req.json();

    if (!mensagem || !contact_id) {
      return Response.json({ success: false, error: 'mensagem e contact_id são obrigatórios' }, { status: 400, headers });
    }

    console.log('[DETECT-DOC-FISCAL] 🔍 Analisando mensagem:', mensagem.substring(0, 100));

    // ── 1. Fast-track por keyword ─────────────────────────────────────────
    let ehSolicitacaoFiscal = detectarPorKeyword(mensagem);
    let tipoDocumento = 'generico';
    let numeroReferencia = null;
    let confianca = ehSolicitacaoFiscal ? 85 : 0;

    // ── 2. Confirmação/refinamento via IA se keyword fraca ou ausente ─────
    if (!ehSolicitacaoFiscal || confianca < 75) {
      console.log('[DETECT-DOC-FISCAL] 🤖 Usando IA para análise fina...');
      const iaResult = await analisarComIA(base44, mensagem);
      if (iaResult?.eh_solicitacao_fiscal) {
        ehSolicitacaoFiscal = true;
        tipoDocumento = iaResult.tipo_documento || 'generico';
        numeroReferencia = iaResult.numero_referencia;
        confianca = iaResult.confianca || 70;
      } else if (!ehSolicitacaoFiscal) {
        // IA confirmou: não é solicitação fiscal
        return Response.json({
          success: true,
          eh_solicitacao_fiscal: false,
          confianca: iaResult?.confianca || 10,
          mensagem: 'Não identificado como solicitação de documento fiscal'
        }, { headers });
      }
    }

    console.log(`[DETECT-DOC-FISCAL] ✅ Solicitação fiscal detectada! Tipo: ${tipoDocumento} | Confiança: ${confianca}%`);

    // ── 3. Buscar notas fiscais disponíveis para este contato ─────────────
    const notasFiscais = await base44.asServiceRole.entities.NotaFiscal.filter(
      { contact_id, status: 'emitida' },
      '-data_emissao',
      10
    );

    // Filtrar por número de referência mencionado (se houver)
    let notasEncontradas = notasFiscais;
    if (numeroReferencia) {
      const refNorm = String(numeroReferencia).replace(/\D/g, '');
      const filtradas = notasFiscais.filter(nf =>
        nf.numero_nf?.includes(refNorm) ||
        nf.chave_acesso?.includes(refNorm) ||
        nf.external_id?.includes(refNorm)
      );
      if (filtradas.length > 0) notasEncontradas = filtradas;
    }

    // ── 4. Registrar log de detecção ─────────────────────────────────────
    try {
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'outro',
        contato_id: contact_id,
        thread_id: thread_id || null,
        resultado: 'sucesso',
        timestamp: new Date().toISOString(),
        detalhes: {
          mensagem: mensagem.substring(0, 200),
          tipo_documento: tipoDocumento,
          numero_referencia: numeroReferencia,
          confianca,
          notas_encontradas: notasEncontradas.length
        },
        origem: 'ia',
        prioridade: 'alta'
      });
    } catch (logErr) {
      console.warn('[DETECT-DOC-FISCAL] ⚠️ Falha ao registrar log:', logErr.message);
    }

    return Response.json({
      success: true,
      eh_solicitacao_fiscal: true,
      tipo_documento: tipoDocumento,
      numero_referencia: numeroReferencia,
      confianca,
      notas_encontradas: notasEncontradas.length,
      notas: notasEncontradas.map(nf => ({
        id: nf.id,
        numero_nf: nf.numero_nf,
        tipo: nf.tipo,
        data_emissao: nf.data_emissao,
        valor_total: nf.valor_total,
        descricao_servico: nf.descricao_servico,
        pdf_url: nf.pdf_url,
        xml_url: nf.xml_url,
        enviada_whatsapp: nf.enviada_whatsapp
      })),
      contact_id,
      thread_id
    }, { headers });

  } catch (error) {
    console.error('[DETECT-DOC-FISCAL] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});