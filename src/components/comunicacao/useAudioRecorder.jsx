import { useState, useRef, useCallback } from 'react';

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
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' });

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