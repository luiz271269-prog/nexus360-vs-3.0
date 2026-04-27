// Gera folder promocional NeuralTec usando GenerateImage e atualiza Promotion(s)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function formatarData() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function inferirCategoriaTitulo(produtos) {
  const nomes = produtos.map(p => (p.nome || '').toLowerCase()).join(' ');
  if (nomes.includes('ssd') && nomes.includes('nvme')) return { titulo: 'SSD M.2 NVMe', subtitulo: 'Alta Performance · Armazenamento Profissional' };
  if (nomes.includes('ssd')) return { titulo: 'SSDs', subtitulo: 'Velocidade · Confiabilidade · Performance' };
  if (nomes.includes('nobreak') || nomes.includes('ups')) return { titulo: 'Nobreaks', subtitulo: 'Proteção · Autonomia · Estabilidade' };
  if (nomes.includes('impressora') || nomes.includes('toner')) return { titulo: 'Impressão', subtitulo: 'Qualidade · Produtividade · Economia' };
  if (nomes.includes('memória') || nomes.includes('memoria') || nomes.includes('ddr')) return { titulo: 'Memórias RAM', subtitulo: 'Performance · Compatibilidade Garantida' };
  if (nomes.includes('processador') || nomes.includes('cpu')) return { titulo: 'Processadores', subtitulo: 'Potência · Última Geração' };
  if (nomes.includes('notebook')) return { titulo: 'Notebooks', subtitulo: 'Mobilidade · Performance Profissional' };
  if (nomes.includes('monitor')) return { titulo: 'Monitores', subtitulo: 'Imagem Premium · Alta Resolução' };
  return { titulo: 'Ofertas Tech', subtitulo: 'Tecnologia · Performance · Confiança' };
}

