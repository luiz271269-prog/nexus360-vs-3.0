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