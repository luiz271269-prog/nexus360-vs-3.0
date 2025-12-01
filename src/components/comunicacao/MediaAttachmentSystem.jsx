import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  X,
  Image as ImageIcon,
  Video,
  FileText,
  Mic,
  MapPin,
  User,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Camera,
  File,
  Music
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB recomendado
const VIDEO_MAX_DURATION = 180; // 3 minutos

const MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/3gp'],
  audio: ['audio/aac', 'audio/mp3', 'audio/ogg', 'audio/opus', 'audio/mpeg'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ]
};

const getMediaTypeFromMime = (mimeType) => {
  if (!mimeType) return 'document';
  
  // Verificação exata primeiro para documentos (application/pdf, etc.)
  for (const [type, mimes] of Object.entries(MIME_TYPES)) {
    if (mimes.includes(mimeType)) {
      return type;
    }
  }
  
  // Fallback por prefixo para tipos genéricos
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  
  return 'document';
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

function AttachmentPreview({ file, onRemove, caption, onCaptionChange }) {
  const [thumbnailUrl, setThumbnailUrl] = React.useState(null);
  const mediaType = getMediaTypeFromMime(file.type);

  React.useEffect(() => {
    if (file && (mediaType === 'image' || mediaType === 'video')) {
      const url = URL.createObjectURL(file);
      setThumbnailUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, mediaType]);

  const getIcon = () => {
    switch (mediaType) {
      case 'image': return ImageIcon;
      case 'video': return Video;
      case 'audio': return Music;
      default: return FileText;
    }
  };

  const Icon = getIcon();
  const showCaptionInput = mediaType === 'image' || mediaType === 'video';

  return (
    <Card className="p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 bg-slate-900/50 hover:bg-slate-900/70 text-white rounded-full"
        onClick={onRemove}
      >
        <X className="w-4 h-4" />
      </Button>

      <div className="flex gap-4">
        {/* Preview Area */}
        <div className="flex-shrink-0">
          {thumbnailUrl && mediaType === 'image' ? (
            <img 
              src={thumbnailUrl} 
              alt={file.name}
              className="w-24 h-24 object-cover rounded-lg"
            />
          ) : thumbnailUrl && mediaType === 'video' ? (
            <video 
              src={thumbnailUrl}
              className="w-24 h-24 object-cover rounded-lg"
            />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg flex items-center justify-center">
              <Icon className="w-10 h-10 text-orange-600" />
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {file.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {mediaType}
                </Badge>
                <span className="text-xs text-slate-500">
                  {formatFileSize(file.size)}
                </span>
              </div>
            </div>
          </div>

          {/* Caption Input */}
          {showCaptionInput && (
            <textarea
              value={caption || ''}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder="Adicionar legenda..."
              className="w-full mt-2 p-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={2}
            />
          )}
        </div>
      </div>
    </Card>
  );
};

export default function MediaAttachmentSystem({
  onSend,
  disabled,
  replyToMessage,
  thread,
  usuario,
  integrationIdOverride = null // Permite usar canal selecionado
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [captions, setCaptions] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      return `Arquivo muito grande. Máximo: ${formatFileSize(MAX_FILE_SIZE)}`;
    }

    const mediaType = getMediaTypeFromMime(file.type);
    
    if (mediaType === 'image' && file.size > IMAGE_MAX_SIZE) {
      toast.warning(`Imagem grande (${formatFileSize(file.size)}). Recomendado: ${formatFileSize(IMAGE_MAX_SIZE)}`);
    }

    // Validação de tipo - aceita tipos conhecidos ou genéricos de mídia
    const allMimeTypes = Object.values(MIME_TYPES).flat();
    const isKnownType = allMimeTypes.includes(file.type);
    const isGenericMedia = file.type.startsWith('image/') || 
                           file.type.startsWith('video/') || 
                           file.type.startsWith('audio/') ||
                           file.type.startsWith('application/');
    
    if (!isKnownType && !isGenericMedia) {
      return `Tipo de arquivo não suportado: ${file.type}`;
    }

    return null;
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    
    const validFiles = [];
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      const newCaptions = {};
      validFiles.forEach(file => {
        newCaptions[file.name] = '';
      });
      setCaptions(prev => ({ ...prev, ...newCaptions }));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileName) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
    setCaptions(prev => {
      const newCaptions = { ...prev };
      delete newCaptions[fileName];
      return newCaptions;
    });
  };

  const handleCaptionChange = (fileName, caption) => {
    setCaptions(prev => ({
      ...prev,
      [fileName]: caption
    }));
  };

  const handleSend = async () => {
    if (selectedFiles.length === 0 || !thread || !usuario) {
      return;
    }

    const contatoTel = thread.contato?.telefone || thread.contato?.celular;
    if (!contatoTel) {
      toast.error('Contato sem telefone cadastrado.');
      return;
    }

    const integrationIdParaUso = integrationIdOverride || thread.whatsapp_integration_id;
    if (!integrationIdParaUso) {
      toast.error('Thread sem integração WhatsApp configurada.');
      return;
    }

    setUploading(true);

    const results = [];
    const mensagensCriadas = {};

    // 1. Criar TODAS as mensagens com status 'enviando' primeiro
    for (const file of selectedFiles) {
      const caption = captions[file.name] || '';
      const mediaType = getMediaTypeFromMime(file.type);
      const previewUrl = URL.createObjectURL(file);

      try {
        const novaMensagem = await base44.entities.Message.create({
          thread_id: thread.id,
          sender_id: usuario.id,
          sender_type: 'user',
          recipient_id: thread.contact_id,
          recipient_type: 'contact',
          content: caption || `[${mediaType}]`,
          channel: 'whatsapp',
          status: 'enviando',
          sent_at: new Date().toISOString(),
          media_url: previewUrl,
          media_type: mediaType,
          media_caption: caption || null,
          reply_to_message_id: replyToMessage?.id || null,
          metadata: {
            whatsapp_integration_id: integrationIdParaUso,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type
          }
        });
        mensagensCriadas[file.name] = novaMensagem;
        setUploadProgress(prev => ({ ...prev, [file.name]: 'created' }));
      } catch (createErr) {
        console.error(`[MEDIA] Erro ao criar mensagem para ${file.name}:`, createErr);
        setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
      }
    }

    // Callback para atualizar UI
    if (onSend) {
      onSend();
    }

    // 2. Agora fazer upload e envio de cada arquivo
    for (const file of selectedFiles) {
      const novaMensagem = mensagensCriadas[file.name];
      if (!novaMensagem) continue;

      const caption = captions[file.name] || '';
      const mediaType = getMediaTypeFromMime(file.type);

      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 'uploading' }));

        // Upload do arquivo
        console.log(`[MEDIA] 📤 Upload: ${file.name}`);
        const uploadResponse = await base44.integrations.Core.UploadFile({ file });
        const fileUrl = uploadResponse.file_url;
        console.log(`[MEDIA] ✅ Upload OK: ${fileUrl}`);

        setUploadProgress(prev => ({ ...prev, [file.name]: 'sending' }));

        // Enviar via WhatsApp
        const dadosEnvio = {
          integration_id: integrationIdParaUso,
          numero_destino: contatoTel,
          media_type: mediaType
        };

        if (mediaType === 'audio') {
          dadosEnvio.audio_url = fileUrl;
        } else {
          dadosEnvio.media_url = fileUrl;
        }

        // Caption para imagens/vídeos, fileName para documentos
        if (mediaType === 'document') {
          dadosEnvio.media_caption = file.name; // Nome do arquivo para documentos
        } else if (caption) {
          dadosEnvio.media_caption = caption;
        }

        if (replyToMessage?.whatsapp_message_id) {
          dadosEnvio.reply_to_message_id = replyToMessage.whatsapp_message_id;
        }

        console.log(`[MEDIA] 📦 Enviando ${mediaType}:`, JSON.stringify(dadosEnvio));
        const resultado = await base44.functions.invoke('enviarWhatsApp', dadosEnvio);
        console.log(`[MEDIA] 📥 Resultado:`, JSON.stringify(resultado.data));

        if (resultado.data.success) {
          // Atualizar mensagem para 'enviada'
          await base44.entities.Message.update(novaMensagem.id, {
            status: 'enviada',
            whatsapp_message_id: resultado.data.message_id,
            media_url: fileUrl,
            sent_at: new Date().toISOString()
          });

          setUploadProgress(prev => ({ ...prev, [file.name]: 'success' }));
          results.push({ file: file.name, success: true });
        } else {
          // Marcar como falhou
          await base44.entities.Message.update(novaMensagem.id, {
            status: 'falhou',
            erro_detalhes: resultado.data.error || 'Erro desconhecido'
          });
          setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
          console.error(`[MEDIA] ❌ Erro ao enviar ${file.name}:`, resultado.data.error);
        }
      } catch (error) {
        console.error(`[MEDIA] ❌ Erro ao processar ${file.name}:`, error);
        
        // Marcar como falhou
        try {
          await base44.entities.Message.update(novaMensagem.id, {
            status: 'falhou',
            erro_detalhes: error.message || 'Erro ao enviar'
          });
        } catch (updateErr) {
          console.error('[MEDIA] Erro ao atualizar status:', updateErr);
        }
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
      }
    }

    // 3. Atualizar thread
    if (results.length > 0) {
      try {
        await base44.entities.MessageThread.update(thread.id, {
          last_message_content: results.length === 1 
            ? `[${getMediaTypeFromMime(selectedFiles[0].type)}]`
            : `[${results.length} arquivos]`,
          last_message_at: new Date().toISOString(),
          last_message_sender: 'user',
          last_media_type: getMediaTypeFromMime(selectedFiles[0].type)
        });
      } catch (threadErr) {
        console.error('[MEDIA] Erro ao atualizar thread:', threadErr);
      }

      toast.success(`✅ ${results.length} arquivo(s) enviado(s)!`);
    } else {
      toast.error('❌ Nenhum arquivo foi enviado com sucesso.');
    }

    // Limpar seleção
    setSelectedFiles([]);
    setCaptions({});
    setUploadProgress({});
    setUploading(false);

    // Atualizar mensagens no chat
    if (onSend) {
      setTimeout(() => onSend(), 500);
    }
  };

  const getTotalSize = () => {
    return selectedFiles.reduce((sum, file) => sum + file.size, 0);
  };

  if (selectedFiles.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept={Object.values(MIME_TYPES).flat().join(',')}
          onChange={handleFileSelect}
          disabled={disabled || uploading}
        />
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex-shrink-0"
          title="Anexar arquivo"
        >
          <Paperclip className="w-5 h-5 text-slate-600" />
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t bg-slate-50 p-4">
      <div className="space-y-3">
        {/* Preview de arquivos selecionados */}
        {selectedFiles.map((file) => (
          <AttachmentPreview
            key={file.name}
            file={file}
            caption={captions[file.name]}
            onCaptionChange={(caption) => handleCaptionChange(file.name, caption)}
            onRemove={() => handleRemoveFile(file.name)}
          />
        ))}

        {/* Barra de ações */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Paperclip className="w-4 h-4 mr-2" />
              Adicionar mais
            </Button>

            <div className="text-xs text-slate-600">
              {selectedFiles.length} arquivo(s) • {formatFileSize(getTotalSize())}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={Object.values(MIME_TYPES).flat().join(',')}
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedFiles([]);
                setCaptions({});
                setUploadProgress({});
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={handleSend}
              disabled={uploading || selectedFiles.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar {selectedFiles.length > 1 ? `(${selectedFiles.length})` : ''}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress indicators */}
        {uploading && (
          <div className="space-y-1 pt-2 border-t">
            {Object.entries(uploadProgress).map(([fileName, status]) => (
              <div key={fileName} className="flex items-center gap-2 text-xs">
                {status === 'uploading' && (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                    <span className="text-slate-600">Fazendo upload de {fileName}...</span>
                  </>
                )}
                {status === 'sending' && (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
                    <span className="text-slate-600">Enviando {fileName} via WhatsApp...</span>
                  </>
                )}
                {status === 'success' && (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-green-600">{fileName} enviado!</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}