import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Função para reindexar toda a Base de Conhecimento
 * Útil para manutenção e atualização de embeddings
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
    }
    
    console.log("🔄 [ReindexRAG] Iniciando reindexação...");
    
    const timestampInicio = Date.now();
    
    // Buscar todos os documentos ativos
    const documentos = await base44.asServiceRole.entities.BaseConhecimento.filter({
      ativo: true
    });
    
    console.log(`📚 [ReindexRAG] Encontrados ${documentos.length} documentos`);
    
    let sucessos = 0;
    let erros = 0;
    const resultados = [];
    
    for (const doc of documentos) {
      try {
        // Extrair palavras-chave
        const palavrasChave = extrairPalavrasChave(doc.conteudo);
        
        // Atualizar documento
        await base44.asServiceRole.entities.BaseConhecimento.update(doc.id, {
          palavras_chave: palavrasChave,
          data_indexacao: new Date().toISOString()
        });
        
        sucessos++;
        resultados.push({
          id: doc.id,
          titulo: doc.titulo,
          status: 'sucesso',
          palavras_chave_extraidas: palavrasChave.length
        });
        
      } catch (error) {
        erros++;
        resultados.push({
          id: doc.id,
          titulo: doc.titulo,
          status: 'erro',
          erro: error.message
        });
        console.error(`❌ [ReindexRAG] Erro ao processar ${doc.titulo}:`, error);
      }
    }
    
    const tempoTotal = ((Date.now() - timestampInicio) / 1000).toFixed(2);
    
    console.log(`✅ [ReindexRAG] Concluído em ${tempoTotal}s: ${sucessos} sucessos, ${erros} erros`);
    
    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      total_documentos: documentos.length,
      sucessos,
      erros,
      tempo_segundos: parseFloat(tempoTotal),
      resultados
    });
    
  } catch (error) {
    console.error("❌ [ReindexRAG] Erro:", error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

/**
 * Extrai palavras-chave de um texto (versão síncrona para performance)
 */
function extrairPalavrasChave(texto) {
  // Implementação básica sem IA para performance
  const palavras = texto
    .toLowerCase()
    .replace(/[^\w\sáéíóúâêôãõç]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 4);
  
  // Contar frequência
  const frequencia = {};
  palavras.forEach(p => {
    frequencia[p] = (frequencia[p] || 0) + 1;
  });
  
  // Pegar as 10 mais frequentes
  return Object.entries(frequencia)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([palavra]) => palavra);
}