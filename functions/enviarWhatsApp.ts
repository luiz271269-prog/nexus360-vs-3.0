import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// FUNÇÃO UNIFICADA DE ENVIO WHATSAPP - v2.0.0
// ============================================================================
// Suporta Z-API e W-API em uma única função inteligente
// Detecta automaticamente o provedor e adapta o envio
// ============================================================================

const VERSION = 'v2.1.0';
const WAPI_BASE_URL = 'https://api.w-api.app/v1';

// Configuração de mídia por provedor
// Z-API: campos diretos (image, video, audio, document)
// W-API: campos específicos + extension obrigatório para documentos
const MEDIA_CONFIG = {
  image: { endpoint: 'send-image', zapiField: 'image', wapiField: 'image', caption: true },
  video: { endpoint: 'send-video', zapiField: 'video', wapiField: 'video', caption: true },
  audio: { endpoint: 'send-audio', zapiField: 'audio', wapiField: 'audio', caption: false },
  document: { 
    endpoint: 'send-document', 
    zapiField: 'document', 
    wapiField: 'document',
    caption: true,
    zapiRequiresExtension: true,  // Exige /send-document/{extension}
    zapiFallbackToText: true,      // Fallback para /send-text se falhar
    wapiRequiresExtension: true 
  }
};

// Mapeamento de extensões para MIME types (Z-API)
const EXT_TO_MIMETYPE = {
  // Documentos
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'txt': 'text/plain',
  'csv': 'text/csv',
  'zip': 'application/zip',
  'rar': 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  // Imagens
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'svg': 'image/svg+xml',
  // Vídeos
  'mp4': 'video/mp4',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  '3gp': 'video/3gpp',
  'mkv': 'video/x-matroska',
  // Áudios
  'mp3': 'audio/mpeg',
  'ogg': 'audio/ogg',
  'opus': 'audio/opus',
  'wav': 'audio/wav',
  'm4a': 'audio/mp4',
  'amr': 'audio/amr'
};

// Extrair extensão de uma URL ou nome de arquivo
function extrairExtensao(urlOuNome, tipoInformado) {
  const mimeToExt = {
    'image': 'jpg',
    'video': 'mp4',
    'audio': 'mp3',
    'document': 'pdf',
    'sticker': 'webp',
  };

  if (!urlOuNome) {
    return mimeToExt[tipoInformado] || 'bin';
  }

  try {
    // Primeiro tentar extrair do nome do arquivo (mais confiável)
    const nomeArquivo = urlOuNome.split('/').pop().split('?')[0];
    if (nomeArquivo.includes('.')) {
      const ext = nomeArquivo.split('.').pop().toLowerCase();
      if (ext.length > 0 && ext.length <= 5) return ext;
    }
    
    // Fallback: tentar extrair do path da URL
    const path = new URL(urlOuNome).pathname;
    const parts = path.split('.');
    if (parts.length > 1) {
      const potentialExt = parts[parts.length - 1].split('?')[0].toLowerCase();
      if (potentialExt.length > 0 && potentialExt.length <= 5) return potentialExt;
    }
  } catch (e) {}
  
  return mimeToExt[tipoInformado] || 'pdf'; // Default para documentos
}

// Obter MIME type baseado na extensão
function obterMimeType(extensao) {
  return EXT_TO_MIMETYPE[extensao.toLowerCase()] || 'application/octet-stream';
}

