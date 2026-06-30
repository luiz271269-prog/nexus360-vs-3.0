import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * GERAR LEGENDA PROFISSIONAL PARA INSTAGRAM (IA)
 * Recebe os dados de um produto/promoção (título, descrição, preço, imagem)
 * e devolve uma legenda completa de marketing: apresentação, características
 * em bullets, chamada para ação e hashtags relevantes.
 *
 * Payload: { titulo, descricao, price_info, validade, imagem_url, tipo_midia }
 * Retorno: { success, caption }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      titulo = '',
      descricao = '',
      price_info = '',
      validade = '',
      imagem_url = '',
      tipo_midia = 'imagem'
    } = await req.json();

    const limpar = (t) => String(t || '').replace(/\{\{[^}]+\}\}/g, '').trim();

    const contexto = [
      `Produto/Oferta: ${limpar(titulo) || '(sem título)'}`,
      limpar(descricao) ? `Descrição: ${limpar(descricao)}` : '',
      price_info ? `Preço/condição: ${price_info}` : '',
      validade ? `Validade: ${new Date(validade).toLocaleDateString('pt-BR')}` : ''
    ].filter(Boolean).join('\n');

    const prompt = `Você é o social media da NeuralTec Distribuição, uma distribuidora de tecnologia (memórias, switches, periféricos, informática).
Crie uma LEGENDA profissional e atraente para um post no Instagram apresentando o produto/oferta abaixo.

DADOS DO PRODUTO:
${contexto}

REGRAS DA LEGENDA:
- Comece com uma frase de impacto (gancho) com 1 emoji.
- Faça uma apresentação curta e vendedora do produto (2 a 3 frases), destacando benefícios reais.
- Liste as principais características técnicas em bullets com emojis (use as informações fornecidas e o que for visível na imagem; não invente especificações que não dá pra inferir).
- Se houver preço/condição, destaque-o de forma chamativa.
- Termine com uma chamada para ação clara (chamar no direct ou WhatsApp).
- Adicione de 6 a 10 hashtags relevantes ao final, incluindo #neuraltec.
- Tom: profissional, confiante, brasileiro, sem exageros falsos.
- Não use markdown (nada de ** ou #títulos). Apenas texto puro com emojis e quebras de linha.
- Tamanho ideal: entre 60 e 150 palavras.`;

    const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: imagem_url && tipo_midia !== 'video' ? [imagem_url] : undefined
    });

    const caption = typeof resultado === 'string' ? resultado.trim() : String(resultado || '').trim();

    if (!caption) {
      return Response.json({ success: false, error: 'IA não retornou legenda' }, { status: 500 });
    }

    return Response.json({ success: true, caption });
  } catch (error) {
    console.error('[GERAR LEGENDA INSTAGRAM] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});