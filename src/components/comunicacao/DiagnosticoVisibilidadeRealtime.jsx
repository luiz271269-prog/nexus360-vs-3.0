import React, { useState, useEffect } from 'react';
import { Eye, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Diagnóstico Visual em Tempo Real
 * Mostra qual thread está aberto vs qual thread recebeu mensagem
 * 
 * Props:
 * - threadId: ID da thread atualmente aberta
 * - ultimaMensagemRecebida: Objeto da última mensagem recebida
 * - filtros: Filtros ativos na UI
 * - realTimeActive: Se real-time subscription está ativo
 */
export default function DiagnosticoVisibilidadeRealtime({
  threadId,
  ultimaMensagemRecebida,
  filtros = {},
  realTimeActive = false
}) {
  const [historico, setHistorico] = useState([]);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    if (ultimaMensagemRecebida) {
      const novo = {
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        conteudo: ultimaMensagemRecebida.content?.substring(0, 50),
        threadRecebida: ultimaMensagemRecebida.thread_id,
        threadAtual: threadId,
        corresponde: ultimaMensagemRecebida.thread_id === threadId,
        senderType: ultimaMensagemRecebida.sender_type,
        visibility: ultimaMensagemRecebida.visibility
      };

      setHistorico(prev => [novo, ...prev].slice(0, 5));
    }
  }, [ultimaMensagemRecebida, threadId]);

  const corresponde = ultimaMensagemRecebida?.thread_id === threadId;
  const estaVisivel = ultimaMensagemRecebida?.visibility === 'public_to_customer';

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-md">
      <Card className="bg-slate-900 border-slate-700 text-white shadow-xl">
        <CardHeader className="p-3 pb-2 cursor-pointer hover:bg-slate-800" onClick={() => setExpandido(!expandido)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-xs">Diagnóstico Realtime</CardTitle>
            </div>
            <div className="flex gap-1">
              {realTimeActive && (
                <Badge className="bg-green-900 text-green-200 text-[10px]">
                  <Zap className="h-2 w-2 mr-1" />
                  ON
                </Badge>
              )}
              <Badge className={`text-[10px] ${corresponde ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                {corresponde ? '✓ Match' : '✗ Mismatch'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        {expandido && (
          <CardContent className="p-3 space-y-3 text-xs max-h-96 overflow-y-auto">
            {/* Status Geral */}
            <div className="space-y-2 border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                {corresponde ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-400" />
                )}
                <span className="font-mono">
                  {corresponde ? 'Thread: MATCH ✓' : 'Thread: MISMATCH ✗'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {estaVisivel ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-400" />
                )}
                <span className="font-mono">
                  Visibilidade: {ultimaMensagemRecebida?.visibility || 'N/A'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {realTimeActive ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                )}
                <span className="font-mono">
                  Real-time: {realTimeActive ? 'ATIVO' : 'INATIVO'}
                </span>
              </div>
            </div>

            {/* Thread Comparação */}
            <div className="space-y-1 border-b border-slate-700 pb-3">
              <div className="text-slate-400">Thread Aberto:</div>
              <div className="font-mono bg-slate-800 p-2 rounded text-[10px] break-all">
                {threadId || 'NENHUM'}
              </div>

              <div className="text-slate-400 mt-2">Thread da Mensagem:</div>
              <div className="font-mono bg-slate-800 p-2 rounded text-[10px] break-all">
                {ultimaMensagemRecebida?.thread_id || 'NENHUM'}
              </div>
            </div>

            {/* Filtros */}
            {Object.keys(filtros).length > 0 && (
              <div className="space-y-1 border-b border-slate-700 pb-3">
                <div className="text-slate-400">Filtros Ativos:</div>
                <div className="space-y-1">
                  {Object.entries(filtros).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-slate-300">
                      <span>{key}:</span>
                      <span className="font-mono">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico */}
            {historico.length > 0 && (
              <div className="space-y-1">
                <div className="text-slate-400 font-semibold">Histórico (últimas 5):</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {historico.map((evento, idx) => (
                    <div
                      key={idx}
                      className={`p-1.5 rounded border text-[9px] ${
                        evento.corresponde
                          ? 'bg-green-900/20 border-green-700'
                          : 'bg-red-900/20 border-red-700'
                      }`}
                    >
                      <div className="font-mono text-slate-300">{evento.timestamp}</div>
                      <div className="text-slate-400">{evento.conteudo}</div>
                      <div className="flex justify-between mt-1 text-slate-500">
                        <span>{evento.corresponde ? '✓' : '✗'}</span>
                        <span>{evento.senderType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}