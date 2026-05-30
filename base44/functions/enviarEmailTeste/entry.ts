import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const destinatarios = Array.isArray(body.to) && body.to.length
      ? body.to
      : ['luiz@liesch.com.br', 'luiz271269@gmail.com'];

    const subject = body.subject || 'Teste de e-mail — Nexus360';
    const html = body.body || `
      <div style="font-family:sans-serif">
        <h2>✅ Teste de e-mail do Nexus360</h2>
        <p>Este é um e-mail de teste enviado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</p>
        <p>Se você recebeu esta mensagem, o envio de e-mail está funcionando.</p>
      </div>`;

    const resultados = [];
    for (const to of destinatarios) {
      try {
        await base44.integrations.Core.SendEmail({
          to,
          subject,
          body: html,
          from_name: 'Nexus360'
        });
        resultados.push({ to, status: 'enviado' });
      } catch (e) {
        resultados.push({ to, status: 'erro', erro: e.message });
      }
    }

    return Response.json({ ok: true, resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});