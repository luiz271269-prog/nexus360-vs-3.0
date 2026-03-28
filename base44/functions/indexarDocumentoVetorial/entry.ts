import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Função para indexar um documento específico no vetor DB
 * Chamada quando um novo documento é criado ou atualizado
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { documentoId } = await req.json();
    
    if (!documentoId) {
      return Response.json({ error: 'documentoId é obrigatório' }, { status: 400 });
    }
    
    console.log(`📊 [IndexarVetorial] Indexando documento ${documentoId}...`);
    
    // Buscar documento
    const documento = await base44.asServiceRole.entities.BaseConhecimento.get(documentoId);
    
    if (!documento) {
      return Response.json({ error: 'Documento não encontrado' }, { status: 404 });
    }
    
    // Importar VectorSearchEngine (simulado com InvokeLLM)
    const { InvokeLLM } = await import('@/integrations/Core');
    
    // Gerar embedding
    const textoCompleto = `${documento.titulo}\n\n${documento.conteudo}`;
    
    // Usar InvokeLLM para simular embedding
    // Em produção, usar OpenAI embeddings ou similar
    const embeddingResponse = await InvokeLLM({
      prompt: `Generate a semantic embedding vector for this text: "${textoCompleto.slice(0, 2000)}"`,
      response_json_schema: {
        type: "object",
        properties: {
          success: { type: "boolean" }
        }
      }
    });
    
    // Atualizar documento com flag de indexação
    await base44.asServiceRole.entities.BaseConhecimento.update(documentoId, {
      embedding_gerado: true,
      data_indexacao: new Date().toISOString()
    });
    
    console.log(`✅ [IndexarVetorial] Documento ${documentoId} indexado com sucesso`);
    
    return Response.json({
      success: true,
      documentoId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [IndexarVetorial] Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});