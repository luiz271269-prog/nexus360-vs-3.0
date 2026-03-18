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

    const promptTexto = `Você é um especialista em extração de dados de orçamentos e propostas comerciais. Analise este arquivo e extraia TODOS os dados estruturados do orçamento/proposta.

CAMPOS OBRIGATÓRIOS A EXTRAIR (mapeados para os nomes EXATOS abaixo):
- "numero_orcamento" ou "PROPOSTA Nº:" → número da proposta
- "cliente_nome" ou "CLIENTE:" → nome completo da empresa cliente (busque em "Cliente:", "CLIENTE:", ou linha do cliente; IGNORE completamente logos/marcas visuais)
- "cliente_telefone" ou "cliente_celular" → telefone do cliente
- "cliente_email" → email do cliente
- "data_orcamento" → data de emissão (formato: YYYY-MM-DD)
- "data_vencimento" → data de validade (formato: YYYY-MM-DD)
- "valor_total" → valor total da proposta
- Itens: descrição, quantidade, valor unitário, valor total

REGRAS CRÍTICAS:
1. NUNCA confunda "cliente_nome" com logos/marcas de empresas emissoras (ex: NeuralTech).
2. O cliente é SEMPRE a empresa que está RECEBENDO a proposta (procure por "Cliente:", "Para:", "Empresa:").
3. Use nomes TEXTUAIS completos extraídos do documento (ex: "PAMPLONA ALIMENTOS S/A").
4. Se houver CNPJ junto ao cliente, inclua também no campo "cliente_nome" se aparecerem juntos.
5. Retorne um ÚNICO objeto com todos os dados do orçamento.

RETORNE APENAS JSON VÁLIDO (sem markdown):
{"dados_extraidos":[{"numero_orcamento":"88534","cliente_nome":"PAMPLONA ALIMENTOS S/A","cliente_telefone":"+5548...","cliente_email":"...","data_orcamento":"2026-01-21","data_vencimento":"2026-01-26","valor_total":845.00,"itens":[{"descricao":"...","quantidade":5,"valor_unitario":169.00,"valor_total":845.00}]}],"confianca_extracao":90,"tipo_conteudo_detectado":"orcamento","observacoes":"Orçamento extraído com sucesso"}`;

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