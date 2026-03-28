import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GOOGLE SHEETS SERVICE - VERSÃO 3.0 OTIMIZADA              ║
 * ║  ✅ Token Caching Automático (Performance)                  ║
 * ║  ✅ DRY - Código Centralizado (Manutenibilidade)            ║
 * ║  ✅ JWT Seguro e Completo (Robustez)                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * INSTRUÇÕES DE CONFIGURAÇÃO:
 * 
 * 1. Criar conta de serviço no Google Cloud:
 *    - Acesse console.cloud.google.com
 *    - Crie ou selecione projeto
 *    - Habilite "Google Sheets API"
 *    - APIs e serviços > Credenciais > Criar credenciais > Conta de serviço
 *    - Baixe a chave JSON
 * 
 * 2. Configurar Secret no Base44:
 *    - Nome: GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY
 *    - Valor: Cole TODO o conteúdo do arquivo JSON baixado
 * 
 * 3. Compartilhar planilhas:
 *    - Abra a planilha no Google Sheets
 *    - Clique em "Compartilhar"
 *    - Cole o e-mail da conta de serviço (está no JSON: "client_email")
 *    - Dê permissão de "Editor"
 */

// ═══════════════════════════════════════════════════════════════
// CACHE GLOBAL DO ACCESS TOKEN (AUTOMAÇÃO)
// ═══════════════════════════════════════════════════════════════
let cachedAccessToken = null;
let tokenExpiry = 0; // UNIX timestamp em segundos

/**
 * Obtém access token do Google usando JWT
 * ✅ CACHE AUTOMÁTICO - Reutiliza token até 60s antes de expirar
 */
async function getGoogleAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);

  // 1. VERIFICAR CACHE
  if (cachedAccessToken && tokenExpiry > now + 60) {
    console.log('[TokenCache] ✅ Reutilizando token em cache');
    return cachedAccessToken;
  }

  console.log('[TokenCache] ♻️ Gerando novo token...');

  // 2. CRIAR JWT HEADER
  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT'
  };

  // 3. CRIAR JWT CLAIM SET
  const jwtClaimSet = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, // Expira em 1 hora
    iat: now
  };

  // 4. CODIFICAR HEADER E PAYLOAD
  const base64UrlEncode = (obj) => {
    const str = JSON.stringify(obj);
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const encodedHeader = base64UrlEncode(jwtHeader);
  const encodedPayload = base64UrlEncode(jwtClaimSet);
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // 5. IMPORTAR CHAVE PRIVADA
  const pemKey = credentials.private_key.replace(/\\n/g, '\n');
  const pemContents = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  // 6. ASSINAR JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${signatureInput}.${encodedSignature}`;

  // 7. TROCAR JWT POR ACCESS TOKEN
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Erro ao obter access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();

  // 8. ARMAZENAR NO CACHE
  cachedAccessToken = tokenData.access_token;
  tokenExpiry = now + tokenData.expires_in;

  console.log(`[TokenCache] ✅ Novo token obtido. Expira em ${tokenData.expires_in}s`);
  
  return cachedAccessToken;
}

/**
 * Função utilitária centralizada para requisições à API Google Sheets
 * ✅ DRY - Evita duplicação de código
 * ✅ AUTOMAÇÃO - Injeta token automaticamente
 */
async function _executeSheetsApi(accessToken, spreadsheetId, endpoint, options = {}) {
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const url = `${baseUrl}/${endpoint}`;

  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  console.log(`[SheetsAPI] 📤 ${options.method || 'GET'} ${endpoint}`);

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails;
    try {
      errorDetails = JSON.parse(errorText);
    } catch {
      errorDetails = { message: errorText };
    }
    
    console.error('[SheetsAPI] ❌ Erro:', errorDetails);
    throw new Error(
      `Google Sheets API Error [${response.status}]: ${errorDetails.error?.message || errorDetails.message || 'Erro desconhecido'}`
    );
  }

  const data = await response.json();
  console.log('[SheetsAPI] ✅ Sucesso');
  return data;
}

/**
 * Lê dados da planilha
 * ✅ LIMPO - Usa função utilitária
 */
