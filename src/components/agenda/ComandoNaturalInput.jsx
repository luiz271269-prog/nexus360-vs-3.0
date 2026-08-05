import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mic, Square, Send, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAudioRecorder, extensaoDoAudio } from '@/components/comunicacao/useAudioRecorder';

// Barra de comando da Agenda IA: texto, áudio (transcrito) ou imagem (lida pela IA).
// Sempre entrega o texto final via onComando(texto) — o agendamento é automático.
export default function ComandoNaturalInput({ disabled, enviando, onComando }) {
  const [texto, setTexto] = useState('');
  const [processandoMidia, setProcessandoMidia] = useState(false);
  const { gravando, iniciarGravacao, pararGravacao, cancelarGravacao, audioBlob } = useAudioRecorder();
  const fileInputRef = useRef(null);
  const ocupado = disabled || enviando || processandoMidia;

  // Quando a gravação termina, transcreve e envia automaticamente
  useEffect(() => {
    if (!audioBlob) return;
    (async () => {
      setProcessandoMidia(true);
      try {
        const ext = extensaoDoAudio(audioBlob.type);
        const file = new File([audioBlob], `comando-agenda.${ext}`, { type: audioBlob.type });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
        const textoFinal = (transcript || '').trim();
        if (!textoFinal) {
          toast.error('Não entendi o áudio. Tente novamente.');
          return;
        }
        toast.info(`🎙️ "${textoFinal}"`);
        await onComando(textoFinal);
      } catch (error) {
        console.error('[COMANDO-NATURAL] Erro no áudio:', error);
        toast.error('❌ Erro ao processar o áudio');
      } finally {
        setProcessandoMidia(false);
        cancelarGravacao();
      }
    })();
  }, [audioBlob]);

  const handleImagem = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessandoMidia(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta imagem e extraia o compromisso, tarefa, ligação ou lembrete que ela representa.
Responda APENAS com um comando de agenda em português, curto e direto, no formato de comando natural.
Exemplos de formato: "agendar reunião com cliente amanhã às 15h", "lembrete ligar fornecedor sexta 10h", "tarefa enviar orçamento dia 12/08 às 9h".
Se houver data e hora na imagem, inclua-as. Se não houver nada agendável na imagem, responda exatamente: NADA_AGENDAVEL`,
        file_urls: [file_url]
      });
      const comando = (resultado || '').trim();
      if (!comando || comando.includes('NADA_AGENDAVEL')) {
        toast.error('Não encontrei nada agendável nessa imagem.');
        return;
      }
      toast.info(`🖼️ "${comando}"`);
      await onComando(comando);
    } catch (error) {
      console.error('[COMANDO-NATURAL] Erro na imagem:', error);
      toast.error('❌ Erro ao ler a imagem');
    } finally {
      setProcessandoMidia(false);
    }
  };

  const handleEnviarTexto = async () => {
    if (!texto.trim()) return;
    const t = texto.trim();
    setTexto('');
    await onComando(t);
  };

  const toggleGravacao = async () => {
    if (gravando) {
      pararGravacao();
      return;
    }
    try {
      await iniciarGravacao();
    } catch {
      toast.error('❌ Não foi possível acessar o microfone');
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImagem}
      />

      {/* Botão imagem */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={ocupado || gravando}
        title="Agendar a partir de uma imagem"
        className="flex-shrink-0"
      >
        <ImagePlus className="w-4 h-4 text-emerald-600" />
      </Button>

      <Input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEnviarTexto();
          }
        }}
        placeholder={gravando ? '🔴 Gravando... toque no quadrado para agendar' : 'Fale, digite ou envie imagem (ex: agendar reunião amanhã 14h)'}
        className="flex-1"
        disabled={ocupado || gravando}
      />

      {/* Botão microfone / parar */}
      <Button
        onClick={toggleGravacao}
        disabled={ocupado}
        size="icon"
        title={gravando ? 'Parar e agendar' : 'Gravar comando por voz'}
        className={`flex-shrink-0 ${gravando ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-slate-700 hover:bg-slate-800'}`}
      >
        {gravando ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </Button>

      {/* Enviar texto */}
      <Button
        onClick={handleEnviarTexto}
        disabled={!texto.trim() || ocupado || gravando}
        className="bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
        size="icon"
      >
        {(enviando || processandoMidia) ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}