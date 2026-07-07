// Colunas reutilizáveis para o drill-down (DetalhesModal) das abas do Dashboard
const fmtData = (v) => v ? new Date(String(v).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
const fmtMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR')}`;

export const COLS_NF = [
  { campo: 'numero', titulo: 'NF' },
  { campo: 'cliente', titulo: 'Cliente' },
  { campo: 'vendedor', titulo: 'Vendedor' },
  { campo: 'data_emissao', titulo: 'Emissão', formato: fmtData },
  { campo: 'valor_total', titulo: 'Valor', formato: fmtMoeda },
  { campo: 'status', titulo: 'Status' }
];

export const COLS_ORCAMENTO = [
  { campo: 'numero_orcamento', titulo: 'Número' },
  { campo: 'cliente_nome', titulo: 'Cliente' },
  { campo: 'vendedor', titulo: 'Vendedor' },
  { campo: 'data_orcamento', titulo: 'Data', formato: fmtData },
  { campo: 'status', titulo: 'Status' },
  { campo: 'valor_total', titulo: 'Valor', formato: fmtMoeda }
];

export const COLS_CLIENTE = [
  { campo: 'razao_social', titulo: 'Razão Social' },
  { campo: 'nome_fantasia', titulo: 'Nome Fantasia' },
  { campo: 'segmento', titulo: 'Segmento' },
  { campo: 'status', titulo: 'Status' },
  { campo: 'cidade', titulo: 'Cidade' }
];

export const COLS_CLIENTE_RECEITA = [
  { campo: 'razao_social', titulo: 'Razão Social' },
  { campo: 'segmento', titulo: 'Segmento' },
  { campo: 'status', titulo: 'Status' },
  { campo: 'receita_real', titulo: 'Receita (NFs)', formato: fmtMoeda }
];

export const COLS_VENDEDOR = [
  { campo: 'nome', titulo: 'Vendedor' },
  { campo: 'faturamento', titulo: 'Faturamento', formato: fmtMoeda },
  { campo: 'quantidadeVendas', titulo: 'Vendas' },
  { campo: 'quantidadeOrcamentos', titulo: 'Orçamentos' },
  { campo: 'taxaConversao', titulo: 'Conversão', formato: (v) => `${v || 0}%` },
  { campo: 'percentualMeta', titulo: 'Meta', formato: (v) => `${v || 0}%` }
];

export const COLS_THREAD = [
  { campo: 'last_message_sender_name', titulo: 'Contato/Remetente' },
  { campo: 'last_message_content', titulo: 'Última Mensagem' },
  { campo: 'channel', titulo: 'Canal' },
  { campo: 'last_message_at', titulo: 'Data', formato: fmtData },
  { campo: 'status', titulo: 'Status' }
];

export const COLS_VENDEDOR_ENT = [
  { campo: 'nome', titulo: 'Vendedor' },
  { campo: 'codigo', titulo: 'Código' },
  { campo: 'meta_mensal', titulo: 'Meta Mensal', formato: fmtMoeda },
  { campo: 'status', titulo: 'Status' }
];

export const COLS_INTERACAO = [
  { campo: 'cliente_nome', titulo: 'Cliente' },
  { campo: 'tipo_interacao', titulo: 'Tipo' },
  { campo: 'vendedor', titulo: 'Vendedor' },
  { campo: 'data_interacao', titulo: 'Data', formato: fmtData },
  { campo: 'resultado', titulo: 'Resultado' }
];