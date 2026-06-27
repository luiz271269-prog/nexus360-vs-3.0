import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Decodifica cabeçalhos MIME "encoded-word" (RFC 2047): =?charset?B/Q?texto?=
function decodeMimeWords(str) {
  if (!str || !String(str).includes('=?')) return String(str || '');
  try {
    return String(str).replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, charset, enc, text) => {
      const cs = (charset || 'utf-8').toLowerCase();
      let bytes;
      if (enc.toUpperCase() === 'B') {
        const bin = atob(text.replace(/\s+/g, ''));
        bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      } else {
        const qp = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
        bytes = Uint8Array.from(qp, (c) => c.charCodeAt(0));
      }
      try {
        return new TextDecoder(cs).decode(bytes);
      } catch {
        return new TextDecoder('utf-8').decode(bytes);
      }
    }).replace(/\?=\s+=\?/g, '').trim();
  } catch {
    return String(str);
  }
}

// Admin-only: corrige assunto e nome do remetente codificados em MIME nos EmailSincronizado existentes.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const db = base44.asServiceRole.entities;
    const todos = await db.EmailSincronizado.list('-created_date', 500);

    let corrigidos = 0;
    for (const e of todos || []) {
      const assuntoTemMime = e.assunto && String(e.assunto).includes('=?');
      const nomeTemMime = e.remetente_nome && String(e.remetente_nome).includes('=?');
      if (!assuntoTemMime && !nomeTemMime) continue;

      const patch = {};
      if (assuntoTemMime) patch.assunto = decodeMimeWords(e.assunto);
      if (nomeTemMime) patch.remetente_nome = decodeMimeWords(e.remetente_nome);

      await db.EmailSincronizado.update(e.id, patch);
      corrigidos++;
    }

    return Response.json({ ok: true, total_verificados: (todos || []).length, corrigidos });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});