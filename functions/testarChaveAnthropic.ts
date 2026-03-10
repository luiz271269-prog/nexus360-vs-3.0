import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obter a chave de API (tenta nomes variados)
    const apiKey = Deno.env.get('antropik.api') || 
                   Deno.env.get('ANTROPIK_API') || 
                   Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      return Response.json({ 
        success: false, 
        error: 'Chave de API não configurada. Secrets disponíveis: ' + Object.keys(Deno.env.toObject()).filter(k => k.includes('api') || k.includes('KEY')).join(', ')
      }, { status: 400 });
    }

    // Testar a chave fazendo uma chamada simples à API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'teste' }
        ]
      })
    });

    const data = await response.json();

    if (response.ok) {
      return Response.json({
        success: true,
        message: 'Chave de API válida e funcionando!',
        status: response.status,
        model_used: 'claude-3-5-haiku-20241022'
      });
    } else {
      return Response.json({
        success: false,
        error: data.error?.message || 'Erro na validação da chave',
        status: response.status,
        details: data.error
      });
    }

  } catch (error) {
    console.error('[TESTAR-CHAVE] Erro:', error.message);
    return Response.json({
      success: false,
      error: 'Erro ao testar chave: ' + error.message
    }, { status: 500 });
  }
});