import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// ENVIAR CARTÃO ACESSO — FONTE ÚNICA do menu de Acessos Rápidos NeuralTec
// ============================================================================
// Esta é a ÚNICA função que monta e envia o menu de Acessos Rápidos (cartão de
// visita). FORMATO ÚNICO: BOTÕES (send-button-actions). Nenhum outro formato é
// usado (sem lista, sem texto numérico, sem links em texto). Centraliza os 2
// estágios via parâmetro `acao`:
//
//   acao: 'menu'    (default) → cartão 1 com 3 CATEGORIAS em BOTÕES de resposta
//                               (REPLY — o toque devolve a escolha ao sistema,
//                                que abre o submenu).
//   acao: 'submenu' + resposta → destinos da categoria escolhida em BOTÕES de
//                               URL ↗ (o toque abre o link direto, sem URL
//                               escrita e SEM mensagem de confirmação).
//
// Pix NÃO faz parte deste menu — é enviado por ação manual do atendente
// (enviarPixChat, no menu de anexos). Aqui o tipo 'pix' é sempre ignorado.
//
// Gatilhos do 'menu':
//   1. manual          → atendente envia pelo chat (sem trava)
//   2. auto_primeira_msg → saudação inbound (guard temporal de 30min)
// ============================================================================

// ============================================================================
// ESTÁGIO 1 — CARTÃO DE 3 CATEGORIAS (formato BOTÕES)
// ============================================================================
// Menu principal sem título nem frase: só os botões. O WhatsApp exige algum
// corpo de texto, então usamos um caractere invisível (zero-width) como
// title/message para não exibir nada acima dos botões.
const MENU_TITULO = '\u200b';
const MENU_MENSAGEM = '\u200b';
const MENU_RODAPE = '\u200b';

const MENU_CATEGORIAS = [
  { id: 'acesso_menu:setores',   label: '🏢 Setores da Empresa' },
  { id: 'acesso_menu:promocoes', label: '🏷️ Promoções e Web Site' },
  { id: 'acesso_menu:redes',     label: '📱 Redes Sociais' }
];

