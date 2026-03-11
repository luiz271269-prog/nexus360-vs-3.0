import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();
    if (!file_url) {
      return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });
    }

    // Fazer fetch do PDF e converter para base64
    const pdfResponse = await fetch(file_url);
    if (!pdfResponse.ok) {
      throw new Error(`Não foi possível baixar o PDF: ${pdfResponse.status}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const uint8Array = new Uint8Array(pdfBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Pdf = btoa(binary);

    const apiKey = Deno.env.get('ANTROPIK_API');
    if (!apiKey) {
      throw new Error('ANTROPIK_API não configurada');
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf
              }
            },
            {
              type: 'text',
              text: `Analise este PDF e extraia todos os dados estruturados em formato JSON.
Retorne SOMENTE um objeto JSON válido (sem markdown, sem explicações extras) com esta estrutura:
{
  "dados_extraidos": [{"coluna1": "valor1", ...}, ...],
  "confianca_extracao": 85,
  "tipo_conteudo_detectado": "pdf_tabela",
  "observacoes": "descrição do que foi extraído"
}`
            }
          ]
        }]
      })
    });

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text();
      throw new Error(`Anthropic API erro ${anthropicResponse.status}: ${errBody}`);
    }

    const anthropicData = await anthropicResponse.json();
    const textContent = anthropicData.content?.find(b => b.type === 'text')?.text || '{}';
    const cleanJson = textContent.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanJson);

    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error('[extrairDadosPDF] Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});