async function readSheet(accessToken, spreadsheetId, range) {
  const endpoint = `values/${encodeURIComponent(range)}`;
  const data = await _executeSheetsApi(accessToken, spreadsheetId, endpoint, {
    method: 'GET'
  });
  
  return {
    valores: data.values || [],
    linhas_encontradas: data.values?.length || 0
  };
}

/**
 * Escreve dados na planilha (sobrescreve)
 * ✅ LIMPO - Usa função utilitária
 */
async function writeSheet(accessToken, spreadsheetId, range, values) {
  const endpoint = `values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const data = await _executeSheetsApi(accessToken, spreadsheetId, endpoint, {
    method: 'PUT',
    body: JSON.stringify({ values })
  });
  
  return {
    celulas_atualizadas: data.updatedCells,
    linhas_atualizadas: data.updatedRows
  };
}

/**
 * Adiciona dados no final da planilha
 * ✅ LIMPO - Usa função utilitária
 */
async function appendSheet(accessToken, spreadsheetId, range, values) {
  const endpoint = `values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const data = await _executeSheetsApi(accessToken, spreadsheetId, endpoint, {
    method: 'POST',
    body: JSON.stringify({ values })
  });
  
  return {
    celulas_adicionadas: data.updates.updatedCells,
    linhas_adicionadas: data.updates.updatedRows
  };
}

/**
 * Limpa dados da planilha
 * ✅ LIMPO - Usa função utilitária
 */
async function clearSheet(accessToken, spreadsheetId, range) {
  const endpoint = `values/${encodeURIComponent(range)}:clear`;
  await _executeSheetsApi(accessToken, spreadsheetId, endpoint, {
    method: 'POST'
  });
  
  return { mensagem: 'Planilha limpa com sucesso' };
}

/**
 * Testa conexão com a planilha
 * ✅ LIMPO - Usa função utilitária
 */
async function testConnection(accessToken, spreadsheetId, range) {
  try {
    const resultado = await readSheet(accessToken, spreadsheetId, range);
    return {
      sucesso: true,
      mensagem: 'Conexão bem-sucedida',
      linhas_encontradas: resultado.linhas_encontradas
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Autenticação do usuário
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obter credenciais do Secret
    const serviceAccountKey = Deno.env.get('GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) {
      return Response.json({ 
        error: 'Credenciais não configuradas',
        detalhes: 'Configure o Secret GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY no Dashboard'
      }, { status: 500 });
    }

    const credentials = JSON.parse(serviceAccountKey);
    
    // Parse do payload
    const { action, spreadsheetId, range, values, options = {} } = await req.json();

    // Validar inputs básicos
    if (!spreadsheetId || !range) {
      return Response.json({ 
        error: 'spreadsheetId e range são obrigatórios' 
      }, { status: 400 });
    }

    // Validar values para ações que requerem
    if (['write', 'append'].includes(action) && !values) {
      return Response.json({
        error: `A ação '${action}' requer o parâmetro 'values'`
      }, { status: 400 });
    }

    // ✅ OBTER ACCESS TOKEN (COM CACHE AUTOMÁTICO)
    const accessToken = await getGoogleAccessToken(credentials);

    // Executar ação solicitada
    let resultado;
    switch (action) {
      case 'read':
        resultado = await readSheet(accessToken, spreadsheetId, range);
        break;
      case 'write':
        resultado = await writeSheet(accessToken, spreadsheetId, range, values);
        break;
      case 'append':
        resultado = await appendSheet(accessToken, spreadsheetId, range, values);
        break;
      case 'clear':
        resultado = await clearSheet(accessToken, spreadsheetId, range);
        break;
      case 'test':
        resultado = await testConnection(accessToken, spreadsheetId, range);
        break;
      default:
        return Response.json({ error: 'Ação inválida' }, { status: 400 });
    }

    return Response.json({ 
      sucesso: true, 
      ...resultado 
    });

  } catch (error) {
    console.error('❌ Erro no Google Sheets Service:', error);
    return Response.json({ 
      error: error.message,
      // NÃO expor stack trace em produção
      detalhes: Deno.env.get('ENVIRONMENT') === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
});