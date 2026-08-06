import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mes = /^\d{4}-\d{2}$/.test(String(body?.mes || '')) ? String(body.mes) : '2026-06';
    const inicio = `${mes}-01T00:00:00.000Z`;
    const proximoMes = new Date(`${mes}-01T00:00:00.000Z`);
    proximoMes.setUTCMonth(proximoMes.getUTCMonth() + 1);
    const fim = proximoMes.toISOString();

    const contatos = await base44.asServiceRole.entities.Contact.filter({
      ultima_interacao: { $gte: inicio, $lt: fim }
    }, 'ultima_interacao', 500);

    const classificarFoto = (valor) => {
      const foto = String(valor || '').trim();
      if (!foto || foto === 'null' || foto === 'undefined') return 'foto_ausente';
      if (foto.includes('pps.whatsapp.net')) return 'url_temporaria_whatsapp';
      if (/w-api|z-api|whatsapp/i.test(foto)) return 'url_externa_nao_permanente';
      if (!/^https?:\/\//i.test(foto)) return 'url_invalida';
      return null;
    };

    const candidatos = contatos.map((contato) => {
      const telefone = String(contato.telefone_canonico || contato.telefone || '').replace(/\D/g, '');
      const motivoFoto = classificarFoto(contato.foto_perfil_url);
      const motivo = telefone.length < 10 ? 'telefone_invalido' : motivoFoto;
      return {
        contact_id: contato.id,
        nome: contato.nome || '',
        telefone,
        ultima_interacao: contato.ultima_interacao || null,
        foto_atual: contato.foto_perfil_url || null,
        motivo_pendencia: motivo
      };
    }).filter((item) => item.telefone.length >= 10 && item.motivo_pendencia);

    return Response.json({
      success: true,
      read_only: true,
      mes,
      total_no_periodo: contatos.length,
      total_candidatos: candidatos.length,
      resultado_limitado: contatos.length === 500,
      candidatos
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});