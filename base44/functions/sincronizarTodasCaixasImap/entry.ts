import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Orquestrador: percorre TODAS as EmailAccount IMAP (Zimbra) ativas com
// inbound habilitado e dispara a sincronização individual de cada uma.
// Usado pela automação agendada para que financeiro, assistencia, cesar, etc.
// também sejam lidas — não apenas a caixa do Luiz.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Permite execução pela automação (sem user) ou por admin
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const db = base44.asServiceRole.entities;

    // Apenas caixas IMAP (Zimbra) ativas e com leitura habilitada.
    // Gmail é lido por webhook (gmailWebhookHandler), não por IMAP.
    const todas = await db.EmailAccount.filter({ provider: 'zimbra', status: 'active' }, 'email_address', 500);
    const caixas = (todas || []).filter((c) => c.inbound_enabled !== false && c.imap_host);

    const resultados = [];
    for (const conta of caixas) {
      try {
        const resp = await base44.asServiceRole.functions.invoke('sincronizarEmailsImap', {
          email_account_id: conta.id,
          internal_secret: Deno.env.get('BASE44_APP_ID')
        });
        const data = resp?.data || resp;
        resultados.push({
          conta: conta.email_address,
          ok: data?.ok !== false,
          novos: data?.novos_processados ?? 0,
          auto_aprovados: data?.auto_aprovados ?? 0,
          pendentes: data?.pendentes_aprovacao ?? 0,
          erro: data?.ok === false ? data?.error : undefined
        });
      } catch (err) {
        resultados.push({
          conta: conta.email_address,
          ok: false,
          erro: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const totalNovos = resultados.reduce((s, r) => s + (r.novos || 0), 0);
    const comErro = resultados.filter((r) => !r.ok).length;

    return Response.json({
      ok: true,
      caixas_processadas: caixas.length,
      total_novos: totalNovos,
      caixas_com_erro: comErro,
      resultados
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});