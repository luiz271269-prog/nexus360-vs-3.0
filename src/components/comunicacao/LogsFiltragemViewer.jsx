import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Filter, Search, RefreshCw } from 'lucide-react';

export default function LogsFiltragemViewer() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [filtroThreadId, setFiltroThreadId] = useState('');

  const recarregar = () => {
    const dados = window._diagnosticoData;
    if (dados) {
      setLogs(dados.logsFiltragem || []);
      setStats(dados.estatisticas || null);
    }
  };

  useEffect(() => {
    recarregar();
    
    // Auto-recarregar a cada 5s
    const interval = setInterval(recarregar, 5000);
    return () => clearInterval(interval);
  }, []);

  // Agrupar logs por thread
  const logsPorThread = logs.reduce((acc, log) => {
    if (!acc[log.threadId]) {
      acc[log.threadId] = [];
    }
    acc[log.threadId].push(log);
    return acc;
  }, {});

  // Filtrar por threadId se necessário
  const threadsFiltradas = filtroThreadId
    ? Object.keys(logsPorThread).filter(tid => tid.includes(filtroThreadId))
    : Object.keys(logsPorThread);

  // Separar aprovadas vs bloqueadas
  const aprovadas = [];
  const bloqueadas = [];

  threadsFiltradas.forEach(threadId => {
    const logsThread = logsPorThread[threadId];
    const temBloqueio = logsThread.some(l => !l.passou);
    
    if (temBloqueio) {
      bloqueadas.push({ threadId, logs: logsThread });
    } else {
      aprovadas.push({ threadId, logs: logsThread });
    }
  });

  return (
    <Card className="border-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Logs Detalhados de Filtragem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-4 gap-2">
            <Card>
              <CardContent className="p-3">
                <div className="text-2xl font-bold">{stats.totalThreadsUnicas}</div>
                <div className="text-xs text-slate-500">Top 500</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-green-600">{stats.threadsFiltradas}</div>
                <div className="text-xs text-slate-500">Aprovadas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-red-600">{stats.bloqueadas}</div>
                <div className="text-xs text-slate-500">Bloqueadas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <Button onClick={recarregar} size="sm" variant="outline">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Atualizar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtro por Thread ID */}
        <div className="flex gap-2">
          <Input
            placeholder="Filtrar por Thread ID (primeiros caracteres)"
            value={filtroThreadId}
            onChange={(e) => setFiltroThreadId(e.target.value)}
            className="flex-1"
          />
          {filtroThreadId && (
            <Button onClick={() => setFiltroThreadId('')} variant="ghost" size="sm">
              Limpar
            </Button>
          )}
        </div>

        {/* Bloqueadas por Etapa */}
        {stats?.bloqueadasPorEtapa && Object.keys(stats.bloqueadasPorEtapa).length > 0 && (
          <div className="bg-red-50 border border-red-200 p-3 rounded">
            <div className="font-semibold text-red-700 mb-2">🚫 Resumo de Bloqueios:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(stats.bloqueadasPorEtapa).map(([etapa, count]) => (
                <div key={etapa} className="flex justify-between">
                  <span>{etapa}:</span>
                  <Badge variant="destructive" className="text-[10px]">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Threads Bloqueadas */}
        {bloqueadas.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-bold text-red-600 text-sm">❌ Threads Bloqueadas ({bloqueadas.length})</h3>
            {bloqueadas.map(({ threadId, logs }) => {
              const primeiroErro = logs.find(l => !l.passou);
              return (
                <Card key={threadId} className="border-red-300">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs">Thread: {threadId}</div>
                        <div className="font-mono text-[10px] text-slate-500">Contact: {logs[0]?.contactId}</div>
                      </div>
                      <Badge variant="destructive" className="text-[10px]">BLOQUEADA</Badge>
                    </div>
                    
                    {/* Primeira falha */}
                    <div className="bg-red-50 p-2 rounded text-xs">
                      <div className="font-semibold text-red-700">🚫 {primeiroErro?.etapa}</div>
                      <div className="text-red-600 text-[10px]">{primeiroErro?.motivo}</div>
                    </div>

                    {/* Todas as etapas */}
                    <details className="text-[10px]">
                      <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                        Ver todas as etapas ({logs.length})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {logs.map((log, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {log.passou ? 
                              <CheckCircle className="w-3 h-3 text-green-600" /> : 
                              <XCircle className="w-3 h-3 text-red-600" />
                            }
                            <span className={log.passou ? 'text-green-700' : 'text-red-700'}>
                              {log.etapa}
                            </span>
                            {log.motivo && <span className="text-slate-500">- {log.motivo}</span>}
                          </div>
                        ))}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Threads Aprovadas (compacto) */}
        {aprovadas.length > 0 && (
          <div>
            <h3 className="font-bold text-green-600 text-sm mb-2">✅ Threads Aprovadas ({aprovadas.length})</h3>
            <div className="text-xs text-slate-500">
              {aprovadas.length} threads passaram em todos os filtros
            </div>
          </div>
        )}

        {logs.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            Nenhum log disponível. Interaja com a barra de contatos para gerar logs.
          </div>
        )}
      </CardContent>
    </Card>
  );
}