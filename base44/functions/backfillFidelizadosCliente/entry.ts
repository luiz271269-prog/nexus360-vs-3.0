import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * backfillFidelizadosCliente
 * Execução única (admin): varre contatos com is_cliente_fidelizado = true
 * e cliente_id = null, cria/vincula diretamente na entidade Cliente.
 */

const normalizarTelefone = (t) => (t || '').replace(/\D/g, '');
const normalizarCNPJ = (c) => (c || '').replace(/\D/g, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Buscar todos os fidelizados sem cliente_id
    const contatos = await base44.asServiceRole.entities.Contact.filter(
      { is_cliente_fidelizado: true },
      'nome',
      200
    );

    const semClienteId = contatos.filter(c => !c.cliente_id);
    console.log(`[backfill] Encontrados ${semClienteId.length} fidelizados sem cliente_id`);

    const resultados = [];

    for (const contato of semClienteId) {
      try {
        let clienteId = null;
        let action = 'created';

        const telNorm = normalizarTelefone(contato.telefone);
        const razaoSocial = (contato.empresa || contato.nome || '').trim();

        // 1. Buscar por telefone
        if (telNorm.length >= 8) {
          const encontrados = await base44.asServiceRole.entities.Cliente.filter(
            { telefone: { $regex: telNorm } }, 'razao_social', 3
          ).catch(() => []);
          if (encontrados.length > 0) {
            clienteId = encontrados[0].id;
            action = 'found_by_phone';
          }
        }

        // 2. Buscar por razão social exata
        if (!clienteId && razaoSocial) {
          const encontrados = await base44.asServiceRole.entities.Cliente.filter(
            { razao_social: razaoSocial }, 'razao_social', 1
          ).catch(() => []);
          if (encontrados.length > 0) {
            clienteId = encontrados[0].id;
            action = 'found_by_name';
          }
        }

        // 3. Criar novo Cliente (usuario_id = admin executor como responsável provisório)
        if (!clienteId) {
          const novoCliente = await base44.asServiceRole.entities.Cliente.create({
            razao_social: razaoSocial || contato.nome,
            usuario_id: user.id,
            telefone: contato.telefone || '',
            email: contato.email || '',
            status: 'Ativo',
            segmento: 'PME',
            origem_campanha: { canal_entrada: 'whatsapp' }
          });
          clienteId = novoCliente.id;
          action = 'created';
        }

        // 4. Vincular cliente_id ao Contact
        await base44.asServiceRole.entities.Contact.update(contato.id, { cliente_id: clienteId });

        resultados.push({ id: contato.id, nome: contato.nome, status: 'ok', cliente_id: clienteId, action });
        console.log(`[backfill] ✅ ${contato.nome} → ${clienteId} (${action})`);

      } catch (err) {
        resultados.push({ id: contato.id, nome: contato.nome, status: 'erro', reason: err.message });
        console.error(`[backfill] ❌ ${contato.nome}:`, err.message);
      }
    }

    const ok = resultados.filter(r => r.status === 'ok').length;
    const erros = resultados.filter(r => r.status === 'erro').length;

    return Response.json({
      success: true,
      total_fidelizados: semClienteId.length,
      vinculados: ok,
      erros,
      detalhes: resultados
    });

  } catch (error) {
    console.error('[backfill] ❌ Erro geral:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});