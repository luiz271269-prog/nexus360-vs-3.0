import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * 🚨 DETECTOR DE MISMATCH EM TEMPO REAL
 * 
 * Detecta quando a thread aberta na UI (threadId) é diferente da thread 
 * onde a mensagem realmente foi salva (ultimaMensagemRecebida.thread_id).
 * 
 * Isso acontece quando o backend faz auto-merge para canônica,
 * mas o usuário continua visualizando uma thread antiga/merged.
 * 
 * Solução: Oferece botão para pular para a thread real (canônica).
 */
export default function DiagnosticoVisibilidadeRealtime({ 
  threadId, 
  ultimaMensagemRecebida,
  realTimeActive = false,
  onCorrigirThread // Callback: (idThreadReal) => void
}) {
  const [hasMismatch, setHasMismatch] = useState(false);
  const [threadReal, setThreadReal] = useState(null);

  useEffect(() => {
    // Se não há mensagem ou não está em real-time, não fazer nada
    if (!ultimaMensagemRecebida || !realTimeActive || !threadId) {
      setHasMismatch(false);
      setThreadReal(null);
      return;
    }

    const msgThreadId = ultimaMensagemRecebida.thread_id;
    
    // Detectar incompatibilidade
    if (msgThreadId && msgThreadId !== threadId) {
      console.error(`[DIAGNÓSTICO] 🚨 MISMATCH DETECTADO!`);
      console.error(`  👀 Vendo (UI):   ${threadId}`);
      console.error(`  💾 Real (DB):    ${msgThreadId}`);
      console.error(`  📄 Conteúdo:     "${ultimaMensagemRecebida.content?.substring(0, 50)}..."`);
      
      setHasMismatch(true);
      setThreadReal(msgThreadId);
    } else {
      setHasMismatch(false);
      setThreadReal(null);
    }
  }, [ultimaMensagemRecebida, threadId, realTimeActive]);

  // Se não há mismatch, não renderizar nada (silencioso)
  if (!hasMismatch || !threadReal) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-2xl border bg-red-900/95 border-red-500 backdrop-blur-md w-96 animate-in slide-in-from-bottom-5">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white font-bold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
          DESINCRONIA DETECTADA
        </h4>
        <Badge variant="destructive" className="animate-pulse">MISMATCH</Badge>
      </div>

      {/* Descrição do Problema */}
      <div className="space-y-3 text-xs text-slate-200">
        <div className="bg-black/40 p-3 rounded border border-white/10">
          <p className="text-red-200 mb-3 leading-relaxed">
            Você está visualizando uma thread antiga/mesclada, mas a mensagem nova chegou na <strong>thread canônica</strong>.
          </p>
          
          <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
            <div className="bg-red-950/50 p-2 rounded border border-red-700/50">
              <span className="block text-slate-400 mb-1">❌ Vendo (UI):</span>
              <span className="text-yellow-300 break-all">...{threadId.slice(-8)}</span>
            </div>
            <div className="bg-emerald-950/50 p-2 rounded border border-emerald-700/50">
              <span className="block text-slate-400 mb-1">✅ Real (DB):</span>
              <span className="text-emerald-300 break-all">...{threadReal.slice(-8)}</span>
            </div>
          </div>
        </div>

        {/* Botão de Correção */}
        <Button 
          onClick={() => {
            console.log(`[AUTO-FIX] 🔄 Usuário clicou para corrigir: ${threadReal}`);
            onCorrigirThread && onCorrigirThread(threadReal);
          }}
          className="w-full bg-white text-red-900 hover:bg-slate-200 font-bold shadow-lg transition-all"
        >
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          Ir para Conversa Atual
        </Button>

        {/* Aviso Técnico */}
        <p className="text-slate-400 text-[9px] text-center italic">
          O backend mesclou threads automaticamente. Clique acima para sincronizar a tela.
        </p>
      </div>
    </div>
  );
}