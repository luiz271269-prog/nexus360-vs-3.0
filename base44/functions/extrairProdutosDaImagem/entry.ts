// Extrai lista de produtos de uma imagem/PDF de cotação usando InvokeLLM multimodal
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_urls, margem } = await req.json();

    if (!file_urls || !Array.isArray(file_urls) || file_urls.length === 0) {
      return Response.json({ error: 'file_urls é obrigatório' }, { status: 400 });
    }

    const margemAplicada = typeof margem === 'number' && margem > 1 ? margem : 1.40;

    const prompt = `Você é o agente de marketing da NeuralTec, distribuidora de tecnologia do Grupo Liesch.

Analise a(s) imagem(ns)/documento(s) anexado(s) e extraia TODOS os produtos com seus respectivos custos.

REGRAS CRÍTICAS:
1. NUNCA altere o nome do produto — copie EXATAMENTE como aparece
2. Mantenha siglas técnicas intactas: VA, USB, SSD, GB, TB, GHz, FHD, NVMe, LGA, DDR4, DDR5, etc.
3. O valor que aparece é SEMPRE o custo do fornecedor (nunca o preço final)
4. Se houver código do produto, capture
5. Categorize cada produto em UMA destas categorias:
   - nobreaks (UPS, no-break, estabilizadores)
   - impressao (impressoras, multifuncionais, toner, cartucho)
   - componentes (placa-mãe, processador, memória RAM, fonte, gabinete)
   - informatica (notebook, desktop, monitor, all-in-one)
   - armazenamento (HD, SSD, pen drive, cartão SD)
   - acessorios (mouse, teclado, headset, webcam, cabos, hub)
6. Extraia especificações técnicas relevantes (capacidade, modelo, voltagem)
7. Se um produto não tem custo claro, não o inclua
8. Se a imagem não tem produtos/cotação, retorne array vazio

Retorne APENAS o JSON estruturado.`;

    const resposta = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls,
      response_json_schema: {
        type: 'object',
        properties: {
          fornecedor_nome: {
            type: 'string',
            description: 'Nome do fornecedor identificado (se visível)'
          },
          produtos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nome: { type: 'string', description: 'Nome exato do produto' },
                codigo: { type: 'string', description: 'Código/SKU se disponível' },
                custo: { type: 'number', description: 'Custo em R$ (apenas número)' },
                especificacoes: { type: 'string', description: 'Specs técnicas resumidas' },
                categoria: {
                  type: 'string',
                  enum: ['nobreaks', 'impressao', 'componentes', 'informatica', 'armazenamento', 'acessorios']
                }
              },
              required: ['nome', 'custo', 'categoria']
            }
          }
        },
        required: ['produtos']
      }
    });

    const produtos = (resposta?.produtos || []).map(p => ({
      ...p,
      custo: Number(p.custo) || 0,
      preco_venda: Math.round((Number(p.custo) || 0) * margemAplicada * 100) / 100
    }));

    return Response.json({
      success: true,
      fornecedor_nome: resposta?.fornecedor_nome || '',
      total_extraidos: produtos.length,
      margem_aplicada: margemAplicada,
      produtos
    });
  } catch (error) {
    console.error('[extrairProdutosDaImagem] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});