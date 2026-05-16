import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// FIX #1 Sprint 1 — corrige threads com routing_stage='ASSIGNED' mas assigned_user_id=null.
// Reverte para routing_stage='NEW' + pre_atendimento_ativo=false para permitir re-roteamento.
// Modo dry_run=true por padrão. Admin-only.

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403, headers });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true
    const limit = Math.min(body.limit || 200, 500);

    // Buscar candidatos: ASSIGNED sem assigned_user_id
    const candidatos = await base44.asServiceRole.entities.MessageThread.filter({
      routing_stage: 'ASSIGNED',
      assigned_user_id: null
    }, '-updated_date', limit);

    const resultado = {
      total_encontrados: candidatos.length,
      dry_run: dryRun,
      corrigidos: [],
      erros: []
    };

    for (const t of candidatos) {
      try {
        if (!dryRun) {
          await base44.asServiceRole.entities.MessageThread.update(t.id, {
            routing_stage: 'NEW',
            pre_atendimento_ativo: false
          });
          await base44.asServiceRole.entities.AutomationLog.create({
            thread_id: t.id,
            contato_id: t.contact_id,
            acao: 'outro',
            resultado: 'sucesso',
            origem: 'manual',
            timestamp: new Date().toISOString(),
            detalhes: { mensagem: 'Backfill: routing_stage ASSIGNED→NEW (sem assigned_user_id)' },
            metadata: { event_type: 'backfill_routing_stage', thread_id: t.id, from: 'ASSIGNED', to: 'NEW' }
          }).catch(() => {});
        }
        resultado.corrigidos.push({
          thread_id: t.id,
          contact_id: t.contact_id,
          sector_id: t.sector_id,
          last_inbound_at: t.last_inbound_at,
          updated_date: t.updated_date
        });
      } catch (e) {
        resultado.erros.push({ thread_id: t.id, error: e.message });
      }
    }

    return Response.json({ success: true, ...resultado }, { headers });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});