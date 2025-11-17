/**
 * ENDPOINT DE TESTE SUPER SIMPLES
 * Use para verificar se as functions estão funcionando
 */

Deno.serve((req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Resposta simples
  const response = {
    success: true,
    message: 'Teste OK! As functions estão funcionando.',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  };

  return new Response(
    JSON.stringify(response, null, 2),
    { status: 200, headers }
  );
});