// ============================================================================
// FONTE ÚNICA DE ENVIO — BOTÕES (send-button-actions)
// ============================================================================
// FORMATO ÚNICO. Todo cartão (categorias E destinos) sai em BOTÕES, sem nenhum
// outro formato (sem lista, sem texto numérico, sem links em texto).
// botoes: [{ buttonText, type: 'REPLAY'|'URL', id?, url? }]
//   • REPLAY → o toque devolve o id ao sistema (usado nas 3 categorias).
//   • URL    → o toque abre o link direto, sem link escrito (usado nos destinos).
async function enviarBotoes(integ, telefone, titulo, mensagem, botoes, rodape) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;

  if (integ.api_provider === 'w_api') {
    const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
      + `/message/send-button-actions?instanceId=${integ.instance_id_provider}`;
    // Título e rodapé só são enviados quando têm conteúdo real (não o
    // caractere invisível \u200b). Sem cabeçalho/título/rodapé: só os botões.
    // `message` sempre presente (W-API exige corpo) — invisível quando vazio.
    const temTitulo = titulo && titulo.replace(/\u200b/g, '').trim().length > 0;
    const temRodape = rodape && rodape.replace(/\u200b/g, '').trim().length > 0;
    const body = {
      phone,
      message: mensagem || '\u200b',
      ...(temTitulo ? { title: titulo } : {}),
      ...(temRodape ? { footer: rodape } : {}),
      buttonActions: botoes.map(b => b.type === 'URL'
        ? { type: 'URL', buttonText: b.buttonText, url: b.url }
        : { type: 'REPLAY', buttonText: b.buttonText, id: b.id }),
      delayMessage: 0
    };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
      body: JSON.stringify(body)
    });
    const rawText = await r.text().catch(() => '');
    let resp = {}; try { resp = rawText ? JSON.parse(rawText) : {}; } catch { resp = {}; }
    const msgId = resp.messageId || resp.insertedId || resp.id || resp.key?.id || null;
    return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp, httpStatus: r.status, rawText };
  }

  const url = (integ.base_url_provider || 'https://api.z-api.io')
    + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-button-actions`;
  const headers = { 'Content-Type': 'application/json' };
  if (integ.security_client_token_header) headers['Client-Token'] = integ.security_client_token_header;
  // Mesma regra do W-API: sem título/cabeçalho, só os botões. `message`
  // sempre presente (provedor exige corpo) — invisível quando vazio.
  const temTituloZ = titulo && titulo.replace(/\u200b/g, '').trim().length > 0;
  const corpoZ = temTituloZ ? `*${titulo}*\n${mensagem || ''}` : (mensagem || '\u200b');
  const body = {
    phone,
    message: corpoZ,
    buttonActions: botoes.map((b, i) => b.type === 'URL'
      ? { id: String(i + 1), type: 'URL', label: b.buttonText, url: b.url }
      : { id: b.id || String(i + 1), type: 'REPLAY', label: b.buttonText })
  };
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const rawText = await r.text().catch(() => '');
  let resp = {}; try { resp = rawText ? JSON.parse(rawText) : {}; } catch { resp = {}; }
  const msgId = resp.messageId || resp.id || resp.key?.id || null;
  return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp, httpStatus: r.status, rawText };
}

// ── Agrupa itens em 3 categorias: Setores / Promoções e Web Site / Redes Sociais ──
function agrupar(itens) {
  const g = { setores: [], promocoes: [], redes: [] };
  const ehRedeSocial = (t) =>
    t.includes('instagram') || t.includes('linkedin') || t.includes('facebook') ||
    t.includes('youtube') || t.includes('tiktok') || t.includes('twitter') ||
    t.includes('rede social') || t.includes('redes');
  for (const it of itens) {
    const tipo = String(it.tipo || 'link').toLowerCase();
    const t = String(it.titulo || '').toLowerCase();
    if (tipo === 'pix') continue; // Pix sai só por ação manual do atendente
    if (tipo === 'setor') g.setores.push(it);
    else if (ehRedeSocial(t)) g.redes.push(it);
    else g.promocoes.push(it); // Site, loja, promoções e localização
  }
  return g;
}

// ── Slug do setor a partir do título do item (Vendas → vendas, Assistência → assistencia) ──
function setorSlug(titulo) {
  const t = String(titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('vend')) return 'vendas';
  if (t.includes('assist') || t.includes('suporte')) return 'assistencia';
  if (t.includes('financ')) return 'financeiro';
  if (t.includes('compra')) return 'compras';
  return t.replace(/[^a-z_]/g, '_');
}

// ── Interpreta a escolha (número, palavra OU id da lista) ──
function escolherCategoria(conteudo) {
  const t = String(conteudo || '').trim().toLowerCase().replace('acesso_menu:', '');
  if (t === '1' || t === 'setores' || t.includes('setor')) return 'setores';
  if (t === '2' || t === 'promocoes' || t.includes('promo') || t.includes('site') || t.includes('web')) return 'promocoes';
  if (t === '3' || t === 'redes' || t.includes('rede') || t.includes('social') || t.includes('instagram')) return 'redes';
  return null;
}

// ── Resolver integração conectada — FONTE ÚNICA POR THREAD ──
// Prioridade ABSOLUTA: a conexão registrada na thread (a mesma que conduziu a
// saudação/conversa). Só usa o integrationId recebido ou o fallback [0] quando
// a thread ainda não tem conexão definida. Isso impede que o menu/submenu saia
// por uma conexão diferente da que o cliente está conversando (evita o cliente
// ver dois remetentes — ex: saudação pela "Vendas" e menu pela "Campanhas-2800").
async function resolverIntegracao(base44, integrationId, thread) {
  const ids = [thread?.whatsapp_integration_id, integrationId].filter(Boolean);
  for (const id of ids) {
    const integ = await base44.asServiceRole.entities.WhatsAppIntegration.get(id).catch(() => null);
    if (integ) return integ;
  }
  const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
  return ints[0] || null;
}

// ============================================================================
// HANDLER ÚNICO
// ============================================================================
Deno.serve(async (req) => {
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const acao = body?.acao || 'menu';

    // ════════════════════════════════════════════════════════════════
    // ESTÁGIO FORA-HORÁRIO — LINKS DIRETOS (sem menu de categorias)
    // Fora do expediente não há atendente nos setores, então pulamos o menu
    // de 3 categorias e o grupo "setores". Enviamos direto os destinos de URL
    // de Promoções/Web Site e, em seguida, Redes Sociais (dois cartões em
    // sequência). Guard: uma vez por dia BRT por thread (anti-flood).
    // ════════════════════════════════════════════════════════════════
    if (acao === 'menu_fora_horario') {
      etapa = 'fora_horario_carregar_thread';
      const threadId = body?.thread_id;
      if (!threadId) return Response.json({ success: true, skipped: 'sem_thread' });

      const thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
      if (!thread) return Response.json({ success: true, skipped: 'thread_nao_encontrada' });

      const cp = thread.campos_personalizados || {};

      // Sem guard de 1x/dia: o menu fora-horário acompanha SEMPRE o ACK/vídeo
      // fora de horário (o cooldown de ACK na skill já evita flood).
      const contato = await base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null);
      if (!contato?.telefone) return Response.json({ success: false, error: 'contato_sem_telefone' });

      // Coerência de fase com o estágio 'menu' (horário comercial): fornecedor,
      // tipo não-permitido e contato bloqueado NÃO recebem o menu — nem fora
      // do expediente. Sem isto, o caminho fora-horário burlaria esses guards.
      {
        const tipoFH = String(contato.tipo_contato || '').toLowerCase();
        const tiposPermitidosFH = ['novo', 'lead', 'cliente', 'eventual', 'ex_cliente', 'parceiro'];
        if (tipoFH === 'fornecedor') return Response.json({ success: true, skipped: 'tipo_contato_fornecedor' });
        if (tipoFH && !tiposPermitidosFH.includes(tipoFH)) return Response.json({ success: true, skipped: 'tipo_contato_nao_permitido', tipo: tipoFH });
        if (contato.bloqueado) return Response.json({ success: true, skipped: 'bloqueado' });
      }

      etapa = 'fora_horario_integracao';
      const integration = await resolverIntegracao(base44, body?.integration_id || thread.whatsapp_integration_id, thread);
      if (!integration) return Response.json({ success: false, error: 'sem_integracao_conectada' });

      const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
      const grupos = agrupar(itens);

      // Ordem: Promoções/Web Site primeiro, Redes Sociais depois.
      // Envia TODOS os destinos ativos de cada bloco como links diretos (URL).
      const blocos = [
        { categoria: 'promocoes', lista: grupos.promocoes, rodape: '\u200b' },
        { categoria: 'redes', lista: grupos.redes || [], rodape: '\u200b' }
      ];

      etapa = 'fora_horario_enviar';
      const enviados = [];
      for (const bloco of blocos) {
        if (!bloco.lista?.length) continue;
        const botoes = bloco.lista.map(it => ({ type: 'URL', buttonText: String(it.titulo || '').slice(0, 24), url: it.url }));
        for (let i = 0; i < botoes.length; i += 3) {
          const lote = botoes.slice(i, i + 3);
          const r = await enviarBotoes(integration, contato.telefone, '\u200b', '\u200b', lote, bloco.rodape);
          if (!r.ok) return Response.json({ success: false, error: 'erro_envio', categoria: bloco.categoria, detalhe: r.raw });
          enviados.push({ categoria: bloco.categoria, msgId: r.msgId });
        }
      }

      if (!enviados.length) return Response.json({ success: true, skipped: 'sem_destinos_fora_horario' });

      const now = new Date().toISOString();
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contato.id,
        recipient_type: 'contact',
        content: 'Acessos rápidos (fora de horário)',
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: enviados[enviados.length - 1].msgId,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: true,
          message_type: 'acessos_menu_fora_horario',
          formato: 'botoes',
          categorias: enviados.map(e => e.categoria)
        }
      });

      console.log(`[enviarCartaoAcesso] ✅ menu fora-horário (${enviados.map(e => e.categoria).join('+')}) → ${contato.nome}`);
      return Response.json({ success: true, enviados });
    }

    // ════════════════════════════════════════════════════════════════
    // ESTÁGIO 2 — SUBMENU (destinos da categoria) em BOTÕES
    // Chamado pelo processInbound quando o cliente escolhe uma categoria.
    // ════════════════════════════════════════════════════════════════
    if (acao === 'submenu') {
      etapa = 'submenu_carregar_thread';
      const threadId = body?.thread_id;
      const resposta = body?.resposta || body?.content || '';
      if (!threadId) return Response.json({ success: true, skipped: 'sem_thread' });

      const thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
      if (!thread) return Response.json({ success: true, skipped: 'thread_nao_encontrada' });

      const cp = thread.campos_personalizados || {};
      if (!cp.acesso_menu_nivel) return Response.json({ success: true, skipped: 'menu_nao_aberto' });

      // Timeout de 30min: menu antigo é limpo e ignorado
      if (cp.acesso_menu_updated_at && (Date.now() - new Date(cp.acesso_menu_updated_at).getTime()) > 30 * 60 * 1000) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          campos_personalizados: { ...cp, acesso_menu_nivel: null }
        });
        return Response.json({ success: true, skipped: 'menu_expirado' });
      }

      const escolha = String(resposta || '').trim();

      etapa = 'submenu_resolver_categoria';
      const categoria = escolherCategoria(escolha);
      if (!categoria) return Response.json({ success: true, skipped: 'escolha_nao_reconhecida' });

      // ── TRAVA ANTI-DUPLICIDADE POR CATEGORIA RESOLVIDA ──
      // A chave usa a CATEGORIA (não o texto/id bruto): clique via texto
      // ("🏢 Setores") e via id ("acesso_menu:setores") resolvem a mesma
      // categoria, então ambos batem na mesma trava — sem reenvio duplicado.
      // ⚠️ A trava é gravada SÓ APÓS o envio bem-sucedido (mais abaixo): se o
      // envio falhar, a reentrega NÃO é bloqueada e o submenu pode reabrir.
      const chaveEscolha = `submenu:${categoria}`;
      if (cp.acesso_menu_last_choice === chaveEscolha && cp.acesso_menu_last_choice_at) {
        const idadeMs = Date.now() - new Date(cp.acesso_menu_last_choice_at).getTime();
        if (idadeMs < 15_000) {
          return Response.json({ success: true, skipped: 'duplicata_escolha', chave: chaveEscolha });
        }
      }

      const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
      const grupos = agrupar(itens);
      const lista = grupos[categoria];
      if (!lista || !lista.length) return Response.json({ success: true, skipped: 'categoria_vazia', categoria });

      const contactId = thread.contact_id;
      const contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
      if (!contato?.telefone) return Response.json({ success: false, error: 'contato_sem_telefone' });

      etapa = 'submenu_integracao';
      const integration = await resolverIntegracao(base44, body?.integration_id || thread.whatsapp_integration_id, thread);
      if (!integration) return Response.json({ success: false, error: 'sem_integracao_conectada' });

      const isRedes = categoria === 'redes';
      const isSetores = categoria === 'setores';
      // Submenu sem título nem frase de confirmação: só os botões.
      // O WhatsApp exige algum corpo de texto, então usamos um espaço mínimo
      // (zero-width) como title/message para não exibir nada acima dos botões.
      const titulo = '\u200b';
      // Setores: corpo VISÍVEL (se os botões não renderizarem no aparelho, o
      // cliente ainda vê a instrução e pode responder pelo nome do setor).
      const mensagem = isSetores ? 'Escolha o setor para ser atendido agora 👇' : '\u200b';

      // Redes: envia TODAS as redes ativas (Instagram, LinkedIn e o que houver),
      // uma a uma, igual ao fluxo fora-horário. Sem rodapé "em breve".
      const itensDestino = lista;
      const rodape = '\u200b';

      // FORMATO ÚNICO: botões de URL ↗. O WhatsApp interativo aceita no máx 3
      // botões por mensagem — se houver mais destinos (ex: 4 setores), envia em
      // lotes de 3 (cartões em sequência), sem cabeçalho/título, só os botões.
      // SETORES: botões de RESPOSTA (REPLAY) — o toque devolve "acesso_setor:<setor>"
      // ao sistema, que roteia IMEDIATAMENTE na MESMA conversa (fidelizado >
      // menor carga, na skillPreAtendimentos). Antes eram links wa.me que
      // apontavam para o próprio número da conversa e não executavam nada.
      // Demais categorias seguem como botões de URL.
      const todosBotoes = itensDestino.map(it => isSetores
        ? { type: 'REPLAY', buttonText: String(it.titulo || '').slice(0, 24), id: `acesso_setor:${setorSlug(it.titulo)}` }
        : { type: 'URL', buttonText: String(it.titulo || '').slice(0, 24), url: it.url });
      if (!todosBotoes.length) return Response.json({ success: true, skipped: 'sem_destinos', categoria });

      etapa = 'submenu_enviar_botoes';
      const formato = 'botoes';
      const lotes = [];
      for (let i = 0; i < todosBotoes.length; i += 3) lotes.push(todosBotoes.slice(i, i + 3));

      let resp = null;
      for (const loteBotoes of lotes) {
        resp = await enviarBotoes(integration, contato.telefone, titulo, mensagem, loteBotoes, rodape);
        console.log(`[enviarCartaoAcesso:submenu] 🔎 ${categoria} lote(${loteBotoes.length}) →`, JSON.stringify({ ok: resp.ok, httpStatus: resp.httpStatus, rawText: resp.rawText }));
        if (!resp.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
      }

      // Persiste Message + mantém nível principal (cliente pode tocar outra categoria)
      etapa = 'submenu_persistir';
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contato.id,
        recipient_type: 'contact',
        content: `Submenu: ${categoria}`,
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resp.msgId,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: true,
          message_type: 'acessos_submenu',
          categoria,
          formato
        }
      });
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: {
          ...cp,
          // Setores abre o estado 'setores': a resposta do cliente (clique ou
          // nome digitado) é tratada como escolha de setor pelo pré-atendimento.
          acesso_menu_nivel: isSetores ? 'setores' : 'principal',
          acesso_menu_updated_at: now,
          // Trava anti-duplicidade gravada só agora (pós-envio OK): falha de
          // envio não bloqueia reenvio; clique repetido da mesma categoria sim.
          acesso_menu_last_choice: chaveEscolha,
          acesso_menu_last_choice_at: now
        }
      });

      console.log(`[enviarCartaoAcesso:submenu] ✅ ${categoria} (${formato}) → ${contato.nome}`);
      return Response.json({ success: true, message_id: resp.msgId, categoria, formato });
    }

    // ════════════════════════════════════════════════════════════════
    // ESTÁGIO 1 — CARTÃO DE CATEGORIAS (formato BOTÕES) — acao 'menu'
    // ════════════════════════════════════════════════════════════════
    const isAutomacao = !!body?.event;
    let threadId, contactId, integrationId, trigger;

    if (isAutomacao) {
      const msg = body.data;
      if (!msg || msg.sender_type !== 'contact' || msg.channel !== 'whatsapp') {
        return Response.json({ success: true, skipped: 'nao_inbound_whatsapp' });
      }
      threadId = msg.thread_id;
      contactId = msg.sender_id;
      trigger = 'auto_primeira_msg';
    } else if (body?.source === 'skill_saudacao') {
      threadId = body.thread_id;
      contactId = body.contact_id;
      integrationId = body.integration_id || null;
      trigger = 'auto_primeira_msg';
    } else if (body?.source === 'encaminhamento_manual') {
      // Encaminhamento manual do atendente (backend→backend, sem sessão):
      // trata como ação manual → ignora cooldown de 30min e guards de saudação.
      threadId = body.thread_id;
      contactId = body.contact_id;
      integrationId = body.integration_id || null;
      trigger = 'manual';
      // Encaminhamento direto por telefone (sem thread/contact): resolve o contato.
      if (!threadId && !contactId && body?.target_phone) {
        const contatoResp = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
          telefone: body.target_phone,
          integracaoId: integrationId
        });
        contactId = contatoResp.data?.contact?.id || null;
      }
    } else {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      threadId = body.thread_id;
      contactId = body.contact_id;
      integrationId = body.integration_id || null;
      trigger = 'manual';
    }

    if (!threadId && !contactId) {
      return Response.json({ success: false, error: 'thread_id ou contact_id obrigatório' }, { status: 400 });
    }

    etapa = 'carregar_thread_contato';
    let thread = null;
    if (threadId) {
      thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
    }
    if (!contactId && thread?.contact_id) contactId = thread.contact_id;
    if (!contactId) return Response.json({ success: false, error: 'Contato não identificado' });

    if (!thread && contactId) {
      const threads = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: contactId, is_canonical: true
      });
      thread = threads[0] || null;
    }

    // ── Guard (modo automático): só dispara em SAUDAÇÃO ──
    if (trigger === 'auto_primeira_msg' && body?.source !== 'skill_saudacao') {
      const texto = String(body?.data?.content || '').toLowerCase().trim();
      const ehSaudacao = /(^|\b)(oi+|ol[aá]+|opa|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*a[ií]|eai)(\b|$|[\s!.,?])/.test(texto);
      if (!ehSaudacao) {
        return Response.json({ success: true, skipped: 'nao_eh_saudacao' });
      }
    }

    // ── Guard ANTI-REENVIO TEMPORAL (30 min) ──
    // EXCEÇÃO: saudação explícita (source='skill_saudacao') SEMPRE reenvia o menu —
    // toda vez que o cliente cumprimenta ("oi", "bom dia"...), o menu vem logo
    // após o ACK, sem o cooldown de 30min. O guard segue valendo para os demais
    // disparos automáticos (ex: inbound genérico), evitando spam de menu.
    if (trigger === 'auto_primeira_msg' && body?.source !== 'skill_saudacao') {
      const enviadoEm = thread?.campos_personalizados?.acessos_rapidos_enviado_em;
      const MENU_REENVIO_GAP_MS = 30 * 60 * 1000;
      if (enviadoEm && (Date.now() - new Date(enviadoEm).getTime() < MENU_REENVIO_GAP_MS)) {
        return Response.json({ success: true, skipped: 'menu_enviado_recentemente_30min' });
      }
    }

    etapa = 'carregar_contact';
    const contact = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
    if (!contact?.telefone) {
      return Response.json({ success: false, skipped: 'sem_telefone' });
    }

    if (trigger === 'auto_primeira_msg') {
      const tipo = String(contact.tipo_contato || '').toLowerCase();
      const tiposPermitidos = ['novo', 'lead', 'cliente', 'eventual', 'ex_cliente', 'parceiro'];
      if (tipo === 'fornecedor') {
        return Response.json({ success: true, skipped: 'tipo_contato_fornecedor' });
      }
      if (tipo && !tiposPermitidos.includes(tipo)) {
        return Response.json({ success: true, skipped: 'tipo_contato_nao_permitido', tipo });
      }
      if (contact.bloqueado) {
        return Response.json({ success: true, skipped: 'bloqueado' });
      }
    }

    etapa = 'selecionar_integracao';
    const integration = await resolverIntegracao(base44, integrationId, thread);
    if (!integration) {
      return Response.json({ success: false, error: 'Nenhuma integração WhatsApp conectada' });
    }

    etapa = 'enviar_categorias';
    // FORMATO ÚNICO: as 3 categorias em BOTÕES de resposta (REPLAY).
    const formato = 'botoes';
    const botoesCategorias = MENU_CATEGORIAS.map(c => ({ type: 'REPLAY', buttonText: c.label, id: c.id }));
    const resp = await enviarBotoes(integration, contact.telefone, MENU_TITULO, MENU_MENSAGEM, botoesCategorias, MENU_RODAPE);
    console.log(`[enviarCartaoAcesso] 🔎 ${integration.api_provider} categorias →`, JSON.stringify({ ok: resp.ok, httpStatus: resp.httpStatus, rawText: resp.rawText }));
    if (!resp.ok) {
      return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
    }

    const now = new Date().toISOString();
    if (thread) {
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contact.id,
        recipient_type: 'contact',
        // Rótulo VISÍVEL só na Central (o cliente recebe apenas os botões).
        // Antes gravava '\u200b\n\u200b' (invisível) e a bolha aparecia vazia,
        // dando a impressão de que o cartão manual não havia sido enviado.
        content: 'Acessos rápidos (menu de categorias)',
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resp.msgId,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: trigger !== 'manual',
          message_type: 'acessos_menu_categorias',
          formato,
          trigger
        }
      });

      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: {
          ...(thread.campos_personalizados || {}),
          acesso_menu_nivel: 'principal',
          acesso_menu_updated_at: now,
          acessos_rapidos_enviado: true,
          acessos_rapidos_enviado_em: now
        }
      });
    }

    console.log(`[enviarCartaoAcesso] ✅ menu categorias (${formato}) → ${contact.nome} (trigger=${trigger})`);
    return Response.json({ success: true, message_id: resp.msgId, formato, trigger });

  } catch (error) {
    console.error('[enviarCartaoAcesso] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});