function montarPromptFolder(produtos, dataFolder) {
  const totalProdutos = produtos.length;
  const colunas = totalProdutos <= 2 ? 1 : (totalProdutos <= 4 ? 2 : 3);
  const { titulo: tituloCategoria, subtitulo } = inferirCategoriaTitulo(produtos);

  const linhasProdutos = produtos.slice(0, 6).map((p, i) => {
    const preco = `R$ ${Number(p.preco_venda || 0).toFixed(2).replace('.', ',')}`;
    const specs = (p.especificacoes || p.codigo || '').slice(0, 30);
    return `Card ${i + 1}: nome "${p.nome}" em branco bold no topo · badge cinza pílula com texto "${specs || 'Premium'}" abaixo do nome · preço gigante "${preco}" em dourado #fbbf24 na parte inferior do card`;
  }).join('\n');

  return `Crie um folder promocional vertical PROFISSIONAL para a NeuralTec, distribuidora de tecnologia do Grupo Liesch. Replique EXATAMENTE este estilo visual de referência:

═══ PALETA DE CORES OBRIGATÓRIA ═══
- Fundo principal: navy quase-preto #0a1628 (muito escuro, sólido, sem textura)
- Dourado primário: #d4a843 (logo, título, preços, bordas dos cards)
- Vermelho do badge: #e63946 (somente o badge "SOMENTE HOJE")
- Branco puro #ffffff: nomes de produtos e subtítulos
- Cinza claro #9ca3af: badges de specs em pílulas

═══ HEADER (topo) ═══
- Lado esquerdo: ícone de chip/processador estilizado em dourado #d4a843 (pequeno, geométrico, com pinos), seguido do texto "NeuralTec" em fonte sans-serif bold ENORME em dourado #d4a843
- Logo abaixo: "Distribudura de Tecnologia · Grupo Liesch" em branco pequeno
- Canto superior DIREITO: badge vermelho arredondado #e63946 com ícone de ampulheta ⏳ + texto "SOMENTE HOJE!" em branco bold

═══ TÍTULO DA CATEGORIA (logo abaixo do header) ═══
- Texto GIGANTE em branco bold: "${tituloCategoria}"
- Linha decorativa dourada #d4a843 abaixo do título (apenas embaixo da metade esquerda do texto)
- Subtítulo abaixo em branco médio: "${subtitulo}"

═══ GRADE DE PRODUTOS (centro, ${colunas} coluna${colunas > 1 ? 's' : ''}) ═══
${linhasProdutos}

Cada card deve ter EXATAMENTE este estilo:
- Fundo do card: navy levemente mais claro #0f1d35
- Borda fina dourada #d4a843 com cantos bem arredondados (rounded-2xl)
- Glow dourado sutil ao redor da borda
- Nome do produto: branco bold no topo do card
- Badge de spec: pílula cinza-escuro com texto branco pequeno (ex: "M.2 NVMe", "M.2 2230")
- Preço: ENORME em dourado #d4a843, formato "R$ 1.234,56" com vírgula

═══ RODAPÉ ═══
- Centralizado: "NeuralTec · Grupo Liesch" em dourado #d4a843
- Separador vertical dourado fino
- Ao lado: "Preço por unidade · ${dataFolder}" em branco

Linhas decorativas finas douradas no topo e na base do folder.

REGRAS ABSOLUTAS:
- Tudo em português brasileiro
- Visual premium B2B, sem clipart, sem fotos de produtos reais
- Layout limpo, espaçoso, profissional
- NÃO incluir nenhum logo de fabricante (Kingston, etc.) — apenas texto
- Aspect ratio: vertical 4:5`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { promotion_ids, produtos: produtosDireto, salvar_em_promotions } = await req.json();

    let produtos = [];
    let promotionsParaAtualizar = [];

    if (Array.isArray(promotion_ids) && promotion_ids.length > 0) {
      const promos = await Promise.all(
        promotion_ids.map(id =>
          base44.asServiceRole.entities.Promotion.filter({ id }).then(r => r[0]).catch(() => null)
        )
      );
      promotionsParaAtualizar = promos.filter(Boolean);
      produtos = promotionsParaAtualizar.map(p => {
        const prodMeta = (p.produtos && p.produtos[0]) || {};
        return {
          nome: p.titulo,
          codigo: prodMeta.codigo || p.descricao_curta || '',
          preco_venda: prodMeta.preco_venda || parseFloat(String(p.price_info || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0
        };
      });
    } else if (Array.isArray(produtosDireto) && produtosDireto.length > 0) {
      produtos = produtosDireto;
    } else {
      return Response.json({ error: 'Forneça promotion_ids ou produtos' }, { status: 400 });
    }

    if (produtos.length === 0) {
      return Response.json({ error: 'Nenhum produto válido encontrado' }, { status: 400 });
    }

    const dataFolder = formatarData();
    const prompt = montarPromptFolder(produtos, dataFolder);

    console.log('[gerarFolderPromocional] Gerando imagem para', produtos.length, 'produtos');

    const imgResp = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
    const folderUrl = imgResp?.url || imgResp?.data?.url || imgResp;

    if (!folderUrl || typeof folderUrl !== 'string') {
      return Response.json({
        success: false,
        error: 'GenerateImage não retornou URL válida'
      }, { status: 500 });
    }

    // Atualizar imagem_url das Promotions associadas (se solicitado)
    let promotionsAtualizadas = 0;
    if (salvar_em_promotions !== false && promotionsParaAtualizar.length > 0) {
      for (const p of promotionsParaAtualizar) {
        try {
          await base44.asServiceRole.entities.Promotion.update(p.id, {
            imagem_url: folderUrl
          });
          promotionsAtualizadas++;
        } catch (e) {
          console.warn('[gerarFolderPromocional] Erro update promo', p.id, e.message);
        }
      }
    }

    return Response.json({
      success: true,
      folder_url: folderUrl,
      total_produtos: produtos.length,
      promotion_ids: promotionsParaAtualizar.map(p => p.id),
      promotions_atualizadas: promotionsAtualizadas,
      data: dataFolder
    });
  } catch (error) {
    console.error('[gerarFolderPromocional] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});