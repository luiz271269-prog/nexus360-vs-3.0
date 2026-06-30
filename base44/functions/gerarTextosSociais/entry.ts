import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * GERAR TEXTOS SOCIAIS (IA) — 3 entregáveis a partir de um anúncio pronto
 *
 * A partir dos dados de um produto/promoção (título, descrição, preço, imagem),
 * gera textos prontos para publicar:
 *   - instagram : legenda curta e visual (gancho + bullets + CTA + hashtags)
 *   - facebook  : texto longo e técnico-corporativo
 *   - audio     : roteiro falado (locução), texto corrido para gerar áudio
 *
 * Payload: { titulo, descricao, price_info, validade, imagem_url, tipo_midia, tipo }
 *   - tipo (opcional): 'instagram' | 'facebook' | 'audio'. Se omitido, gera os 3.
 * Retorno: { success, textos: { instagram, facebook, audio } }
 *   (quando 'tipo' é informado, só aquela chave vem preenchida)
 */

const WHATSAPP_NEURALTEC = '(48) 3045-2076';

function montarContexto({ titulo, descricao, price_info, validade }) {
  const limpar = (t) => String(t || '').replace(/\{\{[^}]+\}\}/g, '').trim();
  return [
    `Produto/Oferta: ${limpar(titulo) || '(sem título)'}`,
    limpar(descricao) ? `Descrição: ${limpar(descricao)}` : '',
    price_info ? `Preço/condição: ${price_info}` : '',
    validade ? `Validade: ${new Date(validade).toLocaleDateString('pt-BR')}` : ''
  ].filter(Boolean).join('\n');
}

const REGRA_IDIOMA = 'IDIOMA OBRIGATÓRIO: responda SEMPRE e EXCLUSIVAMENTE em PORTUGUÊS DO BRASIL (pt-BR). Todo o texto deve estar em português brasileiro. NUNCA use inglês ou outro idioma, mesmo que a imagem anexada tenha texto em outra língua.';

function promptInstagram(contexto) {
  return `${REGRA_IDIOMA}

Você é o social media da NeuralTec Distribuição, distribuidora de tecnologia (memórias, switches, periféricos, informática).
Crie uma LEGENDA de INSTAGRAM profissional e atraente para o produto/oferta abaixo.

DADOS DO PRODUTO:
${contexto}

REGRAS:
- Comece com uma frase de impacto (gancho) com 1 emoji.
- 1 ou 2 frases vendedoras destacando benefícios reais.
- Liste as principais características em bullets com emojis (use o que foi fornecido e o visível na imagem; não invente specs).
- Destaque o preço/condição de forma chamativa, se houver.
- Termine com CTA: chamar no WhatsApp ${WHATSAPP_NEURALTEC} ou enviar DM.
- Adicione de 6 a 10 hashtags relevantes ao final, incluindo #NeuralTec.
- Tom: profissional, confiante, brasileiro. Texto puro com emojis e quebras de linha.
- IMPORTANTE: NÃO use markdown. Nada de ** (asteriscos para negrito), nada de #títulos, nada de listas com hífen. Apenas texto que pode ser colado direto no Instagram.
- Tamanho ideal: 60 a 120 palavras.`;
}

function promptFacebook(contexto) {
  return `${REGRA_IDIOMA}

Você é o social media da NeuralTec Distribuição, distribuidora de tecnologia.
Crie um texto de POST para FACEBOOK, mais longo e técnico-corporativo, para o produto/oferta abaixo.

DADOS DO PRODUTO:
${contexto}

REGRAS:
- Abertura instigante (1 emoji) voltada a público empresarial/TI.
- Um parágrafo de contexto explicando para quem o produto serve (servidores, workstations, infraestrutura).
- Uma seção "Especificações técnicas:" com bullets (• ) usando os dados fornecidos.
- Uma linha "Indicado para:" com os cenários de uso.
- Destaque o preço/condição, se houver.
- CTA com WhatsApp ${WHATSAPP_NEURALTEC} e mensagem direta.
- Hashtags ao final (4 a 6), incluindo #NeuralTec.
- Tom: técnico, corporativo, confiável. Emojis com moderação.
- IMPORTANTE: NÃO use markdown. Nada de ** (asteriscos para negrito) nem #títulos. Apenas texto que pode ser colado direto no Facebook (bullets só com o caractere "•").
- Tamanho ideal: 120 a 220 palavras.`;
}

function promptAudio(contexto) {
  return `${REGRA_IDIOMA}

Você é o redator de locução da NeuralTec Distribuição.
Crie um ROTEIRO DE ÁUDIO (locução publicitária curta, para ser FALADO em voz alta) sobre o produto/oferta abaixo.

DADOS DO PRODUTO:
${contexto}

REGRAS:
- Texto CORRIDO para narração, sem bullets, sem emojis, sem hashtags.
- Linguagem natural e falada (como um comercial de rádio de 15 a 25 segundos).
- Escreva números e valores POR EXTENSO quando ajudar a locução (ex: "trezentos e noventa e oito reais e noventa e nove centavos", "oito gigabytes").
- Destaque 1 ou 2 benefícios principais e o preço.
- Termine convidando a entrar em contato e assine "NeuralTec".
- Apenas o texto que será falado, nada de instruções de cena.
- Tamanho ideal: 40 a 70 palavras.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      titulo = '',
      descricao = '',
      price_info = '',
      validade = '',
      imagem_url = '',
      tipo_midia = 'imagem',
      tipo = ''
    } = body;

    const contexto = montarContexto({ titulo, descricao, price_info, validade });
    const fileUrls = imagem_url && tipo_midia !== 'video' ? [imagem_url] : undefined;

    const geradores = {
      instagram: () => promptInstagram(contexto),
      facebook: () => promptFacebook(contexto),
      audio: () => promptAudio(contexto)
    };

    // Áudio é locução (não usa imagem); Instagram/Facebook usam a imagem como contexto.
    const usaImagem = { instagram: true, facebook: true, audio: false };

    const tiposAlvo = ['instagram', 'facebook', 'audio'].includes(tipo)
      ? [tipo]
      : ['instagram', 'facebook', 'audio'];

    const resultados = await Promise.all(
      tiposAlvo.map(async (t) => {
        const out = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: geradores[t](),
          file_urls: usaImagem[t] ? fileUrls : undefined
        });
        const texto = typeof out === 'string' ? out.trim() : String(out || '').trim();
        return [t, texto];
      })
    );

    const textos = {};
    for (const [t, texto] of resultados) textos[t] = texto;

    return Response.json({ success: true, textos });
  } catch (error) {
    console.error('[GERAR TEXTOS SOCIAIS] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});