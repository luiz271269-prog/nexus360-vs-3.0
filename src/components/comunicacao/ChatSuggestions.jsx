// ChatSuggestions - extracted from ChatWindow to reduce file size
import React from "react";
import SugestorRespostaBroadcast from './SugestorRespostaBroadcast';
import MensagemReativacaoRapida from './MensagemReativacaoRapida';
import { toast } from "sonner";

export default function ChatSuggestions({
  thread,
  ultimaMensagemCliente,
  mostrarSugestor,
  mostrarReativacaoRapida,
  contatoCompleto,
  analiseComportamental,
  usuario,
  onFecharReativacao
}) {
  return (
    <>
      {/* NÍVEL 0: Resposta a Broadcast */}
      {thread?.metadata?.broadcast_data && ultimaMensagemCliente && !mostrarSugestor && !mostrarReativacaoRapida && (
        <div className="px-3 pb-3">
          <div className="mb-2 flex items-center gap-2 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></div>
            <p className="text-xs text-cyan-700 font-medium">
              📤 Cliente respondeu ao broadcast! Sugestões inteligentes abaixo:
            </p>
          </div>
          <SugestorRespostaBroadcast
            thread={thread}
            ultimaMensagemCliente={ultimaMensagemCliente}
            contato={contatoCompleto}
            usuario={usuario}
            onSugerirResposta={(resposta) => {
              navigator.clipboard.writeText(resposta);
              toast.success('✅ Resposta copiada! Cole no campo de mensagem.');
            }}
          />
        </div>
      )}

      {/* NÍVEL 1: Reativação Rápida */}
      {mostrarReativacaoRapida && !mostrarSugestor && !thread?.metadata?.ultima_mensagem_origem === 'broadcast_massa' && analiseComportamental && (
        <div className="px-3 pb-3">
          <div className="mb-2 flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
            <p className="text-xs text-blue-700 font-medium">
              💡 Sequência 1: Reativação instantânea (sem análise)
            </p>
          </div>
          <MensagemReativacaoRapida
            contato={contatoCompleto}
            analise={analiseComportamental}
            variant="inline"
            onUsarMensagem={(mensagem) => {
              onFecharReativacao();
              toast.success('⚡ Mensagem instantânea copiada! Cole no campo abaixo.');
              navigator.clipboard.writeText(mensagem);
            }}
          />
        </div>
      )}
    </>
  );
}