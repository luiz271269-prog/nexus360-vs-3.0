// Utilitários de vínculo NF → vendedor e previsão de metas
import { getNomeExibicao } from "@/components/lib/vendedorSync";

export const normalizarNome = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

// Vincula NF ao vendedor pelo nome completo; primeiro nome só quando não há colisão
export function notaPertenceAoVendedor(nomeNota, vendedor, todosVendedores) {
  const nNota = normalizarNome(nomeNota);
  const nome = normalizarNome(getNomeExibicao(vendedor) || vendedor.full_name || vendedor.email || '');
  if (!nNota || !nome) return false;
  if (nNota === nome || nNota.includes(nome) || nome.includes(nNota)) return true;
  const primeiro = nome.split(' ')[0];
  const colisao = (todosVendedores || []).filter(v => {
    const n = normalizarNome(getNomeExibicao(v) || v.full_name || v.email || '');
    return n && n.split(' ')[0] === primeiro;
  }).length > 1;
  return !colisao && nNota.split(' ')[0] === primeiro;
}

// Análise dos últimos N meses fechados do vendedor com base nas NFs consolidadas
export function analisarHistoricoVendedor(vendedor, todosVendedores, notasTodas, meses = 3) {
  const hoje = new Date();
  const chavesMeses = [];
  for (let i = 1; i <= meses; i++) {
    chavesMeses.push(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1).toISOString().slice(0, 7));
  }
  const notasVendedor = (notasTodas || []).filter(n => notaPertenceAoVendedor(n.vendedor, vendedor, todosVendedores));

  const porMes = chavesMeses.map(mes =>
    notasVendedor.filter(n => (n.data_emissao || n.created_date || '').slice(0, 7) === mes)
      .reduce((s, n) => s + (n.valor_total || 0), 0)
  );
  const mediaMensal = porMes.reduce((a, b) => a + b, 0) / meses;

  // Clientes recorrentes: compraram em 2+ dos últimos meses analisados
  const clientesPorMes = {};
  notasVendedor.forEach(n => {
    const mes = (n.data_emissao || n.created_date || '').slice(0, 7);
    if (!chavesMeses.includes(mes)) return;
    const chaveCliente = n.cliente_cnpj_cpf || normalizarNome(n.cliente_nome);
    if (!chaveCliente) return;
    if (!clientesPorMes[chaveCliente]) clientesPorMes[chaveCliente] = { meses: new Set(), valor: 0, nome: n.cliente_nome };
    clientesPorMes[chaveCliente].meses.add(mes);
    clientesPorMes[chaveCliente].valor += (n.valor_total || 0);
  });
  const recorrentes = Object.values(clientesPorMes).filter(c => c.meses.size >= 2);
  const receitaRecorrenteMensal = recorrentes.reduce((s, c) => s + c.valor / meses, 0);

  // Meta sugerida: base recorrente + crescimento de 10% sobre a média mensal
  const metaSugerida = Math.round(Math.max(mediaMensal * 1.1, receitaRecorrenteMensal));

  return {
    mediaMensal: Math.round(mediaMensal),
    clientesRecorrentes: recorrentes.length,
    receitaRecorrenteMensal: Math.round(receitaRecorrenteMensal),
    metaSugerida
  };
}

// Projeção de faturamento do mês corrente com base no histórico recorrente de cada cliente da carteira.
// Para cada cliente: frequência de compra (meses com NF / meses analisados) × ticket médio mensal.
export function projetarFaturamentoMensal(notasTodas, meses = 3) {
  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0, 7);
  const chavesMeses = [];
  for (let i = 1; i <= meses; i++) {
    chavesMeses.push(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1).toISOString().slice(0, 7));
  }

  const clientes = {};
  (notasTodas || []).forEach(n => {
    const mes = (n.data_emissao || n.created_date || '').slice(0, 7);
    const chave = n.cliente_cnpj_cpf || normalizarNome(n.cliente_nome);
    if (!chave) return;
    if (!clientes[chave]) clientes[chave] = { nome: n.cliente_nome, vendedor: n.vendedor, mesesHistorico: new Set(), valorHistorico: 0, realizadoMesAtual: 0 };
    if (chavesMeses.includes(mes)) {
      clientes[chave].mesesHistorico.add(mes);
      clientes[chave].valorHistorico += (n.valor_total || 0);
    }
    if (mes === mesAtual) clientes[chave].realizadoMesAtual += (n.valor_total || 0);
  });

  const projecoes = Object.values(clientes)
    .filter(c => c.mesesHistorico.size > 0)
    .map(c => {
      const frequencia = c.mesesHistorico.size / meses;
      const mediaMensalCompra = c.valorHistorico / c.mesesHistorico.size;
      const valorEsperado = Math.round(mediaMensalCompra * frequencia);
      return {
        nome: c.nome,
        vendedor: c.vendedor,
        recorrente: c.mesesHistorico.size >= 2,
        frequencia: Math.round(frequencia * 100),
        valorEsperado,
        realizado: Math.round(c.realizadoMesAtual),
        jaComprou: c.realizadoMesAtual > 0
      };
    })
    .sort((a, b) => b.valorEsperado - a.valorEsperado);

  const projecaoTotal = projecoes.reduce((s, c) => s + c.valorEsperado, 0);
  const realizadoMes = Object.values(clientes).reduce((s, c) => s + c.realizadoMesAtual, 0);

  return {
    mesAtual,
    projecaoTotal: Math.round(projecaoTotal),
    realizadoMes: Math.round(realizadoMes),
    percentualAtingido: projecaoTotal > 0 ? Math.round((realizadoMes / projecaoTotal) * 100) : 0,
    clientesRecorrentes: projecoes.filter(c => c.recorrente).length,
    clientesPendentes: projecoes.filter(c => c.recorrente && !c.jaComprou),
    projecoes
  };
}