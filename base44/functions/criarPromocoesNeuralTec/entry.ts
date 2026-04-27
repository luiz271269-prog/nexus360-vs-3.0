// Cria registros de Promotion a partir de produtos extraídos
// SEGURANÇA: Promotions criadas com ativo:false (rascunho) - usuário ativa manualmente
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CATEGORIA_MAP = {
  nobreaks: 'eletronicos',
  impressao: 'informatica',
  componentes: 'informatica',
  informatica: 'informatica',
  armazenamento: 'informatica',
  acessorios: 'informatica'
};

function formatarPreco(valor) {
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { produtos, validade, fornecedor_nome } = await req.json();

    if (!Array.isArray(produtos) || produtos.length === 0) {
      return Response.json({ error: 'produtos é obrigatório (array)' }, { status: 400 });
    }

    const validadeFinal = validade || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    })();

    const campaign_id = `neuraltec_${Date.now()}`;
    const created = [];
    const errors = [];

    for (const p of produtos) {
      try {
        if (!p.nome || !p.preco_venda) {
          errors.push({ produto: p.nome || 'sem nome', motivo: 'faltam dados' });
          continue;
        }

        const promotion = await base44.asServiceRole.entities.Promotion.create({
          titulo: p.nome,
          descricao: p.especificacoes || p.nome,
          descricao_curta: p.codigo || '',
          price_info: formatarPreco(p.preco_venda),
          categoria: CATEGORIA_MAP[p.categoria] || 'geral',
          ativo: false, // ⚠️ SEGURANÇA: rascunho — usuário ativa pela tela /Promocoes
          tipo_midia: 'image',
          stage: '12h',
          priority: 5,
          formato: 'teaser',
          validade: validadeFinal,
          campaign_id,
          target_sectors: ['vendas', 'geral'],
          target_contact_types: ['lead', 'cliente'],
          target_tags: [],
          cooldown_hours: 6,
          limite_envios_por_contato: 1,
          contador_envios: 0,
          contador_respostas: 0,
          taxa_conversao: 0,
          produtos: [{
            nome: p.nome,
            codigo: p.codigo || '',
            custo: p.custo,
            preco_venda: p.preco_venda,
            categoria_neuraltec: p.categoria
          }]
        });

        created.push({
          id: promotion.id,
          titulo: promotion.titulo,
          preco: promotion.price_info,
          codigo: p.codigo || ''
        });
      } catch (e) {
        errors.push({ produto: p.nome, motivo: e.message });
      }
    }

    return Response.json({
      success: true,
      campaign_id,
      validade: validadeFinal,
      fornecedor_nome: fornecedor_nome || '',
      total_criadas: created.length,
      total_erros: errors.length,
      promotion_ids: created.map(c => c.id),
      promotions: created,
      errors,
      proximo_passo: 'Acesse /Promocoes para revisar, ativar e disparar via "Enviar em Massa"'
    });
  } catch (error) {
    console.error('[criarPromocoesNeuralTec] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});