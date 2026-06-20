import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * lembreteMetasVencimento — verifica vendedores com meta mensal próxima do
 * vencimento (fim do mês) que ainda não bateram o valor, e envia um lembrete
 * via push (Web Push / VAPID) para cada um.
 *
 * Regra: a meta mensal vence no último dia do mês. Quando faltam DIAS_AVISO
 * dias ou menos para o fim do mês e o vendedor ainda não atingiu a meta_mensal,
 * dispara o push. Anti-spam: 1 lembrete por vendedor por dia.
 *
 * Pode ser chamado pela automação agendada (sem payload) ou manualmente.
 * Payload opcional:
 *   dias_aviso: number (default 5) — janela de antecedência
 *   force: boolean — ignora o guard de 1x/dia (para teste)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const DIAS_AVISO = Number(body?.dias_aviso) || 5;
    const force = body?.force === true;

    // Data atual em America/Sao_Paulo
    const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const ano = agora.getFullYear();
    const mes = agora.getMonth(); // 0-11
    const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
    const diaAtual = agora.getDate();
    const diasRestantes = ultimoDiaMes - diaAtual;

    // Só atua dentro da janela de antecedência
    if (diasRestantes > DIAS_AVISO) {
      return Response.json({ success: true, skipped: 'fora_da_janela', dias_restantes: diasRestantes });
    }

    const mesReferencia = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    const hojeISO = agora.toISOString().slice(0, 10);

    // Vendedores ativos com meta mensal definida
    const vendedores = await base44.asServiceRole.entities.Vendedor.filter({ status: 'ativo' });
    const comMeta = vendedores.filter(v => Number(v.meta_mensal) > 0 && v.usuario_id);

    if (comMeta.length === 0) {
      return Response.json({ success: true, total: 0, enviados: 0, reason: 'nenhum_vendedor_com_meta' });
    }

    // Faturamento do mês por vendedor (status efetivo: Faturado/Entregue)
    const vendasMes = await base44.asServiceRole.entities.Venda.filter({ mes_referencia: mesReferencia });
    const faturamentoPorVendedor = {};
    for (const venda of vendasMes) {
      if (['Cancelado', 'Pendente'].includes(venda.status)) continue;
      const nome = (venda.vendedor || '').trim();
      if (!nome) continue;
      faturamentoPorVendedor[nome] = (faturamentoPorVendedor[nome] || 0) + (Number(venda.valor_total) || 0);
    }

    const usuarios = await base44.asServiceRole.entities.User.list();
    const usuarioPorId = {};
    for (const u of usuarios) usuarioPorId[u.id] = u;

    let enviados = 0;
    const resultados = [];

    for (const v of comMeta) {
      const usuario = usuarioPorId[v.usuario_id];
      const nomeVendedor = usuario?.full_name || '';
      const realizado = faturamentoPorVendedor[nomeVendedor] || 0;
      const meta = Number(v.meta_mensal);
      const percentual = meta > 0 ? Math.round((realizado / meta) * 100) : 0;

      // Já bateu a meta → não lembra
      if (realizado >= meta) {
        resultados.push({ vendedor: nomeVendedor, status: 'meta_atingida', percentual });
        continue;
      }

      // Anti-spam: 1 lembrete por dia
      const ultimoEnvio = v.metricas_performance?.ultimo_lembrete_meta_em || null;
      if (!force && ultimoEnvio && String(ultimoEnvio).slice(0, 10) === hojeISO) {
        resultados.push({ vendedor: nomeVendedor, status: 'ja_lembrado_hoje', percentual });
        continue;
      }

      const falta = meta - realizado;
      const faltaFmt = falta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const diasTxt = diasRestantes === 0 ? 'hoje (último dia!)' : `em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`;

      const pushResp = await base44.asServiceRole.functions.invoke('enviarWakeUpPush', {
        target_user_id: v.usuario_id,
        tipo: 'message',
        title: '🎯 Meta mensal perto do prazo',
        body: `Você está em ${percentual}% da meta. Faltam ${faltaFmt} e a meta vence ${diasTxt}.`,
        action_url: '/Vendedores'
      });

      const sent = pushResp.data?.sent || 0;
      if (sent > 0) enviados++;

      // Marca o último lembrete (preserva métricas existentes)
      await base44.asServiceRole.entities.Vendedor.update(v.id, {
        metricas_performance: {
          ...(v.metricas_performance || {}),
          ultimo_lembrete_meta_em: agora.toISOString()
        }
      });

      resultados.push({ vendedor: nomeVendedor, status: sent > 0 ? 'enviado' : 'sem_device', percentual, falta });
    }

    return Response.json({
      success: true,
      mes_referencia: mesReferencia,
      dias_restantes: diasRestantes,
      total_vendedores: comMeta.length,
      enviados,
      resultados
    });
  } catch (error) {
    console.error('[lembreteMetasVencimento] ❌ Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});