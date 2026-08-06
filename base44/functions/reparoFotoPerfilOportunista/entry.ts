import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Reparo oportunista de foto de perfil.
// Disparado por mensagem inbound, SEMPRE unitário e fora do caminho crítico.
// Não zera foto existente: em falha só marca a tentativa (cooldown).
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { contact_id } = await req.json().catch(() => ({}));
    if (!contact_id) return Response.json({ skipped: true, reason: 'sem_contact_id' });

    const c = await base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null);
    if (!c) return Response.json({ skipped: true, reason: 'contato_nao_encontrado' });

    // Guard 1: telefone brasileiro plausível (bloqueia JID de grupo e lixo)
    const tel = String(c.telefone_canonico || c.telefone || '').replace(/\D/g, '');
    if (!/^55\d{10,11}$/.test(tel)) {
      return Response.json({ skipped: true, reason: 'telefone_invalido', tel });
    }

    // Guard 2: já tem foto permanente
    const foto = String(c.foto_perfil_url || '').trim();
    const permanente = /^https?:\/\//i.test(foto)
      && !foto.includes('pps.whatsapp.net')
      && !/w-api|z-api|whatsapp/i.test(foto);
    if (permanente) return Response.json({ skipped: true, reason: 'ja_tem_foto_permanente' });

    // Guard 3 (também é o lock): cooldown de 7 dias
    const tentadoEm = c.foto_perfil_atualizada_em ? new Date(c.foto_perfil_atualizada_em).getTime() : 0;
    if (Date.now() - tentadoEm <= COOLDOWN_MS) {
      return Response.json({ skipped: true, reason: 'cooldown_7d' });
    }

    // Lock: marca a tentativa ANTES de resolver. Duas mensagens simultâneas
    // -> a segunda cai no cooldown e não dispara busca duplicada.
    await base44.asServiceRole.entities.Contact.update(contact_id, {
      foto_perfil_atualizada_em: new Date().toISOString()
    }).catch(() => {});

    const r = await base44.asServiceRole.functions.invoke('resolverFotoPerfil', {
      phone: tel,
      contact_id,
      persistir: true
    });
    const dados = r?.data || r;

    return Response.json({
      success: true,
      contact_id,
      status: dados?.file_url ? 'sucesso' : 'sem_foto_publica',
      file_url: dados?.file_url || null,
      provider: dados?.provider || null
    });
  } catch (error) {
    // Falha nunca propaga para o inbound.
    return Response.json({ success: false, error: error.message });
  }
});