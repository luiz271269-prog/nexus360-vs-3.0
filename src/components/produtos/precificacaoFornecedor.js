export const CHAVE_PRECIFICACAO = 'precificacao_fornecedores';

export const LOJAS_FORNECEDOR = [
  { id: 'matriz', nome: 'Matriz (Palhoça)', moeda: 'BRL' },
  { id: 'tubarao', nome: 'Tubarão', moeda: 'BRL' },
  { id: 'garopaba', nome: 'Garopaba', moeda: 'BRL' },
  { id: 'criciuma', nome: 'Criciúma', moeda: 'BRL' },
  { id: 'visaovip', nome: 'Visão VIP (PY)', moeda: 'USD' },
];

export const CONFIG_PADRAO = { dolar: 5.22, frete: 0, margem: 1.5 };

export function configDaLoja(configs, lojaId) {
  return { ...CONFIG_PADRAO, ...(configs?.[lojaId] || {}) };
}

/** Custo do produto convertido para real (dólar aplicado quando a loja vende em USD) */
export function custoEmReais(produto, cfg) {
  const base = produto.preco_fornecedor || 0;
  return produto.moeda === 'USD' ? base * (cfg.dolar || 0) : base;
}

/** Preço de venda: (custo em R$ + frete) × margem */
export function precoDeVenda(produto, cfg) {
  const custo = custoEmReais(produto, cfg);
  return (custo + (cfg.frete || 0)) * (1 + (cfg.margem || 0) / 100);
}