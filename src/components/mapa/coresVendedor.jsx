// Paleta estável de cores por vendedor (ordem alfabética determina a cor)
const PALETA = [
  '#ea580c', '#2563eb', '#16a34a', '#9333ea', '#db2777',
  '#0891b2', '#ca8a04', '#dc2626', '#4f46e5', '#0d9488',
  '#7c3aed', '#65a30d', '#e11d48', '#0284c7', '#d97706'
];

export function corDoVendedor(nome, listaVendedores) {
  if (!nome) return '#64748b';
  const idx = (listaVendedores || []).indexOf(nome);
  if (idx === -1) return '#64748b';
  return PALETA[idx % PALETA.length];
}