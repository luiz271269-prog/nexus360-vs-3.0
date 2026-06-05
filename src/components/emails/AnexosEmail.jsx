import React, { useRef, useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Paperclip, Image as ImageIcon, FileText, Music, Video, Mic, Square, X, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Seletor de anexos para e-mail (mesmo padrão da Central de Comunicação):
// documentos/PDF, imagens (inclui prints colados via Ctrl+V), áudio (gravação), vídeo.
// Faz upload via Core.UploadFile e devolve a lista [{ url, filename, mediaType }] ao pai.
export default function AnexosEmail({ anexos, onChange }) {
  const fileInputRef = useRef(null);
  const imgInputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const iconePorTipo = (mediaType, filename = '') => {
    const f = filename.toLowerCase();
    if (mediaType === 'image' || /\.(png|jpe?g|webp|gif)$/.test(f)) return ImageIcon;
    if (mediaType === 'audio' || /\.(mp3|ogg|wav|m4a)$/.test(f)) return Music;
    if (mediaType === 'video' || /\.(mp4|webm|mov)$/.test(f)) return Video;
    return FileText;
  };

  const subirArquivos = useCallback(async (arquivos, mediaTypeHint) => {
    if (!arquivos?.length) return;
    setEnviando(true);
    try {
      const novos = [];
      for (const file of arquivos) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const tipo = mediaTypeHint
          || (file.type?.startsWith('image/') ? 'image'
            : file.type?.startsWith('audio/') ? 'audio'
            : file.type?.startsWith('video/') ? 'video' : 'document');
        novos.push({ url: file_url, filename: file.name, mediaType: tipo });
      }
      onChange([...(anexos || []), ...novos]);
    } catch (e) {
      toast.error('Falha ao anexar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  }, [anexos, onChange]);

  // Prints colados (Ctrl+V)
  useEffect(() => {
    const onPaste = (e) => {
      const itens = Array.from(e.clipboardData?.items || []);
      const imgs = itens.filter((it) => it.type.startsWith('image/')).map((it) => it.getAsFile()).filter(Boolean);
      if (imgs.length) {
        const renomeados = imgs.map((f, i) => new File([f], f.name || `print-${Date.now()}-${i}.png`, { type: f.type || 'image/png' }));
        subirArquivos(renomeados, 'image');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [subirArquivos]);

  const toggleGravacao = async () => {
    if (gravando) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => ev.data.size > 0 && chunksRef.current.push(ev.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/ogg' });
        const file = new File([blob], `audio-${Date.now()}.ogg`, { type: 'audio/ogg' });
        await subirArquivos([file], 'audio');
        setGravando(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setGravando(true);
    } catch {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const remover = (idx) => onChange((anexos || []).filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <input ref={fileInputRef} type="file" multiple className="hidden"
        onChange={(e) => { subirArquivos(Array.from(e.target.files || [])); e.target.value = ''; }} />
      <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { subirArquivos(Array.from(e.target.files || []), 'image'); e.target.value = ''; }} />

      <div className="flex items-center gap-1.5 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={enviando} className="gap-1.5 h-8">
          <Paperclip className="w-4 h-4" /> Documento/PDF
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => imgInputRef.current?.click()} disabled={enviando} className="gap-1.5 h-8">
          <ImageIcon className="w-4 h-4" /> Imagem
        </Button>
        <Button type="button" variant={gravando ? 'destructive' : 'outline'} size="sm" onClick={toggleGravacao} disabled={enviando} className="gap-1.5 h-8">
          {gravando ? <><Square className="w-4 h-4" /> Parar</> : <><Mic className="w-4 h-4" /> Áudio</>}
        </Button>
        {enviando && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
        <span className="text-[11px] text-slate-400">cole prints com Ctrl+V</span>
      </div>

      {(anexos || []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {anexos.map((a, idx) => {
            const Icone = iconePorTipo(a.mediaType, a.filename);
            return (
              <div key={idx} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg pl-2 pr-1 py-1 text-xs max-w-[200px]">
                <Icone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="truncate text-slate-700">{a.filename}</span>
                <button type="button" onClick={() => remover(idx)} className="hover:bg-slate-200 rounded p-0.5 flex-shrink-0">
                  <X className="w-3 h-3 text-slate-500" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}