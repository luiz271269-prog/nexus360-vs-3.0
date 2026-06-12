import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// CARTÃO DE ACESSO NEURALTEC — motor único de envio
// ============================================================================
// Dois modos:
//  1. manual           → atendente anexa o cartão no chat (sem cooldown)
//  2. auto_primeira_msg → automação na primeira mensagem inbound do dia
//     (máx 1x por dia por contato, com guards de bloqueio/opt-out)
// ============================================================================

const CARTAO_TEXTO = `━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *NEURALTEC TECNOLOGIA*
_Cartão de Acesso Rápido_
━━━━━━━━━━━━━━━━━━━━━━━━

Fale direto com o setor certo, sem espera:

💬 *Vendas e Orçamentos*
wa.me/554830452076

🛒 *Compras / Fornecedor*
wa.me/554830452078

💰 *Financeiro / 2ª via de boleto*
wa.me/554830452079

🛠️ *Suporte / Assistência Técnica*
wa.me/554830452076

📦 *Catálogo de Produtos*
www.neuraltec360.com.br

⚡ *Pix (CNPJ):* 62.982.374/0001-07

📸 Instagram: instagram.com/neuraltec.tecnologia

_Salve esta mensagem para acessar quando precisar!_ ✨

➡️ *Responda com o número para atalho rápido:*
*1* — 💰 Financeiro
*2* — 📦 Catálogo
*3* — 🛠️ Suporte`;

// Seções avulsas para atalhos rápidos (barra abaixo da mensagem)
const SECOES = {
  financeiro: `💰 *NEURALTEC — FINANCEIRO*
━━━━━━━━━━━━━━━━━━━━━━━━
2ª via de boleto e pagamentos:
wa.me/554830452079

⚡ *Pix (CNPJ):* 62.982.374/0001-07

_Qualquer dúvida, é só chamar!_ ✨`,
  catalogo: `📦 *NEURALTEC — CATÁLOGO*
━━━━━━━━━━━━━━━━━━━━━━━━
Confira todos os nossos produtos:
www.neuraltec360.com.br

💬 Orçamentos: wa.me/554830452076

_Salve este link para acessar quando precisar!_ ✨`,
  vendas: `💬 *NEURALTEC — VENDAS*
━━━━━━━━━━━━━━━━━━━━━━━━
Orçamentos e vendas:
wa.me/554830452076

_Fale com nossa equipe!_ ✨`,
  compras: `🛒 *NEURALTEC — COMPRAS / FORNECEDOR*
━━━━━━━━━━━━━━━━━━━━━━━━
Canal direto com nosso setor de compras:
wa.me/554830452078

_Aguardamos seu contato!_ ✨`,
  pix: `⚡ *NEURALTEC — PIX*
━━━━━━━━━━━━━━━━━━━━━━━━
Chave Pix (CNPJ):
*62.982.374/0001-07*

_Envie o comprovante por aqui!_ ✨`,
  suporte: `🛠️ *NEURALTEC — SUPORTE*
━━━━━━━━━━━━━━━━━━━━━━━━
Atendimento e assistência técnica:
wa.me/554830452076

🕐 Seg-Sex 08h-12h e 13h30-18h

_Estamos à disposição!_ ✨`
};

