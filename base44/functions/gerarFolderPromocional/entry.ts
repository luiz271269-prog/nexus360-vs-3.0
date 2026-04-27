// Gera folder promocional NeuralTec usando GenerateImage e atualiza Promotion(s)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function formatarData() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function montarPromptFolder(produtos, dataFolder) {
  const linhasProdutos = produtos.slice(0, 6).map((p, i) => {
    const codigo = p.codigo ? ` (cod ${p.codigo})` : '';
    const preco = `R$ ${Number(p.preco_venda || 0).toFixed(2).replace('.', ',')}`;
    return `Card ${i + 1}: "${p.nome}"${codigo} — preço destacado em dourado: ${preco}`;
  }).join('\n');

  return `Crie um folder promocional profissional vertical (formato A4) para a NeuralTec, distribuidora de tecnologia do Grupo Liesch.

ESTILO VISUAL OBRIGATÓRIO:
- Fundo: navy azul-escuro #0d1f3c com textura sutil
- Cor de destaque: dourado #fbbf24 (preços, bordas, badges)
- Tipografia: sans-serif moderna, bold para preços
- Layout: profissional, limpo, alta qualidade gráfica

HEADER (topo):
- Logo "NeuralTec" em dourado grande
- Subtítulo "Distribuidora de Tecnologia · Grupo Liesch" em branco
- Badge no canto superior direito: "🚨 SOMENTE HOJE!" em vermelho com letras brancas

CARDS DE PRODUTOS (centro, grade ${produtos.length <= 3 ? '1 coluna' : '2 colunas'}):
${linhasProdutos}

Cada card deve ter:
- Borda dourada com leve glow
- Nome do produto em branco bold
- Código pequeno em cinza-claro
- Preço grande em dourado #fbbf24
- Fundo do card levemente mais claro que o navy de fundo

RODAPÉ (base):
- "NeuralTec · Grupo Liesch" centralizado
- "Preço por unidade · ${dataFolder}" abaixo
- Linha dourada decorativa

Sem texto em inglês. Tudo em português brasileiro. Visual high-end, premium, focado em conversão de vendas B2B.`;
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