// Sanitizar nome de arquivo (remover caracteres inválidos)
function sanitizarFileName(nome, extensao) {
  if (!nome) return `document.${extensao}`;
  
  // Remover caracteres perigosos e limitar tamanho
  let nomeSeguro = nome
    .trim()
    .replace(/[\/:*?"<>|\\]/g, '_')
    .slice(0, 100);
  
  // Garantir que tem a extensão correta
  const extLower = `.${extensao.toLowerCase()}`;
  if (!nomeSeguro.toLowerCase().endsWith(extLower)) {
    // Remover extensão errada se existir
    const lastDot = nomeSeguro.lastIndexOf('.');
    if (lastDot > 0) {
      nomeSeguro = nomeSeguro.substring(0, lastDot);
    }
    nomeSeguro = `${nomeSeguro}${extLower}`;
  }
  
  return nomeSeguro;
}

// Detectar tipo de mídia pela extensão/URL
// ✅ CRÍTICO: URL sempre tem prioridade sobre tipoInformado para determinar tipo real
function detectarTipoMidia(url, tipoInformado) {
  const ext = extrairExtensao(url);
  const mapExt = {
    'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image',
    'mp4': 'video', 'mov': 'video', 'avi': 'video', '3gp': 'video',
    'mp3': 'audio', 'ogg': 'audio', 'opus': 'audio', 'wav': 'audio', 'm4a': 'audio', 'amr': 'audio',
    'pdf': 'document', 'doc': 'document', 'docx': 'document', 'xls': 'document', 'xlsx': 'document', 'txt': 'document', 'zip': 'document'
  };
  
  const tipoDetectado = mapExt[ext];
  
  // ✅ Se a URL tem extensão clara (documento/imagem/áudio/vídeo), usar tipo detectado
  // Caso contrário, usar tipoInformado se válido
  if (tipoDetectado) {
    if (tipoInformado && tipoInformado !== 'none' && tipoDetectado !== tipoInformado) {
      console.warn(`[ENVIAR-WHATSAPP-UNIFICADO] ⚠️ Conflito de tipo: URL sugere ${tipoDetectado}, mas tipoInformado=${tipoInformado}. Usando URL.`);
    }
    return tipoDetectado; // URL tem prioridade
  }
  
  // Fallback: usar tipoInformado se válido
  return (tipoInformado && tipoInformado !== 'none') ? tipoInformado : 'document';
}

// Formatar número de telefone (apenas dígitos)
function formatarNumero(numero) {
  if (!numero) return '';
  return String(numero).replace(/\D/g, '');
}

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    console.log('[ENVIAR-WHATSAPP-UNIFICADO] 📤 Payload recebido:', JSON.stringify(payload, null, 2));

    const {
      integration_id,
      numero_destino,
      mensagem,
      template_name,
      template_variables,
      media_url,
      media_type,
      media_caption,
      audio_url,
      reply_to_message_id,
      message_type,
      interactive_buttons
    } = payload;

    // ✅ Validação de campos obrigatórios
    if (!integration_id || !numero_destino) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Campos obrigatórios ausentes', 
          missing: {
            integration_id: !integration_id,
            numero_destino: !numero_destino
          },
          version: VERSION
        }),
        { status: 400, headers }
      );
    }

    // ✅ Validação de conteúdo
    if (!mensagem && !template_name && !media_url && !audio_url && !interactive_buttons) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nenhum conteúdo fornecido. Forneça: mensagem, template_name, media_url, audio_url ou interactive_buttons',
          version: VERSION
        }),
        { status: 400, headers }
      );
    }

    // ✅ Validação de mídia
    if (media_url && !media_type) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'media_type é obrigatório quando media_url é fornecido. Valores: image, video, document',
          version: VERSION
        }),
        { status: 400, headers }
      );
    }

    // ✅ Validação de tipo de mídia suportado
    if (media_type && !MEDIA_CONFIG[media_type]) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Tipo de mídia não suportado: ${media_type}`,
          supported_types: Object.keys(MEDIA_CONFIG),
          version: VERSION
        }),
        { status: 400, headers }
      );
    }

    // Buscar integração
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      throw new Error('Integração WhatsApp não encontrada');
    }

    // ✅ Detectar provedor
    const isWAPI = integracao.api_provider === 'w_api';
    const providerName = isWAPI ? 'W-API' : 'Z-API';
    
    console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 🔗 Integração: ${integracao.nome_instancia} | Provedor: ${providerName}`);

    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    const clientToken = integracao.security_client_token_header;
    const baseUrl = isWAPI ? WAPI_BASE_URL : integracao.base_url_provider;
    
    // Formatar número (W-API prefere apenas dígitos)
    const numeroFormatado = formatarNumero(numero_destino);

    let endpoint;
    let body;

    // ========== BOTÕES INTERATIVOS ==========
    if (message_type === 'interactive_buttons' || interactive_buttons) {
      const buttons = interactive_buttons || [];
      const bodyText = mensagem || '';
      
      // W-API: Verificar limite de 3 botões
      if (isWAPI && buttons.length > 3) {
        // Converter para List Message quando mais de 3 botões
        console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📋 Convertendo ${buttons.length} botões para List Message (W-API)`);
        endpoint = `${baseUrl}/message/send-list-message?instanceId=${instanceId}`;
        body = {
          phone: numeroFormatado,
          title: 'Menu',
          buttonText: 'Ver opções',
          description: bodyText,
          sections: [{
            title: 'Opções',
            rows: buttons.map(btn => ({
              id: btn.id,
              title: btn.text,
              description: ''
            }))
          }],
          delayMessage: 1
        };
      } else if (isWAPI) {
        // W-API: Quick reply buttons (máx 3)
        endpoint = `${baseUrl}/message/send-buttons?instanceId=${instanceId}`;
        body = {
          phone: numeroFormatado,
          message: bodyText,
          buttons: buttons.map(btn => ({
            id: btn.id,
            text: btn.text
          })),
          delayMessage: 1
        };
      } else {
        // Z-API: Botões interativos
        endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-button-actions`;
        body = {
          phone: numeroFormatado,
          message: bodyText,
          buttonActions: {
            buttons: buttons.map(btn => ({
              id: btn.id,
              label: btn.text
            }))
          }
        };
      }
      
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 🔘 Enviando botões/lista interativos (${providerName})`);
    }
    
    // ========== TEMPLATES ==========
    else if (template_name) {
      if (isWAPI) {
        endpoint = `${baseUrl}/message/send-template?instanceId=${instanceId}`;
        body = {
          phone: numeroFormatado,
          template: template_name,
          variables: template_variables || {},
          delayMessage: 1
        };
      } else {
        endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-template`;
        body = {
          phone: numero_destino,
          template: template_name,
          variables: template_variables || {}
        };
      }
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📋 Enviando template (${providerName}):`, template_name);
    } 
    
    // ========== ÁUDIO ==========
    else if (audio_url) {
      if (isWAPI) {
        // W-API: usar send-audio com campo 'audio' (corrigido)
        endpoint = `${baseUrl}/message/send-audio?instanceId=${instanceId}`;
        body = {
          phone: numeroFormatado,
          audio: audio_url,       // ✅ CORRIGIDO: W-API usa 'audio' para áudio
          delayMessage: 1
        };
        
        if (reply_to_message_id) {
          body.messageId = reply_to_message_id;
        }
      } else {
        // Z-API: usar endpoint correto para áudio
        // Z-API pode usar send-audio ou send-message dependendo da versão
        endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-audio`;
        body = {
          phone: numeroFormatado,
          audio: audio_url,       // ✅ Z-API usa 'audio' para URL
          ptt: true,              // ✅ CRÍTICO: Para áudio aparecer como "Gravado na hora" (Z-API)
          waveform: true          // Exibir forma de onda (PTT style)
        };
        
        if (reply_to_message_id) {
          body.messageId = reply_to_message_id;
        }
      }
      
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 🎵 Enviando áudio (${providerName}):`, audio_url?.substring(0, 60));
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 🎵 Body:`, JSON.stringify(body));
    } 
    
    // ========== MÍDIAS (imagem, vídeo, documento) ==========
    else if (media_url && media_type) {
      // Detectar tipo se não informado corretamente
      const tipoMidiaReal = detectarTipoMidia(media_url, media_type);
      const config = MEDIA_CONFIG[tipoMidiaReal];

      // Para W-API, extrair a extensão do media_caption ou media_url
      const extensaoArquivo = extrairExtensao(media_caption || media_url, tipoMidiaReal);
      
      if (!config) {
        throw new Error(`Tipo de mídia não suportado: ${tipoMidiaReal}`);
      }
      
      if (isWAPI) {
        // ========== W-API ==========
        endpoint = `${baseUrl}/message/${config.endpoint}?instanceId=${instanceId}`;
        
        if (tipoMidiaReal === 'document') {
          // ✅ W-API DOCUMENTO: campos obrigatórios extension + document
          body = {
            phone: numeroFormatado,
            document: media_url,
            extension: extensaoArquivo,           // ✅ CRÍTICO: W-API exige extension
            delayMessage: 1
          };
          // fileName opcional mas recomendado
          if (media_caption) {
            body.fileName = media_caption;
          } else {
            body.fileName = `document.${extensaoArquivo}`;
          }
        } else if (tipoMidiaReal === 'image') {
          // W-API IMAGEM - URL precisa ser diretamente acessível
          let urlParaUsar = media_url;
          
          // Limpar URL: remover query params e garantir acesso público
          if (media_url.includes('?')) {
            urlParaUsar = media_url.split('?')[0];
          }
          
          // Para Supabase Storage, garantir formato correto
          if (media_url.includes('supabase.co/storage/v1/object/')) {
            // Garantir que é uma URL pública sem autenticação
            if (!media_url.includes('/public/')) {
              console.warn(`[ENVIAR-WHATSAPP-UNIFICADO] ⚠️ URL não é pública:`, media_url);
            }
            urlParaUsar = media_url.split('?')[0]; // Remove tokens/params
          }
          
          body = {
            phone: numeroFormatado,
            image: urlParaUsar,
            delayMessage: 1
          };
          if (media_caption) body.caption = media_caption;
          
          console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📷 W-API Image - URL original:`, media_url);
          console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📷 W-API Image - URL limpa:`, urlParaUsar);
        } else if (tipoMidiaReal === 'video') {
          // W-API VÍDEO
          body = {
            phone: numeroFormatado,
            video: media_url,
            delayMessage: 1
          };
          if (media_caption) body.caption = media_caption;
        }
      } else {
        // ========== Z-API ==========
        let nomeArquivoSeguro;
        
        if (tipoMidiaReal === 'document') {
          // ✅ Z-API DOCUMENTO com extensão no path
          endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/${config.endpoint}/${extensaoArquivo}`;
          
          if (media_caption && media_caption.includes('.')) {
            nomeArquivoSeguro = sanitizarFileName(media_caption, extensaoArquivo);
          } else {
            const nomeBase = media_caption ? media_caption.replace(/[\/:*?"<>|\\]/g, '_').slice(0, 100) : 'documento';
            nomeArquivoSeguro = `${nomeBase}.${extensaoArquivo}`;
          }
          
          body = {
            phone: numeroFormatado,
            document: media_url,
            fileName: nomeArquivoSeguro
          };
          
          console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📄 Z-API documento: ${nomeArquivoSeguro} | ext=${extensaoArquivo} | URL: ${media_url?.substring(0, 50)}...`);
        } else {
          // Outros tipos (imagem, vídeo, audio)
          endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/${config.endpoint}`;
        }
        
        if (tipoMidiaReal === 'image') {
          // Z-API IMAGEM - IMPORTANTE: Z-API precisa fazer download da URL
          // Se a URL for do Supabase Storage, garantir que é pública
          let urlParaUsar = media_url;
          
          // Se a URL contém 'base44-prod' mas não tem token, é do nosso storage público
          if (media_url.includes('base44-prod/public/')) {
            urlParaUsar = media_url.split('?')[0]; // Remove query params se houver
          }
          
          body = {
            phone: numeroFormatado,
            image: urlParaUsar
          };
          if (media_caption) body.caption = media_caption;
          
          console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📷 Z-API Image URL:`, urlParaUsar);
        } else if (tipoMidiaReal === 'video') {
          // Z-API VÍDEO
          body = {
            phone: numeroFormatado,
            video: media_url
          };
          if (media_caption) body.caption = media_caption;
        }
      }
      
      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
      }
      
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📎 Enviando ${tipoMidiaReal} (${providerName}):`, media_url?.substring(0, 60));
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📎 Body:`, JSON.stringify(body));
    } 
    
    // ========== TEXTO ==========
    else if (mensagem) {
      if (isWAPI) {
        endpoint = `${baseUrl}/message/send-text?instanceId=${instanceId}`;
        body = {
          phone: numeroFormatado,
          message: mensagem,
          delayMessage: 1
        };
      } else {
        endpoint = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
        body = {
          phone: numero_destino,
          message: mensagem
        };
      }

      if (reply_to_message_id) {
        body.messageId = reply_to_message_id;
      }

      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 💬 Enviando texto (${providerName})`);
    } else {
      throw new Error('Nenhum conteúdo fornecido');
    }

    console.log('[ENVIAR-WHATSAPP-UNIFICADO] 🌐 Endpoint:', endpoint);
    console.log('[ENVIAR-WHATSAPP-UNIFICADO] 📦 Body:', JSON.stringify(body, null, 2));

    // ✅ Configurar headers conforme o provedor
    const requestHeaders = {
      'Content-Type': 'application/json'
    };
    
    if (isWAPI) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      requestHeaders['Client-Token'] = clientToken;
    }

    let response = await fetch(endpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body)
    });

    let responseText = await response.text();
    console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📥 Resposta ${providerName} (HTTP ${response.status}):`, responseText);

    // ✅ FALLBACK INTELIGENTE: Z-API documento falha → tentar /send-text com link
    if (!isWAPI && tipoMidiaReal === 'document' && !response.ok && responseText.includes('NOT_FOUND')) {
      console.warn(`[ENVIAR-WHATSAPP-UNIFICADO] ⚠️ Z-API /send-document falhou, ativando fallback /send-text com link`);
      
      const endpointFallback = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
      const nomeArquivo = body.fileName || 'documento';
      const bodyFallback = {
        phone: numeroFormatado,
        message: `📄 ${nomeArquivo}\n\n${media_url}`
      };
      
      response = await fetch(endpointFallback, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(bodyFallback)
      });
      
      responseText = await response.text();
      console.log(`[ENVIAR-WHATSAPP-UNIFICADO] 📥 Fallback /send-text (HTTP ${response.status}):`, responseText.substring(0, 100));
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[ENVIAR-WHATSAPP-UNIFICADO] ❌ Erro ao fazer parse:', parseError);
      throw new Error(`Resposta inválida do ${providerName}: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok || result.error) {
      const errorMsg = result.error || result.message || `Erro HTTP ${response.status}`;
      console.error(`[ENVIAR-WHATSAPP-UNIFICADO] ❌ ERRO ${providerName}:`, {
        status_http: response.status,
        erro: errorMsg,
        endpoint,
        body,
        resposta: result
      });
      throw new Error(`${providerName} retornou erro: ${errorMsg}`);
    }

    const messageId = result.messageId || result.message?.key?.id || result.key?.id || result.id;

    if (!messageId) {
      console.warn(`[ENVIAR-WHATSAPP-UNIFICADO] ⚠️ Nenhum messageId encontrado na resposta:`, result);
    }

    console.log(`[ENVIAR-WHATSAPP-UNIFICADO] ✅ Mensagem enviada via ${providerName}! messageId:`, messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        response: result,
        provider: isWAPI ? 'w_api' : 'z_api',
        version: VERSION
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[ENVIAR-WHATSAPP-UNIFICADO] ❌ ERRO:', error.message);
    console.error('[ENVIAR-WHATSAPP-UNIFICADO] ❌ Stack:', error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        version: VERSION
      }),
      { status: 500, headers }
    );
  }
});