import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function VoiceInput({
  onTranscription,
  onError,
  contextType = 'general',
  contextData = {},
  placeholder = 'Clique para falar',
  size = 'default',
  className = ''
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('[VoiceInput] 🎙️  Solicitando permissão de microfone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Tentar usar o melhor formato disponível
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }
      
      if (!selectedMimeType) {
        throw new Error('Nenhum formato de áudio suportado pelo navegador');
      }
      
      console.log('[VoiceInput] 🎵 Formato de gravação:', selectedMimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('[VoiceInput] 📦 Chunk recebido:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[VoiceInput] ⏹️  Gravação finalizada. Total de chunks:', audioChunksRef.current.length);
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        console.log('[VoiceInput] 📦 Blob criado:', audioBlob.size, 'bytes, tipo:', audioBlob.type);
        
        // Parar todas as tracks
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('[VoiceInput] 🛑 Track parada:', track.kind);
        });
        
        await processAudio(audioBlob, selectedMimeType);
      };

      mediaRecorder.start(1000); // Coletar dados a cada 1 segundo
      setIsRecording(true);
      toast.info('🎙️ Gravando áudio...', { duration: 2000 });
      console.log('[VoiceInput] ✅ Gravação iniciada');

    } catch (error) {
      console.error('[VoiceInput] ❌ Erro ao iniciar gravação:', error);
      toast.error('Erro ao acessar microfone', {
        description: 'Verifique as permissões do navegador'
      });
      if (onError) onError(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('[VoiceInput] 🛑 Parando gravação...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // ✅ FUNÇÃO PRINCIPAL: Converter qualquer áudio para WAV PCM 16 bits
  const convertToWav = async (audioBlob) => {
    try {
      console.log('[VoiceInput] 🔄 Iniciando conversão para WAV...');
      console.log('[VoiceInput] 📦 Formato original:', audioBlob.type, 'Tamanho:', audioBlob.size, 'bytes');
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      console.log('[VoiceInput] 🎵 Decodificando áudio...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log('[VoiceInput] ✅ Áudio decodificado:');
      console.log('[VoiceInput]    - Duração:', audioBuffer.duration, 's');
      console.log('[VoiceInput]    - Sample Rate:', audioBuffer.sampleRate, 'Hz');
      console.log('[VoiceInput]    - Canais:', audioBuffer.numberOfChannels);
      
      // Converter para WAV PCM 16 bits
      const wavBuffer = audioBufferToWav(audioBuffer);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      
      console.log('[VoiceInput] ✅ Conversão concluída!');
      console.log('[VoiceInput] 📦 WAV criado:', wavBlob.size, 'bytes');
      
      return wavBlob;
      
    } catch (error) {
      console.error('[VoiceInput] ❌ Erro na conversão:', error);
      throw new Error('Falha ao converter áudio para WAV');
    }
  };

  // Função auxiliar: Converter AudioBuffer para WAV PCM 16 bits
  const audioBufferToWav = (buffer) => {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    
    const data = [];
    for (let i = 0; i < numberOfChannels; i++) {
      data.push(buffer.getChannelData(i));
    }
    
    const interleaved = interleave(data);
    const dataLength = interleaved.length * bytesPerSample;
    const bufferLength = 44 + dataLength;
    
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    floatTo16BitPCM(view, 44, interleaved);
    
    return arrayBuffer;
  };

  const interleave = (channelData) => {
    const length = channelData[0].length;
    const numberOfChannels = channelData.length;
    const result = new Float32Array(length * numberOfChannels);
    
    let offset = 0;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        result[offset++] = channelData[channel][i];
      }
    }
    
    return result;
  };

  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const floatTo16BitPCM = (view, offset, input) => {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  };

  const processAudio = async (audioBlob, originalMimeType) => {
    setIsProcessing(true);
    
    try {
      console.log('[VoiceInput] 🔄 Processando áudio...');
      
      // ✅ SEMPRE CONVERTER PARA WAV
      const wavBlob = await convertToWav(audioBlob);
      
      // Upload do arquivo WAV
      console.log('[VoiceInput] 📤 Fazendo upload do WAV...');
      const uploadResult = await base44.integrations.Core.UploadFile({
        file: new File([wavBlob], `audio_${Date.now()}.wav`, { type: 'audio/wav' })
      });

      if (!uploadResult.file_url) {
        throw new Error('Erro no upload do áudio');
      }

      console.log('[VoiceInput] ✅ Upload concluído:', uploadResult.file_url);
      
      // Preparar campos para contexto
      let availableFields = [];
      if (contextType === 'form' && contextData.schema) {
        availableFields = Object.keys(contextData.schema.properties || {});
      }

      console.log('[VoiceInput] 🤖 Solicitando transcrição via LLM...');
      
      // Transcrição via LLM
      const transcriptionResult = await base44.integrations.Core.InvokeLLM({
        prompt: `
        Transcreva este áudio com precisão. 
        Contexto: ${contextType}
        Campos disponíveis: ${availableFields.join(', ')}
        
        Retorne apenas a transcrição limpa do texto falado.
      `,
        file_urls: [uploadResult.file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            transcription: { type: 'string' },
            confidence: { type: 'number' },
            detected_language: { type: 'string' },
            context_analysis: { type: 'string' }
          },
          required: ['transcription']
        }
      });

      console.log('[VoiceInput] ✅ Transcrição recebida:', transcriptionResult);

      if (transcriptionResult.transcription) {
        if (onTranscription) {
          onTranscription({
            text: transcriptionResult.transcription,
            confidence: transcriptionResult.confidence,
            language: transcriptionResult.detected_language,
            analysis: transcriptionResult.context_analysis,
            audioUrl: uploadResult.file_url
          });
        }

        toast.success('🎤 Transcrição concluída!', {
          description: transcriptionResult.transcription.substring(0, 100) + '...',
          duration: 4000
        });
      }

    } catch (error) {
      console.error('[VoiceInput] ❌ Erro ao processar áudio:', error);
      toast.error('Erro na transcrição', {
        description: error.message || 'Erro ao processar o áudio. Tente novamente.',
        duration: 5000
      });
      if (onError) onError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const buttonSize = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';

  return (
    <Button
      type="button"
      variant={isRecording ? 'destructive' : 'outline'}
      size="icon"
      className={cn(buttonSize, className, isRecording && 'animate-pulse')}
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      title={isRecording ? 'Parar gravação' : placeholder}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}