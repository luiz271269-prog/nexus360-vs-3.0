// Deriva tipo do item e marca a partir do nome do produto do fornecedor.
// O site do fornecedor mantém todas as categorias vazias (produtos só em /produtos/),
// por isso a classificação é feita por palavras-chave no nome.

const TIPOS = [
  ["Eletrodomésticos", ["lavadora", "geladeira", "fogão", "micro-ondas", "microondas", "tanquinho", "air fryer", "airfryer", "liquidificador", "batedeira", "cafeteira", "aspirador", "ventilador", "purificador", "climatizador", "forno"]],
  ["Informática", ["notebook", "impressora", "monitor", "teclado", "mouse", "ssd", "memória ram", "memoria ram", "hd ", "pendrive", "roteador", "webcam", "computador", "processador", "gabinete"]],
  ["Áudio e Vídeo", ["fone", "caixa de som", "soundbar", "gravador de voz", "microfone", "tv ", "projetor", "smart tv"]],
  ["Celulares e Acessórios", ["celular", "smartphone", "carregador", "cabo usb", "capinha", "power bank", "smartwatch", "relógio inteligente"]],
  ["Ferramentas", ["parafusadeira", "furadeira", "serra", "esmerilhadeira", "chave de", "alicate", "trena", "compressor", "solda", "martelo"]],
  ["Moda e Calçados", ["jaqueta", "camiseta", "camisa", "calça", "tênis", "sapato", "chinelo", "bolsa", "mochila", "boné", "vestido"]],
  ["Casa e Cozinha", ["panela", "jogo de", "cama", "mesa", "banho", "toalha", "organizador", "cadeira", "colchão", "utensílio"]],
  ["Automotivo", ["pneu", "capacete", "automotiv", "óleo", "bateria automotiva", "farol", "som automotivo"]],
  ["Esporte e Lazer", ["bicicleta", "halter", "esteira", "bola", "patinete", "skate", "piscina"]],
  ["Bebê e Infantil", ["bebê", "bebe", "infantil", "carrinho de", "fralda", "brinquedo"]],
  ["Saúde e Beleza", ["massageador", "barbeador", "secador", "escova", "balança", "termômetro", "aparador"]],
];

const MARCAS = [
  "Kärcher", "Karcher", "Colormaq", "Soundcore", "Anker", "Tomate", "Multilaser", "Philco", "Mondial",
  "Electrolux", "Brastemp", "Consul", "Britânia", "Britania", "Samsung", "LG", "Motorola", "Xiaomi",
  "Apple", "JBL", "Intelbras", "Positivo", "Lenovo", "Dell", "Acer", "Asus", "HP", "Epson", "Kingston",
  "Intel", "AMD", "Bosch", "Makita", "Vonder", "Tramontina", "Nike", "Adidas", "Puma", "Olympikus",
  "Mizuno", "Fila", "Havaianas", "Nintendo", "Sony", "Baseus", "Elgin", "Cadence", "Wap", "Lorenzetti",
];

export function derivarTipo(nome) {
  const n = (nome || "").toLowerCase();
  for (const [tipo, chaves] of TIPOS) {
    if (chaves.some((k) => n.includes(k))) return tipo;
  }
  return "Outros";
}

export function derivarMarca(nome) {
  const n = (nome || "").toLowerCase();
  const achada = MARCAS.find((m) => n.includes(m.toLowerCase()));
  return achada || "Sem marca";
}

export function classificarProdutos(produtos) {
  return produtos.map((p) => ({
    ...p,
    tipo_item: derivarTipo(p.nome),
    marca: derivarMarca(p.nome),
  }));
}

export function contarPor(produtos, campo) {
  const map = new Map();
  produtos.forEach((p) => map.set(p[campo], (map.get(p[campo]) || 0) + 1));
  return Array.from(map.entries())
    .map(([valor, total]) => ({ valor, total }))
    .sort((a, b) => b.total - a.total);
}