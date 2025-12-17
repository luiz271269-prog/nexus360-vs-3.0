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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import EmojiPickerButton from './EmojiPickerButton';

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
      // Enviar arquivo anexado
      onSendMessage({
        texto: mensagemTexto.trim(),
        attachedFile: selectedFile.file,
        attachedFileType: selectedFile.type
      });
      cancelarArquivo();
    } else {
      // Enviar texto/imagem colada normal
      onSendMessage({
        texto: mensagemTexto.trim(),
        pastedImage: pastedImage,
        pastedImagePreview: pastedImagePreview
      });
    }
    
    setMensagemTexto("");
    setPastedImage(null);
    setPastedImagePreview(null);
  }, [mensagemTexto, pastedImage, pastedImagePreview, selectedFile, onSendMessage, thread, usuario, cancelarArquivo]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const mostrarInterfaceBroadcast = modoSelecaoMultipla && contatosSelecionados.length > 0;

  return (
    <form onSubmit={handleEnviar} className="bg-[#d6dfe1] text-gray-950 px-3 rounded-lg border-t flex-shrink-0">
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
        <div className="mb-2 flex items-center gap-2">
          <label className="text-gray-900 text-xs font-medium">Enviar por:</label>
          <select
            value={canalSelecionado || thread?.whatsapp_integration_id || ''}
            onChange={(e) => onCanalChange(e.target.value)}
            className="bg-[#778ca6] text-slate-50 px-2 py-1 text-xs rounded border border-slate-300"
          >
            {integracoes.map((int) => (
              <option key={int.id} value={int.id}>
                📱 {int.nome_instancia} ({int.numero_telefone})
              </option>
            ))}
          </select>
        </div>
      )}

      {integracoes.length > 0 && modoSelecaoMultipla && contatosSelecionados.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <label className="text-gray-900 text-xs font-medium">Enviar por:</label>
          <select
            value={canalSelecionado || integracoes.find(i => i.status === 'conectado')?.id || ''}
            onChange={(e) => onCanalChange(e.target.value)}
            className="bg-[#778ca6] text-slate-50 px-2 py-1 text-xs rounded border border-slate-300"
          >
            {integracoes.filter(i => i.status === 'conectado').map((int) => (
              <option key={int.id} value={int.id}>
                📱 {int.nome_instancia} ({int.numero_telefone})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* UI de Gravação de Áudio */}
      {gravandoAudio && (
        <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-700">Gravando áudio...</span>
              <span className="text-sm text-red-600 font-mono">{formatTime(recordingTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onStopRecording}
                className="text-red-600 hover:text-red-800 hover:bg-red-100"
              >
                <StopCircle className="w-4 h-4 mr-1" />
                Parar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 relative">
        {/* Botão Anexar com Menu */}
        <div className="relative" ref={attachMenuRef}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="bg-transparent text-slate-50 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0"
            disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || !podeEnviarMidias}
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            title={!podeEnviarMidias ? "Sem permissão para enviar mídias" : "Anexar arquivo"}
          >
            <Paperclip className="w-5 h-5 text-slate-600" />
          </Button>

          {/* Menu de Anexos */}
          {showAttachMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 p-2 min-w-[200px]">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 rounded-lg transition-colors text-left"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Imagem</span>
              </button>
              
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 rounded-lg transition-colors text-left"
              >
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Video className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Vídeo</span>
              </button>
              
              <button
                type="button"
                onClick={() => documentInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 rounded-lg transition-colors text-left"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Documento</span>
              </button>
            </div>
          )}
        </div>

        {/* Botão Microfone */}
        {!gravandoAudio && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-zinc-950 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0"
            disabled={enviando || carregandoContato || modoSelecao || uploadingPastedFile || !podeEnviarAudios}
            onClick={onStartRecording}
            title={!podeEnviarAudios ? "Sem permissão para enviar áudios" : "Gravar áudio"}
          >
            <Mic className="w-5 h-5 text-slate-600" />
          </Button>
        )}

        <EmojiPickerButton
          onEmojiSelect={handleEmojiSelect}
          disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile || !podeEnviarMensagens}
        />

        {ultimaMensagemCliente && podeEnviarMensagens && !mostrarSugestor && (
          <Button
            type="button"
            onClick={onToggleSugestor}
            variant="ghost"
            size="icon"
            className="text-red-600 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-accent-foreground h-9 w-9 flex-shrink-0 hover:bg-purple-50"
            title="Sugestões de IA"
            disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile}
          >
            <Sparkles className="w-5 h-5" />
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