// ============================================================================
// DISPARADOR DE NOTA FISCAL VIA WHATSAPP v1.0.0
// ============================================================================
// Orquestra o envio do PDF da NF para o cliente via WhatsApp.
// Pode ser chamado:
//   1. Automaticamente pelo processInbound quando detectarSolicitacaoDocFiscal retorna positivo
//   2. Manualmente pelo atendente via UI
// Integra com: enviarWhatsApp (Z-API / W-API)
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Mensagem de acompanhamento ao enviar o PDF
function gerarMensagemAcompanhamento(nf, contato) {
  const nomeCliente = contato?.nome?.split(' ')[0] || 'Cliente';
  const valorFmt = nf.valor_total
    ? `R$ ${Number(nf.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '';

  const tipoLabel = {
    nfe: 'Nota Fiscal Eletrônica (NF-e)',
    nfse: 'Nota Fiscal de Serviço (NFS-e)',
    boleto: 'Boleto',
    recibo: 'Recibo',
    nfce: 'Nota Fiscal do Consumidor (NFC-e)',
    generico: 'Documento Fiscal'
  }[nf.tipo] || 'Documento Fiscal';

  let msg = `📄 Olá, ${nomeCliente}! Segue seu ${tipoLabel}.\n\n`;
  msg += `🔢 Número: *${nf.numero_nf}*\n`;
  if (nf.data_emissao) msg += `📅 Emissão: ${new Date(nf.data_emissao).toLocaleDateString('pt-BR')}\n`;
  if (valorFmt) msg += `💰 Valor: *${valorFmt}*\n`;
  if (nf.descricao_servico) msg += `📋 Ref.: ${nf.descricao_servico}\n`;
  msg += `\nQualquer dúvida, estamos à disposição! 😊`;
  return msg;
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    const {
      nota_fiscal_id,   // ID da NotaFiscal a enviar
      contact_id,       // ID do Contact destinatário
      thread_id,        // ID da MessageThread (para registrar mensagem)
      integration_id,   // ID da WhatsAppIntegration (opcional — busca automaticamente se omitido)
      enviar_texto_acompanhamento = true,  // Enviar mensagem de texto antes do PDF
      marcar_como_enviada = true           // Atualizar NotaFiscal.enviada_whatsapp = true
    } = await req.json();

    if (!nota_fiscal_id || !contact_id) {
      return Response.json(
        { success: false, error: 'nota_fiscal_id e contact_id são obrigatórios' },
        { status: 400, headers }
      );
    }

    console.log('[DISPARAR-NF-WA] 🚀 Iniciando envio de NF:', nota_fiscal_id);

    // ── 1. Carregar NF e Contato em paralelo ─────────────────────────────
    const [nf, contato] = await Promise.all([
      base44.asServiceRole.entities.NotaFiscal.get(nota_fiscal_id),
      base44.asServiceRole.entities.Contact.get(contact_id)
    ]);

    if (!nf) {
      return Response.json({ success: false, error: 'Nota fiscal não encontrada' }, { status: 404, headers });
    }
    if (!contato) {
      return Response.json({ success: false, error: 'Contato não encontrado' }, { status: 404, headers });
    }
    if (!nf.pdf_url) {
      return Response.json({ success: false, error: 'Esta nota fiscal não possui PDF cadastrado' }, { status: 422, headers });
    }

    // ── 2. Determinar número de WhatsApp e integração ─────────────────────
    const telefone = contato.telefone || contato.telefone_canonico;
    if (!telefone) {
      return Response.json({ success: false, error: 'Contato sem telefone cadastrado' }, { status: 422, headers });
    }

    let integrationIdFinal = integration_id;
    if (!integrationIdFinal) {
      // Buscar a integração ativa no setor financeiro ou primeira disponível
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { status: 'conectado' },
        '-created_date',
        5
      );
      const integFinanceiro = integracoes.find(i =>
        i.setores_atendidos?.includes('financeiro') || i.setor_principal === 'financeiro'
      );
      integrationIdFinal = (integFinanceiro || integracoes[0])?.id;
    }

    if (!integrationIdFinal) {
      return Response.json({ success: false, error: 'Nenhuma integração WhatsApp disponível' }, { status: 503, headers });
    }

    const resultados = [];

    // ── 3. Enviar texto de acompanhamento (opcional) ──────────────────────
    if (enviar_texto_acompanhamento) {
      const textoAcomp = gerarMensagemAcompanhamento(nf, contato);
      const resTexto = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
        integration_id: integrationIdFinal,
        numero_destino: telefone,
        mensagem: textoAcomp
      });
      console.log('[DISPARAR-NF-WA] 💬 Texto acompanhamento enviado:', resTexto?.data?.success);
      resultados.push({ tipo: 'texto', success: resTexto?.data?.success });
    }

    // ── 4. Enviar PDF da NF ───────────────────────────────────────────────
    const nomeArquivo = `NF-${nf.numero_nf || nf.id}.pdf`;
    const resPDF = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: integrationIdFinal,
      numero_destino: telefone,
      media_url: nf.pdf_url,
      media_type: 'document',
      media_caption: nomeArquivo
    });

    console.log('[DISPARAR-NF-WA] 📄 PDF enviado:', resPDF?.data?.success);
    resultados.push({ tipo: 'pdf', success: resPDF?.data?.success, message_id: resPDF?.data?.message_id });

    const pdFSuccess = resPDF?.data?.success === true;

    // ── 5. Atualizar NF como enviada ──────────────────────────────────────
    if (pdFSuccess && marcar_como_enviada) {
      await base44.asServiceRole.entities.NotaFiscal.update(nota_fiscal_id, {
        enviada_whatsapp: true,
        enviada_whatsapp_em: new Date().toISOString(),
        thread_id: thread_id || nf.thread_id || null
      });
      console.log('[DISPARAR-NF-WA] ✅ NF marcada como enviada');
    }

    // ── 6. Registrar mensagem interna na thread ───────────────────────────
    if (thread_id && pdFSuccess) {
      try {
        await base44.asServiceRole.entities.Message.create({
          thread_id,
          sender_id: 'sistema',
          sender_type: 'user',
          content: `📄 Nota Fiscal *${nf.numero_nf}* enviada automaticamente ao cliente via WhatsApp.`,
          channel: 'whatsapp',
          visibility: 'internal_only',
          status: 'enviada',
          sent_at: new Date().toISOString()
        });
      } catch (msgErr) {
        console.warn('[DISPARAR-NF-WA] ⚠️ Falha ao registrar msg interna:', msgErr.message);
      }
    }

    // ── 7. Registrar AutomationLog ────────────────────────────────────────
    try {
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'outro',
        contato_id: contact_id,
        thread_id: thread_id || null,
        resultado: pdFSuccess ? 'sucesso' : 'erro',
        timestamp: new Date().toISOString(),
        detalhes: {
          nota_fiscal_id,
          numero_nf: nf.numero_nf,
          tipo: nf.tipo,
          valor_total: nf.valor_total,
          integration_id: integrationIdFinal,
          resultados
        },
        origem: 'sistema',
        prioridade: 'normal'
      });
    } catch (logErr) {
      console.warn('[DISPARAR-NF-WA] ⚠️ Falha ao registrar log:', logErr.message);
    }

    return Response.json({
      success: pdFSuccess,
      message_id: resPDF?.data?.message_id,
      nota_fiscal: {
        id: nf.id,
        numero_nf: nf.numero_nf,
        tipo: nf.tipo,
        valor_total: nf.valor_total,
        enviada_whatsapp: pdFSuccess
      },
      resultados
    }, { headers });

  } catch (error) {
    console.error('[DISPARAR-NF-WA] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});