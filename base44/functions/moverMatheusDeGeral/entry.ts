// Função para mover Matheus de "geral" para "telemarketing"
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const matheuId = '69024ef5cb212dfb4b5a4a1b';
    const matheus = await base44.asServiceRole.entities.User.get(matheuId);

    // Atualizar setor e whatsapp_setores
    const dataMerged = {
      ...matheus.data,
      attendant_sector: 'telemarketing',
      whatsapp_setores: ['telemarketing']
    };

    await base44.asServiceRole.entities.User.update(matheuId, {
      data: dataMerged
    });

    console.log('✅ Matheus movido para telemarketing');

    return Response.json({
      sucesso: true,
      mensagem: 'Matheus agora está em setor "telemarketing" e não mais em "geral"'
    });
  } catch (error) {
    console.error('[MOVE-MATHEUS] Erro:', error.message);
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
});