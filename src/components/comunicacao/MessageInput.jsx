import React, { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  Send, 
  Paperclip, 
  Mic, 
  StopCircle, 
  X, 
  Sparkles, 
  Users, 
  Loader2,
  Image as ImageIcon,
  File,
  FileText,
  Video,
  Trash2
} from 'lucide-react';

// Logos SVG inline para cada canal
const WhatsAppLogo = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const InstagramLogo = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
  </svg>
);

const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const GoToLogo = () => (
  <svg viewBox="0 0 120 40" className="h-3.5" fill="currentColor">
    <rect x="0" y="28" width="40" height="8" fill="#FFD700"/>
    <text x="5" y="22" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="bold">GoTo</text>
  </svg>
);
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import EmojiPickerButton from './EmojiPickerButton';
import SeletorPromocoesAtivas from '../automacao/SeletorPromocoesAtivas';

export default function MessageInput({
  onSendMessage,
  mensagemResposta,
  onClearResposta,
  nomeContato,
  gravandoAudio,
  onStartRecording,
  onStopRecording,
  mostrarMediaSystem,
  onToggleMediaSystem,
  ultimaMensagemCliente,
  mostrarSugestor,
  onToggleSugestor,
  podeEnviarMensagens,
  podeEnviarMidias,
  podeEnviarAudios,
  enviando,
  carregandoContato,
  uploadingPastedFile,
  modoSelecao,
  integracoes = [],
  canalSelecionado,
  onCanalChange,
  thread,
  usuario,
  modoSelecaoMultipla,
  contatosSelecionados = [],
  onCancelarSelecao,
  enviandoBroadcast,
  progressoBroadcast,
  pastedImageFromParent,
  onPastedImageChange
}) {
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [pastedImage, setPastedImage] = useState(null);
  const [pastedImagePreview, setPastedImagePreview] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPromocoesMenu, setShowPromocoesMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const attachMenuRef = useRef(null);
  const recordingIntervalRef = useRef(null);

  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPastedImage(file);
          const previewUrl = URL.createObjectURL(file);
          setPastedImagePreview(previewUrl);
          toast.info('📷 Imagem colada! Clique em enviar para compartilhar.');
        }
        break;
      }
    }
  }, []);

  const cancelarImagemColada = useCallback(() => {
    if (pastedImagePreview) {
      URL.revokeObjectURL(pastedImagePreview);
    }
    setPastedImage(null);
    setPastedImagePreview(null);
  }, [pastedImagePreview]);

  const handleEmojiSelect = useCallback((emoji) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = mensagemTexto;
    
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setMensagemTexto(newText);

    // Reposicionar cursor após o emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    }, 0);
  }, [mensagemTexto]);

  const handleFileSelect = useCallback((file, type) => {
    if (!file) return;
    
    setSelectedFile({ file, type });
    
    if (type === 'image' || type === 'video') {
      const preview = URL.createObjectURL(file);
      setFilePreview(preview);
    } else {
      setFilePreview(null);
    }
    
    setShowAttachMenu(false);
    toast.success(`${type === 'image' ? '📷 Imagem' : type === 'video' ? '🎥 Vídeo' : '📄 Documento'} selecionado!`);
  }, []);

  const cancelarArquivo = useCallback(() => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
  }, [filePreview]);

  const handleSelecionarPromocao = useCallback((dadosPromocao) => {
    const { file, previewUrl, caption } = dadosPromocao;
    
    setPastedImage(file);
    setPastedImagePreview(previewUrl);
    setMensagemTexto(caption || mensagemTexto);
    setShowPromocoesMenu(false);
    setShowAttachMenu(false);
  }, [mensagemTexto]);

  const handleEnviarComArquivo = useCallback(async (e) => {
    e?.preventDefault();
    
    if (!selectedFile && !mensagemTexto.trim() && !pastedImage) return;
    
    // ✅ Cancelar micro-URA se atendente responder
    if (thread?.id && usuario?.id) {
      base44.functions.invoke('cancelarMicroURASeAtendenteResponder', {
        thread_id: thread.id,
        sender_id: usuario.id
      }).catch(() => {});
    }
    
    if (selectedFile) {
      // Enviar arquivo anexado (imagem, vídeo, documento)
      onSendMessage({
        texto: mensagemTexto.trim(),
        attachedFile: selectedFile.file,
        attachedFileType: selectedFile.type
      });
      cancelarArquivo();
      setMensagemTexto("");
    } else if (pastedImage) {
      // Enviar imagem colada (print screen)
      onSendMessage({
        texto: mensagemTexto.trim(),
        pastedImage: pastedImage,
        pastedImagePreview: pastedImagePreview
      });
      setMensagemTexto("");
      setPastedImage(null);
      setPastedImagePreview(null);
    } else {
      // Enviar apenas texto
      onSendMessage({
        texto: mensagemTexto.trim()
      });
      setMensagemTexto("");
    }
  }, [mensagemTexto, pastedImage, pastedImagePreview, selectedFile, onSendMessage, thread, usuario, cancelarArquivo]);

  const handleEnviar = useCallback((e) => {
    e?.preventDefault();
    handleEnviarComArquivo(e);
  }, [handleEnviarComArquivo]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar(e);
    }
  }, [handleEnviar]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Fechar menu de anexos ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
    }
    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAttachMenu]);

  // Contador de tempo de gravação
  useEffect(() => {
    if (gravandoAudio) {
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setRecordingTime(0);
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [gravandoAudio]);

  const mostrarInterfaceBroadcast = modoSelecaoMultipla && contatosSelecionados.length > 0;

  return (
    <form onSubmit={handleEnviar} className="bg-[#d6dfe1] text-gray-950 px-2 md:px-3 rounded-lg border-t flex-shrink-0">
      {/* Inputs ocultos para arquivos */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'image')}
        style={{ display: 'none' }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'video')}
        style={{ display: 'none' }}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'document')}
        style={{ display: 'none' }}
      />

      {modoSelecaoMultipla && contatosSelecionados.length > 0 && (
        <div className="mb-2 p-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">
                Enviando para {contatosSelecionados.length} contato(s)
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelarSelecao}
              className="text-white/80 hover:text-white text-xs underline"
            >
              Cancelar
            </button>
          </div>

          {enviandoBroadcast && progressoBroadcast && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-white text-xs mb-1">
                <span>Enviando...</span>
                <span>{progressoBroadcast.enviados + progressoBroadcast.erros} / {progressoBroadcast.total}</span>
              </div>
              <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{
                    width: `${((progressoBroadcast.enviados + progressoBroadcast.erros) / progressoBroadcast.total) * 100}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {integracoes.length > 1 && !modoSelecaoMultipla && (
        <div className="mb-1 flex items-center gap-1 flex-wrap">
          <label className="text-gray-900 text-xs font-medium whitespace-nowrap">Enviar por:</label>
          <select
            value={canalSelecionado || thread?.whatsapp_integration_id || ''}
            onChange={(e) => onCanalChange(e.target.value)}
            className="bg-[#778ca6] text-slate-50 px-1.5 py-0.5 text-xs rounded border border-slate-300 min-w-0 flex-1 truncate"
          >
            {integracoes.map((int) => {
              const channelLogos = { z_api: '🟢', w_api: '🟢', instagram_api: '📸', facebook_graph_api: '📘', goto_phone: '📞' };
              const emoji = channelLogos[int.api_provider] || '📱';
              return (
                <option key={int.id} value={int.id}>
                  {emoji} {int.nome_instancia} ({int.numero_telefone || int.phone_number})
                </option>
              );
            })}
          </select>
        </div>
      )}

      {integracoes.length > 0 && modoSelecaoMultipla && contatosSelecionados.length > 0 && (
        <div className="mb-1 flex items-center gap-1 flex-wrap">
          <label className="text-gray-900 text-xs font-medium whitespace-nowrap">Enviar por:</label>
          <select
            value={canalSelecionado || integracoes.find(i => i.status === 'conectado')?.id || ''}
            onChange={(e) => onCanalChange(e.target.value)}
            className="bg-[#778ca6] text-slate-50 px-1.5 py-0.5 text-xs rounded border border-slate-300 min-w-0 flex-1 truncate"
          >
            {integracoes.filter(i => i.status === 'conectado').map((int) => {
              const channelLogos = { z_api: '🟢', w_api: '🟢', instagram_api: '📸', facebook_graph_api: '📘', goto_phone: '📞' };
              const emoji = channelLogos[int.api_provider] || '📱';
              return (
                <option key={int.id} value={int.id}>
                  {emoji} {int.nome_instancia} ({int.numero_telefone || int.phone_number})
                </option>
              );
            })}
          </select>
        </div>
      )}



      <div className="flex items-end gap-1 md:gap-2 relative">
        {/* Botão Anexar com Menu */}
        <div className="relative" ref={attachMenuRef}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="bg-transparent text-slate-50 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
            disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || !podeEnviarMidias}
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            title={!podeEnviarMidias ? "Sem permissão para enviar mídias" : "Anexar arquivo"}
          >
            <Paperclip className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
          </Button>

          {/* Menu de Anexos - Estilo WhatsApp */}
          {showAttachMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 py-2 min-w-[180px]">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 transition-colors text-left"
              >
                <div className="w-11 h-11 bg-purple-500 rounded-full flex items-center justify-center shadow-sm">
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-800">Imagem</span>
              </button>
              
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left"
              >
                <div className="w-11 h-11 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-800">Vídeo</span>
              </button>
              
              <button
                type="button"
                onClick={() => documentInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="w-11 h-11 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-800">Documento</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false);
                  setShowPromocoesMenu(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors text-left"
              >
                <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-800">Promoções</span>
              </button>
            </div>
          )}

          {/* Menu de Promoções */}
          {showPromocoesMenu && (
            <SeletorPromocoesAtivas
              onSelecionarPromocao={handleSelecionarPromocao}
              onClose={() => setShowPromocoesMenu(false)}
            />
          )}
        </div>

        {/* Botão Microfone - Muda para StopCircle quando gravando */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-8 w-8 md:h-9 md:w-9 flex-shrink-0",
            gravandoAudio 
              ? "bg-red-500 hover:bg-red-600 text-white" 
              : "text-zinc-950 hover:bg-accent hover:text-accent-foreground"
          )}
          disabled={enviando || carregandoContato || modoSelecao || uploadingPastedFile || !podeEnviarAudios}
          onClick={gravandoAudio ? onStopRecording : onStartRecording}
          title={gravandoAudio ? `Parar gravação (${formatTime(recordingTime)})` : (!podeEnviarAudios ? "Sem permissão para enviar áudios" : "Gravar áudio")}
        >
          {gravandoAudio ? (
            <StopCircle className="w-4 h-4 md:w-5 md:h-5" />
          ) : (
            <Mic className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
          )}
        </Button>

        <EmojiPickerButton
          onEmojiSelect={handleEmojiSelect}
          disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile || !podeEnviarMensagens}
        />

        {/* ✅ BOTÃO IA - SEMPRE VISÍVEL com animação se última mensagem é do cliente */}
        {podeEnviarMensagens && (
          <Button
            type="button"
            onClick={onToggleSugestor}
            variant="ghost"
            size="icon"
            className={cn(
              "text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-9 w-9 flex-shrink-0 relative",
              mostrarSugestor 
                ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 shadow-lg" 
                : "text-purple-600 hover:bg-purple-50",
              ultimaMensagemCliente && "animate-pulse"
            )}
            title="Sugestões de Resposta IA (últimas 50-100 mensagens)"
            disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile}
          >
            <Sparkles className="w-5 h-5" />
            {ultimaMensagemCliente && !mostrarSugestor && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-ping" />
            )}
          </Button>
        )}

        <div className="flex-1">
          {/* Preview de Arquivo Anexado */}
          {selectedFile && (
            <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg border border-green-300"
                  />
                ) : (
                  <div className="w-20 h-20 bg-green-100 rounded-lg border border-green-300 flex items-center justify-center">
                    <File className="w-8 h-8 text-green-600" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 mb-1">
                    {selectedFile.type === 'image' ? '📷' : selectedFile.type === 'video' ? '🎥' : '📄'} {selectedFile.file.name}
                  </p>
                  <p className="text-xs text-green-600">
                    {(selectedFile.file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={cancelarArquivo}
                  className="h-6 w-6 text-green-600 hover:text-green-800 hover:bg-green-100"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {pastedImagePreview && !selectedFile && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <img
                  src={pastedImagePreview}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded-lg border border-blue-300"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 mb-1">📷 Imagem colada</p>
                  <p className="text-xs text-blue-600">Digite uma legenda (opcional) e clique em enviar</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={cancelarImagemColada}
                  className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <textarea
            ref={inputRef}
            value={mensagemTexto}
            onChange={(e) => setMensagemTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              selectedFile
                ? "Digite uma legenda para o arquivo..."
                : pastedImagePreview 
                ? "Digite uma legenda para a imagem..." 
                : !podeEnviarMensagens 
                ? "Sem permissão para enviar mensagens" 
                : "Digite sua mensagem... (Ctrl+V para colar imagem)"
            }
            rows={Math.max(1, Math.min(5, mensagemTexto.split('\n').length))}
            className="w-full p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile || !podeEnviarMensagens}
          />
        </div>

        {(pastedImagePreview || selectedFile) ? (
          <Button
            type="button"
            onClick={handleEnviar}
            disabled={enviando || carregandoContato || uploadingPastedFile || !podeEnviarMidias}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white flex-shrink-0"
            title={selectedFile ? "Enviar arquivo" : "Enviar imagem colada"}
          >
            {uploadingPastedFile ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {selectedFile ? (
                  selectedFile.type === 'image' ? <ImageIcon className="w-4 h-4 mr-1" /> :
                  selectedFile.type === 'video' ? <Video className="w-4 h-4 mr-1" /> :
                  <File className="w-4 h-4 mr-1" />
                ) : (
                  <ImageIcon className="w-4 h-4 mr-1" />
                )}
                <Send className="w-4 h-4" />
              </>
            )}
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={
              enviando || 
              enviandoBroadcast || 
              gravandoAudio || 
              modoSelecao || 
              uploadingPastedFile || 
              !podeEnviarMensagens || 
              (!modoSelecaoMultipla && carregandoContato) ||
              (!mensagemTexto.trim() && !pastedImage && !selectedFile)
            }
            className={cn(
              "flex-shrink-0",
              modoSelecaoMultipla && contatosSelecionados.length > 0 
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600' 
                : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
              "text-white"
            )}
            title={
              !podeEnviarMensagens 
                ? "Sem permissão para enviar mensagens" 
                : modoSelecaoMultipla 
                ? `Enviar para ${contatosSelecionados.length} contato(s)` 
                : "Enviar mensagem"
            }
          >
            {enviando || enviandoBroadcast ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        )}
      </div>
    </form>
  );
}