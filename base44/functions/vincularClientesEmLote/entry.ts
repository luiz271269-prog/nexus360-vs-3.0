import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ==========================================================
// SPRINT 3 — SANEAMENTO DE VÍNCULOS EM LOTE
// ==========================================================
// Fase A: propaga cliente_id dos Contacts já vinculados para
//         suas MessageThreads (habilita a Timeline 360°).
// Fase B: aplica o MESMO matching seguro do vincularClienteAutomatico
//         aos contatos órfãos (empresa idêntica / telefone idêntico /
//         token único), vinculando só matches sem ambiguidade.
// Suporta { dry_run: true } para simular sem gravar.

const norm = (v: unknown) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

const STOPWORDS = new Set([
  'compras', 'comercial', 'vendas', 'financeiro', 'suporte', 'atendimento',
  'ed', 'edu', 'educacao', 'educacional', 'infantil', 'comunidade', 'central',
  'ltda', 'me', 'sa', 'eireli', 'epp', 'cia', 'grupo', 'empresa', 'servico',
  'servicos', 'social', 'do', 'da', 'de', 'dos', 'das', 'e', 'matriz', 'filial'
]);

const tokensFortes = (v: unknown) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));

const soDigitos = (v: unknown) => String(v || '').replace(/\D/g, '');
const nucleoTel = (v: unknown) => {
  const d = soDigitos(v);
  return d.length >= 8 ? d.slice(-8) : d;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;

    const [clientes, contatos, threads] = await Promise.all([
      base44.asServiceRole.entities.Cliente.list('-updated_date', 2000),
      base44.asServiceRole.entities.Contact.list('-updated_date', 3000),
      base44.asServiceRole.entities.MessageThread.filter({ thread_type: 'contact_external' }, '-last_message_at', 3000),
    ]);

    // Índice de clientes pré-normalizado
    const idxClientes = clientes.map((c: any) => ({
      id: c.id,
      razao: norm(c.razao_social),
      fantasia: norm(c.nome_fantasia),
      contatoNome: norm(c.contato_principal_nome),
      tel: nucleoTel(c.telefone),
      tokens: new Set([...tokensFortes(c.razao_social), ...tokensFortes(c.nome_fantasia)]),
      raw: c,
    }));

    // ---------- FASE B: vincular órfãos ----------
    const orfaos = contatos.filter((c: any) => !c.cliente_id);
    const contactUpdates: any[] = [];
    const vinculados: any[] = [];
    let comSugestaoAmbigua = 0;
    let semMatch = 0;

    for (const contato of orfaos) {
      const empresaContato = norm(contato.empresa);
      const nomeContato = norm(contato.nome);
      const telContato = nucleoTel(contato.telefone || contato.telefone_canonico);
      const tokensNome = tokensFortes(contato.nome);

      if (!empresaContato && !nomeContato && !telContato) { semMatch++; continue; }

      const contidaEm = (termo: string, alvo: string) => termo.length >= 5 && alvo.length >= 5 && alvo.includes(termo);
      const candidatos: any[] = [];

      for (const cl of idxClientes) {
        let score = 0;
        let exato = false;
        const motivos: string[] = [];

        if (empresaContato && (empresaContato === cl.razao || empresaContato === cl.fantasia)) {
          score += 100; exato = true; motivos.push('empresa idêntica');
        } else if (empresaContato && (contidaEm(empresaContato, cl.razao) || contidaEm(empresaContato, cl.fantasia))) {
          score += 50; motivos.push('empresa parecida');
        }

        if (nomeContato && cl.contatoNome && nomeContato === cl.contatoNome) {
          score += 40; motivos.push('nome do contato igual');
        }

        // Token match exige PALAVRA INTEIRA igual (não substring) para evitar
        // falsos positivos tipo "cris" dentro de "cristina" ou "icon" em "confeccoes".
        if (!empresaContato && tokensNome.length > 0) {
          const tokenComum = tokensNome.find((t) => cl.tokens.has(t));
          if (tokenComum) { score += 45; motivos.push(`token "${tokenComum}"`); }
        }

        if (telContato && cl.tel && telContato === cl.tel) {
          score += 60; exato = true; motivos.push('telefone idêntico');
        }

        if (score > 0) candidatos.push({ cl, score, exato, motivos });
      }

      if (candidatos.length === 0) { semMatch++; continue; }
      candidatos.sort((a, b) => b.score - a.score);
      const melhor = candidatos[0];
      const empate = candidatos.length > 1 && candidatos[1].score === melhor.score;
      // Em LOTE, só vínculo 100% seguro (empresa idêntica ou telefone idêntico).
      // Matches por token de nome (ex: "Bruno" → "BRUNO RICARDO") ficam pendentes
      // para confirmação humana — evita vínculos errados em massa.
      if (melhor.exato && !empate) {
        const clienteVinc = melhor.cl.raw;
        const vendedorId = clienteVinc?.usuario_id || null;
        const update: any = { id: contato.id, cliente_id: clienteVinc.id, tipo_contato: 'cliente' };
        if (!contato.empresa && (clienteVinc.razao_social || clienteVinc.nome_fantasia)) {
          update.empresa = clienteVinc.razao_social || clienteVinc.nome_fantasia;
        }
        if (clienteVinc.ramo_atividade && !contato.ramo_atividade) {
          update.ramo_atividade = clienteVinc.ramo_atividade;
          update.ramo_atividade_origem = 'cliente';
        }
        if (vendedorId && /^[a-f0-9]{24}$/i.test(String(vendedorId)) && !contato.atendente_fidelizado_vendas) {
          update.atendente_fidelizado_vendas = vendedorId;
          update.is_cliente_fidelizado = true;
        }
        contactUpdates.push(update);
        vinculados.push({ contato: contato.nome, cliente: clienteVinc.razao_social, motivos: melhor.motivos });
      } else {
        comSugestaoAmbigua++;
      }
    }

    // ---------- FASE A: propagar cliente_id para as threads ----------
    // Mapa contact_id -> cliente_id (existentes + os que serão vinculados agora)
    const mapaContatoCliente: Record<string, string> = {};
    for (const c of contatos) if (c.cliente_id) mapaContatoCliente[c.id] = c.cliente_id;
    for (const u of contactUpdates) mapaContatoCliente[u.id] = u.cliente_id;

    const threadUpdates: any[] = [];
    for (const t of threads) {
      if (t.cliente_id) continue;
      const clienteId = t.contact_id ? mapaContatoCliente[t.contact_id] : null;
      if (clienteId) threadUpdates.push({ id: t.id, cliente_id: clienteId });
    }

    // ---------- Gravar ----------
    if (!dryRun) {
      for (let i = 0; i < contactUpdates.length; i += 400) {
        await base44.asServiceRole.entities.Contact.bulkUpdate(contactUpdates.slice(i, i + 400));
      }
      for (let i = 0; i < threadUpdates.length; i += 400) {
        await base44.asServiceRole.entities.MessageThread.bulkUpdate(threadUpdates.slice(i, i + 400));
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      orfaos_analisados: orfaos.length,
      contatos_vinculados: contactUpdates.length,
      ambiguos_pendentes: comSugestaoAmbigua,
      sem_match: semMatch,
      threads_propagadas: threadUpdates.length,
      amostra_vinculos: vinculados.slice(0, 15),
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});