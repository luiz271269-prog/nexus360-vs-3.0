import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Users,
  Zap,
  AlertCircle,
  TrendingUp,
  Phone,
  RefreshCw,
  UserPlus,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import SeletorEstrategia from './SeletorEstrategia';

export default function VisualizadorFilas({ onSelecionarThread, usuarioAtual }) {
  const [filas, setFilas] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [atribuindo, setAtribuindo] = useState(null);
  const [estrategia, setEstrategia] = useState('prioridade');

  useEffect(() => {
    carregarFilas();
    const interval = setInterval(carregarFilas, 10000); // Atualiza a cada 10s
    return () => clearInterval(interval);
  }, []);

  const carregarFilas = async () => {
    try {
      const [filaResult, statsResult] = await Promise.all([
        base44.functions.invoke('gerenciarFila', { action: 'list' }),
        base44.functions.invoke('gerenciarFila', { action: 'estatisticas' })
      ]);

      if (filaResult.data.success) {
        setFilas(filaResult.data.fila || []);
      }

      if (statsResult.data.success) {
        setEstatisticas(statsResult.data.estatisticas);
      }

    } catch (error) {
      console.error('[VISUALIZADOR-FILAS] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  const atenderProximo = async (setor) => {
    if (!usuarioAtual?.id) {
      toast.error('Usuário não identificado');
      return;
    }

    setAtribuindo(setor);

    try {
      const result = await base44.functions.invoke('gerenciarFila', {
        action: 'dequeue',
        setor: setor,
        atendente_id: usuarioAtual.id,
        atendente_nome: usuarioAtual.full_name,
        estrategia: estrategia
      });

      if (result.data.success && result.data.thread_id) {
        toast.success(`✅ Conversa atribuída! Tempo de espera: ${result.data.tempo_espera_segundos}s`);
        
        // Buscar a thread completa e selecionar
        const thread = await base44.entities.MessageThread.get(result.data.thread_id);
        if (onSelecionarThread) {
          onSelecionarThread(thread);
        }
        
        // Recarregar filas
        carregarFilas();
      } else {
        toast.info('Nenhuma conversa na fila do setor ' + setor);
      }

    } catch (error) {
      console.error('[VISUALIZADOR-FILAS] Erro ao atender:', error);
      toast.error('Erro ao atribuir conversa: ' + error.message);
    } finally {
      setAtribuindo(null);
    }
  };

  const removerDaFila = async (threadId) => {
    try {
      await base44.functions.invoke('gerenciarFila', {
        action: 'remover',
        thread_id: threadId,
        motivo: 'cancelado'
      });

      toast.success('Removido da fila');
      carregarFilas();
    } catch (error) {
      toast.error('Erro ao remover: ' + error.message);
    }
  };

  const getPrioridadeColor = (prioridade) => {
    const colors = {
      urgente: 'bg-red-500 text-white',
      alta: 'bg-orange-500 text-white',
      normal: 'bg-blue-500 text-white',
      baixa: 'bg-slate-500 text-white'
    };
    return colors[prioridade] || 'bg-slate-500 text-white';
  };

  const getTempoEsperaColor = (segundos) => {
    if (segundos > 600) return 'text-red-600'; // > 10min
    if (segundos > 300) return 'text-orange-600'; // > 5min
    if (segundos > 120) return 'text-yellow-600'; // > 2min
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  const setores = ['geral', 'vendas', 'assistencia', 'financeiro', 'fornecedor'];

  return (
    <div className="space-y-6">
      {/* SELETOR DE ESTRATÉGIA */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Estratégia de Atendimento</h3>
        <SeletorEstrategia 
          estrategiaAtual={estrategia}
          onMudarEstrategia={setEstrategia}
          disabled={loading || atribuindo}
        />
      </div>

      {/* ESTATÍSTICAS GERAIS */}
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total na Fila
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-900">{estatisticas.total_na_fila}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Tempo Médio Espera
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-900">
                {Math.floor(estatisticas.tempo_medio_espera_segundos / 60)}min
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Espera &gt; 5min
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-900">{estatisticas.threads_acima_5min}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-purple-700 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Urgentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-900">
                {estatisticas.por_prioridade.urgente + estatisticas.por_prioridade.alta}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FILAS POR SETOR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {setores.map(setor => {
          const threadsDoSetor = filas.filter(f => f.setor === setor);
          const count = threadsDoSetor.length;

          if (count === 0) return null;

          return (
            <Card key={setor} className="bg-white border-slate-200">
              <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-slate-900 capitalize flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    Fila {setor}
                  </CardTitle>
                  
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500 text-white">{count}</Badge>
                    <Button
                      size="sm"
                      onClick={() => atenderProximo(setor)}
                      disabled={atribuindo === setor}
                      className="bg-green-600 hover:bg-green-700 h-8"
                    >
                      {atribuindo === setor ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-1" />
                          Atender Próximo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {threadsDoSetor.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => {
                        // Navegar para a thread
                        if (onSelecionarThread && item.thread_id) {
                          base44.entities.MessageThread.get(item.thread_id)
                            .then(thread => onSelecionarThread(thread))
                            .catch(err => toast.error('Erro ao carregar thread'));
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {item.posicao_fila || index + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-slate-900 text-sm truncate">
                                {item.metadata?.cliente_nome || 'Cliente'}
                              </h4>
                              <Badge className={getPrioridadeColor(item.prioridade)}>
                                {item.prioridade}
                              </Badge>
                            </div>

                            <p className="text-xs text-slate-600 truncate mb-1">
                              {item.metadata?.cliente_telefone || ''}
                            </p>

                            <p className="text-xs text-slate-500 line-clamp-2">
                              {item.metadata?.ultima_mensagem_preview || ''}
                            </p>

                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Phone className="w-3 h-3" />
                                {item.nome_conexao}
                              </div>
                              
                              <div className={`flex items-center gap-1 text-xs font-semibold ${getTempoEsperaColor(item.tempo_espera_segundos)}`}>
                                <Clock className="w-3 h-3" />
                                {item.tempo_espera_formatado}
                              </div>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removerDaFila(item.thread_id);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filas.length === 0 && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">
              Nenhuma conversa na fila
            </h3>
            <p className="text-sm text-slate-500">
              As novas conversas não atribuídas aparecerão aqui automaticamente
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}