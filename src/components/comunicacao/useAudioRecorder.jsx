import { useState, useRef, useCallback } from 'react';

/**
 * Escolhe o melhor formato REAL suportado pelo navegador.
 * Prioridade: OGG/Opus (padrão WhatsApp) > MP4/AAC (toca em qualquer Android, inclusive antigos) > WebM.
 * IMPORTANTE: nunca rotular o blob com um tipo diferente do gravado — Androids antigos
 * não conseguem tocar WebM disfarçado de .ogg.
 */
function escolherMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const preferencias = ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  return preferencias.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

/** Extensão de arquivo correta para o mimeType real gravado */
export function extensaoDoAudio(mimeType) {
  const t = (mimeType || '').toLowerCase();
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mp4') || t.includes('aac') || t.includes('m4a')) return 'm4a';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  return 'webm';
}

/**
 * Hook que encapsula toda a lógica de gravação de áudio via MediaRecorder.
 * @returns {{ gravando: boolean, iniciarGravacao: function, pararGravacao: function, cancelarGravacao: function, audioBlob: Blob|null }}
 */
export function useAudioRecorder() {
  const [gravando, setGravando] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const chunksRef = useRef([]);

  const iniciarGravacao = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mimeType = escolherMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // ✅ Usar o tipo REAL gravado (não forçar ogg) — compatibilidade com Androids antigos
        const tipoReal = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: tipoReal });

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }

        if (blob.size > 0) {
          setAudioBlob(blob);
        }

        chunksRef.current = [];
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
      setAudioBlob(null);
    } catch (error) {
      console.error('[useAudioRecorder] Erro ao acessar microfone:', error);
      throw error;
    }
  }, []);

  const pararGravacao = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setGravando(false);
    }
  }, []);

  const cancelarGravacao = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    chunksRef.current = [];
    setGravando(false);
    setAudioBlob(null);
  }, []);

  return { gravando, iniciarGravacao, pararGravacao, cancelarGravacao, audioBlob };
}