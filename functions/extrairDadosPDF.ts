import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, tipo = 'pdf' } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });

    const apiKey = Deno.env.get('ANTROPIK_API');
    if (!apiKey) throw new Error('ANTROPIK_API não configurada');

    // Fetch do arquivo e converter para base64
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) throw new Error(`Não foi possível baixar o arquivo: ${fileResponse.status}`);

    const buffer = await fileResponse.arrayBuffer();
    const fileSizeMB = buffer.byteLength / (1024 * 1024);
    
    // Limite de 10MB para PDFs (evita timeout)
    if (fileSizeMB > 10) {
      throw new Error(`Arquivo muito grande (${fileSizeMB.toFixed(1)}MB). PDFs acima de 10MB não são suportados. Divida o arquivo em partes menores ou use planilhas.`);
    }
    
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64Data = btoa(binary);

    const promptTexto = `Analise o conteúdo deste arquivo e extraia dados estruturados em formato de tabela.

REGRAS CRÍTICAS:
1. Se for uma IMAGEM (print de tela): Faça OCR, identifique a tabela principal e extraia TODAS as linhas e colunas.
2. Se for um PDF: Extraia a tabela principal do documento.
3. NUNCA retorne um array 'dados_extraidos' vazio. Se não encontrar uma tabela, extraia qualquer informação estruturada que encontrar (ex: chave-valor de um formulário).
4. Se não houver absolutamente nada, retorne um array com um único objeto contendo uma chave 'erro' com a descrição do problema.

RETORNE APENAS JSON VÁLIDO (sem markdown, sem explicações), com esta estrutura EXATA:
{"dados_extraidos":[{"coluna1":"valorA1","coluna2":"valorA2"},{"coluna1":"valorB1","coluna2":"valorB2"}],"confianca_extracao":85,"tipo_conteudo_detectado":"pdf_tabela","observacoes":"Breve descrição do que foi extraído"}`;

    // Content block dinâmico por tipo
    let contentBlock;
    if (tipo === 'pdf') {
      contentBlock = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64Data }
      };
    } else {
      // imagem — detectar media_type pelo header ou assumir jpeg
      const contentTypeHeader = fileResponse.headers?.get('content-type') || '';
      let mediaType = 'image/jpeg';
      if (contentTypeHeader.includes('png')) mediaType = 'image/png';
      else if (contentTypeHeader.includes('webp')) mediaType = 'image/webp';
      else if (contentTypeHeader.includes('gif')) mediaType = 'image/gif';

      contentBlock = {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64Data }
      };
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(tipo === 'pdf' ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {})
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [contentBlock, { type: 'text', text: promptTexto }]
        }]
      })
    });

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text();
      
      // Erro 400/413 = arquivo muito grande
      if (anthropicResponse.status === 400 || anthropicResponse.status === 413) {
        throw new Error(`Arquivo muito grande para processamento. Tente dividir o PDF em partes menores (máx 10MB/20 páginas).`);
      }
      
      throw new Error(`Erro na IA (${anthropicResponse.status}): ${errBody.substring(0, 200)}`);
    }

    const anthropicData = await anthropicResponse.json();
    const rawText = anthropicData.content?.find(b => b.type === 'text')?.text || '{}';

    const cleanJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const result = JSON.parse(cleanJson);

    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error('[extrairDadosPDF] Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});