function hojeStr() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // ── Detectar modo: automação (payload de entidade) ou manual ──
    const isAutomacao = !!body?.event;
    let threadId, contactId, integrationId, trigger;

    if (isAutomacao) {
      const msg = body.data;
      // Guards do gatilho: só inbound de contato via WhatsApp
      if (!msg || msg.sender_type !== 'contact' || msg.channel !== 'whatsapp') {
        return Response.json({ success: true, skipped: 'nao_inbound_whatsapp' });
      }
      threadId = msg.thread_id;
      contactId = msg.sender_id;
      // Clique em botão do cartão → responder com a seção correspondente
      const conteudoMsg = String(msg.content || '').trim().toLowerCase();
      const MAPA_BOTOES = {
        '💰 financeiro': 'financeiro', 'financeiro': 'financeiro',
        '📦 catálogo': 'catalogo', 'catálogo': 'catalogo', 'catalogo': 'catalogo',
        '🛠️ suporte': 'suporte', 'suporte': 'suporte',
        '💬 vendas': 'vendas', 'vendas': 'vendas',
        '🛒 compras / fornecedor': 'compras', 'compras': 'compras', 'fornecedor': 'compras',
        '⚡ pix': 'pix', 'pix': 'pix',
        '1': 'financeiro', '2': 'catalogo', '3': 'suporte'
      };
      var secao = MAPA_BOTOES[conteudoMsg] || null;
      trigger = secao ? 'botao_cartao' : 'auto_primeira_msg';
    } else {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      threadId = body.thread_id;
      contactId = body.contact_id;
      integrationId = body.integration_id || null;
      trigger = 'manual';
      var secao = body.secao && SECOES[body.secao] ? body.secao : null;
    }

    if (!threadId && !contactId) {
      return Response.json({ success: false, error: 'thread_id ou contact_id obrigatório' }, { status: 400 });
    }

    // ── Carregar thread + contato ──
    let thread = null;
    if (threadId) {
      thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
    }
    if (!contactId && thread?.contact_id) contactId = thread.contact_id;
    if (!contactId) return Response.json({ success: false, error: 'Contato não identificado' });

    const contact = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
    if (!contact?.telefone) {
      return Response.json({ success: false, skipped: 'sem_telefone' });
    }

    // ── Guards (modo automático) ──
    if (trigger === 'auto_primeira_msg') {
      const tipo = String(contact.tipo_contato || '').toLowerCase();
      if (['fornecedor', 'parceiro'].includes(tipo)) {
        return Response.json({ success: true, skipped: 'tipo_contato_excluido' });
      }
      if (contact.bloqueado || contact.whatsapp_optin === false) {
        return Response.json({ success: true, skipped: 'bloqueado_ou_optout' });
      }
      const tags = (contact.tags || []).map(t => String(t).toLowerCase());
      if (tags.includes('opt_out')) {
        return Response.json({ success: true, skipped: 'opt_out_tag' });
      }
      // Regra "1x por dia": já recebeu o cartão hoje?
      const ultimoEnvio = contact.campos_personalizados?.cartao_acesso_enviado_em;
      if (ultimoEnvio === hojeStr()) {
        return Response.json({ success: true, skipped: 'ja_enviado_hoje' });
      }
    }

    if (!thread && contactId) {
      const threads = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: contactId, is_canonical: true
      });
      thread = threads[0] || null;
    }

    // ── Selecionar integração ──
    let integration = null;
    if (integrationId) {
      integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId).catch(() => null);
    }
    if (!integration) {
      const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      integration = (thread?.whatsapp_integration_id && ints.find(i => i.id === thread.whatsapp_integration_id)) || ints[0];
    }
    if (!integration) {
      return Response.json({ success: false, error: 'Nenhuma integração WhatsApp conectada' });
    }

    // ── Enviar via gateway ──
    const textoEnvio = (typeof secao !== 'undefined' && secao) ? SECOES[secao] : CARTAO_TEXTO;
    const payloadEnvio = {
      integration_id: integration.id,
      numero_destino: contact.telefone,
      mensagem: textoEnvio
    };
    // Cartão completo vai com MENU DE LISTA NATIVO (botão "Ver acessos" → opções com descrição)
    if (typeof secao === 'undefined' || !secao) {
      payloadEnvio.interactive_list = {
        title: 'Acessos NeuralTec',
        button_label: '⚡ Ver acessos',
        options: [
          { id: 'cartao_vendas', title: '💬 Vendas', description: 'Orçamentos e vendas' },
          { id: 'cartao_financeiro', title: '💰 Financeiro', description: '2ª via de boleto e Pix' },
          { id: 'cartao_suporte', title: '🛠️ Suporte', description: 'Assistência técnica' },
          { id: 'cartao_catalogo', title: '📦 Catálogo', description: 'Todos os produtos' },
          { id: 'cartao_compras', title: '🛒 Compras / Fornecedor', description: 'Canal para fornecedores' },
          { id: 'cartao_pix', title: '⚡ Pix', description: 'Chave CNPJ para pagamento' }
        ]
      };
    }
    const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', payloadEnvio);
    if (!resp?.data?.success) {
      return Response.json({ success: false, error: resp?.data?.error || 'erro_envio' });
    }

    // ── Persistir Message na thread ──
    const now = new Date().toISOString();
    if (thread) {
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contact.id,
        recipient_type: 'contact',
        content: textoEnvio,
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resp.data.message_id,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: trigger !== 'manual',
          message_type: 'cartao_acesso',
          trigger
        }
      });
    }

    // ── Marcar envio do dia no contato (apenas cartão completo) ──
    if (typeof secao === 'undefined' || !secao) await base44.asServiceRole.entities.Contact.update(contact.id, {
      campos_personalizados: {
        ...(contact.campos_personalizados || {}),
        cartao_acesso_enviado_em: hojeStr()
      }
    });

    console.log(`[enviarCartaoAcesso] ✅ ${contact.nome} (trigger=${trigger})`);
    return Response.json({ success: true, message_id: resp.data.message_id, trigger });

  } catch (error) {
    console.error('[enviarCartaoAcesso] ❌', error.message, '| detalhe:', JSON.stringify(error.response?.data || null), '| url:', error.config?.url);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});