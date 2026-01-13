import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Search, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticoBuscaGlobal({ contactId, threadId }) {
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [expandido, setExpandido] = useState(false);

  const executarBusca = async () => {
    if (!contactId) {
      toast.error('Contato não identificado');
      return;
    }

    setBuscando(true);
    try {
      // 🔍 BUSCA GLOBAL: Todas as mensagens RECEBIDAS deste contato (qualquer thread)
      const mensagensRecebidas = await base44.entities.Message.filter(
        { 
          sender_type: 'contact',
          sender_id: contactId
        },
        '-sent_at',
        100 // Buscar até 100 mensagens
      );

      console.log('[DIAGNÓSTICO GLOBAL] Total encontrado:', mensagensRecebidas.length);

      // Agrupar por thread
      const porThread = {};
      mensagensRecebidas.forEach(m => {
        if (!porThread[m.thread_id]) {
          porThread[m.thread_id] = [];
        }
        porThread[m.thread_id].push(m);
      });

      const threadIds = Object.keys(porThread);
      const temNaThreadAtual = porThread[threadId]?.length || 0;
      const emOutrasThreads = threadIds.filter(tid => tid !== threadId).length;

      setResultado({
        totalEncontrado: mensagensRecebidas.length,
        naThreadAtual: temNaThreadAtual,
        emOutrasThreads: emOutrasThreads,
        threads: porThread,
        threadIds: threadIds,
        mensagens: mensagensRecebidas
      });

    } catch (error) {
      console.error('[DIAGNÓSTICO] Erro:', error);
      toast.error(`Erro: ${error.message}`);
      setResultado({ erro: error.message });
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-yellow-600" />
        <span className="text-sm font-semibold text-yellow-900">Diagnóstico: Mensagens Inbound Desaparecidas</span>
      </div>

      <p className="text-xs text-yellow-800">
        Buscar TODAS as mensagens recebidas deste contato em QUALQUER thread (detectar duplicatas/perdas)
      </p>

      <Button
        onClick={executarBusca}
        disabled={buscando}
        size="sm"
        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
      >
        <Search className="h-4 w-4 mr-2" />
        {buscando ? 'Buscando...' : 'Executar Busca Global'}
      </Button>

      {resultado && !resultado.erro && (
        <div className="space-y-2 rounded bg-white p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600">{resultado.totalEncontrado}</div>
              <div className="text-xs text-gray-600">Total Encontrado</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">{resultado.naThreadAtual}</div>
              <div className="text-xs text-gray-600">Nesta Thread</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-600">{resultado.emOutrasThreads}</div>
              <div className="text-xs text-gray-600">Em Outras Threads</div>
            </div>
          </div>

          {resultado.emOutrasThreads > 0 && (
            <div className="rounded bg-orange-100 p-2 border-l-4 border-orange-500">
              <div className="text-xs font-semibold text-orange-900">⚠️ DUPLICATA DETECTADA!</div>
              <p className="text-xs text-orange-800 mt-1">
                {resultado.emOutrasThreads} thread(s) contêm mensagens deste contato. Possível duplicação.
              </p>
            </div>
          )}

          {resultado.totalEncontrado === 0 && (
            <div className="rounded bg-red-100 p-2 border-l-4 border-red-500">
              <div className="text-xs font-semibold text-red-900">❌ NENHUMA MENSAGEM ENCONTRADA</div>
              <p className="text-xs text-red-800 mt-1">
                Este contato nunca enviou mensagens. Webhook pode estar falhando.
              </p>
            </div>
          )}

          {resultado.totalEncontrado > 0 && resultado.naThreadAtual === 0 && (
            <div className="rounded bg-red-100 p-2 border-l-4 border-red-500">
              <div className="text-xs font-semibold text-red-900">🔀 MENSAGENS EM OUTRA THREAD</div>
              <p className="text-xs text-red-800 mt-1">
                Todas as {resultado.totalEncontrado} mensagens deste contato estão em thread(s) diferente(s).
              </p>
            </div>
          )}

          {/* Lista de Threads com Mensagens */}
          <div className="space-y-1">
            {resultado.threadIds.map(tid => (
              <div key={tid} className="rounded bg-gray-100 p-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-gray-700">{tid.substring(0, 12)}...</span>
                  <span className={`font-bold ${tid === threadId ? 'text-green-600' : 'text-orange-600'}`}>
                    {resultado.threads[tid].length} msg
                  </span>
                </div>
                {tid === threadId && <span className="text-green-700">✅ This thread</span>}
                
                {/* Amostra de mensagens */}
                <div className="space-y-0.5 mt-1 max-h-24 overflow-y-auto">
                  {resultado.threads[tid].slice(0, 3).map(m => (
                    <div key={m.id} className="text-gray-600 italic text-[11px]">
                      {m.sent_at.substring(11, 16)} - {m.content.substring(0, 50)}...
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Exportar para Console */}
          <Button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(resultado.mensagens, null, 2));
              toast.success('Dados copiados para clipboard');
            }}
            variant="outline"
            size="sm"
            className="w-full mt-2"
          >
            <Copy className="h-3 w-3 mr-2" />
            Copiar Dados (JSON)
          </Button>
        </div>
      )}

      {resultado?.erro && (
        <div className="rounded bg-red-100 p-2 border-l-4 border-red-500">
          <div className="text-xs font-semibold text-red-900">Erro na busca</div>
          <p className="text-xs text-red-800 mt-1">{resultado.erro}</p>
        </div>
      )}
    </div>
  );
}