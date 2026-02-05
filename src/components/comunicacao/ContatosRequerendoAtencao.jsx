import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  AlertTriangle, 
  Target, 
  Clock, 
  TrendingDown,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Loader2,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

export default function ContatosRequerendoAtencao({ usuario, contatos, onSelecionarContato, variant = 'sidebar' }) {
  const [loading, setLoading] = useState(false);
  const [contatosComAlerta, setContatosComAlerta] = useState([]);
  const [expandido, setExpandido] = useState(false);
  const [agrupadoPor, setAgrupadoPor] = useState('topico'); // 'topico' ou 'usuario'
  const isHeader = variant === 'header';

  useEffect(() => {
    if (expandido) {
      carregarContatosComAlerta();
    }
  }, [expandido]);

  const carregarContatosComAlerta = async () => {
    setLoading(true);
    try {
      // Buscar análises comportamentais com alertas
      const analisesRecentes = await base44.entities.ContactBehaviorAnalysis.filter(
        {
          ultima_analise: { 
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() 
          }
        },
        '-ultima_analise',
        100
      );

      // Processar e extrair contatos com alertas críticos
      const contatosProcessados = await Promise.all(
        analisesRecentes.map(async (analise) => {
          try {
            const contato = contatos.find(c => c.id === analise.contact_id);
            if (!contato) return null;

            // Buscar thread para verificar atendente
            const threads = await base44.entities.MessageThread.filter(
              { contact_id: analise.contact_id, status: 'aberta' },
              '-last_message_at',
              1
            );

            const thread = threads[0];

            // Verificar condições críticas baseadas nas métricas
            const alertas = [];

            // Score baixo
            if (analise.score_engajamento < 40) {
              alertas.push({
                tipo: 'score_baixo',
                nivel: 'alto',
                mensagem: `Score muito baixo (${analise.score_engajamento}/100)`,
                topico: 'Engajamento Crítico'
              });
            }

            // Sentimento negativo
            if (analise.analise_sentimento?.score_sentimento < 40) {
              alertas.push({
                tipo: 'sentimento_negativo',
                nivel: 'alto',
                mensagem: 'Sentimento negativo detectado',
                topico: 'Risco de Churn'
              });
            }

            // Lead quente sem ação
            if (analise.segmento_sugerido === 'lead_quente') {
              const diasSemResposta = thread?.last_inbound_at 
                ? Math.floor((Date.now() - new Date(thread.last_inbound_at).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              
              if (diasSemResposta > 2) {
                alertas.push({
                  tipo: 'lead_quente_parado',
                  nivel: 'alto',
                  mensagem: `Lead quente parado há ${diasSemResposta} dias`,
                  topico: 'Oportunidade Esfriando'
                });
              }
            }

            // Risco de churn
            if (analise.segmento_sugerido === 'risco_churn') {
              alertas.push({
                tipo: 'risco_churn',
                nivel: 'critico',
                mensagem: 'Cliente em risco de cancelamento',
                topico: 'Risco de Churn'
              });
            }

            // Cliente inativo que foi ativo
            if (analise.segmento_sugerido === 'cliente_inativo' && analise.metricas_engajamento?.total_mensagens > 10) {
              alertas.push({
                tipo: 'cliente_inativo',
                nivel: 'medio',
                mensagem: 'Cliente ativo agora inativo',
                topico: 'Reativação Necessária'
              });
            }

            if (alertas.length === 0) return null;

            return {
              contato,
              thread,
              analise,
              alertas,
              atendente_id: thread?.assigned_user_id || null,
              prioridade: alertas.some(a => a.nivel === 'critico') ? 1 : 
                         alertas.some(a => a.nivel === 'alto') ? 2 : 3
            };
          } catch (error) {
            console.error('Erro ao processar análise:', error);
            return null;
          }
        })
      );

      const contatosValidos = contatosProcessados.filter(c => c !== null);
      
      // Ordenar por prioridade
      contatosValidos.sort((a, b) => a.prioridade - b.prioridade);

      setContatosComAlerta(contatosValidos);
    } catch (error) {
      console.error('Erro ao carregar contatos com alerta:', error);
      toast.error('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar por tópico
  const agruparPorTopico = () => {
    const grupos = {};
    
    contatosComAlerta.forEach(item => {
      item.alertas.forEach(alerta => {
        if (!grupos[alerta.topico]) {
          grupos[alerta.topico] = [];
        }
        grupos[alerta.topico].push({ ...item, alertaAtual: alerta });
      });
    });

    return grupos;
  };

  // Agrupar por usuário
  const agruparPorUsuario = () => {
    const grupos = {
      'Não atribuídas': [],
      ...Object.fromEntries(
        [...new Set(contatosComAlerta.map(c => c.atendente_id).filter(Boolean))].map(id => [id, []])
      )
    };

    contatosComAlerta.forEach(item => {
      const key = item.atendente_id || 'Não atribuídas';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(item);
    });

    return grupos;
  };

  const grupos = agrupadoPor === 'topico' ? agruparPorTopico() : agruparPorUsuario();
  const totalAlertas = contatosComAlerta.reduce((sum, c) => sum + c.alertas.length, 0);

  const getNivelCor = (nivel) => {
    switch (nivel) {
      case 'critico': return 'bg-red-500';
      case 'alto': return 'bg-orange-500';
      case 'medio': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  // Versão Header (compacta para o topo)
  if (isHeader) {
    return (
      <div className="relative">
        <Button
          onClick={() => setExpandido(!expandido)}
          variant="outline"
          size="sm"
          className="border-white/30 text-white hover:bg-white/20 shadow-lg relative"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <AlertTriangle className="w-4 h-4 mr-2" />
          )}
          Contatos Requerendo Atenção
          {totalAlertas > 0 && (
            <Badge className="ml-2 bg-red-500 text-white font-bold text-xs">
              {totalAlertas}
            </Badge>
          )}
        </Button>

        {/* Dropdown expandido */}
        {expandido && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setExpandido(false)}
            />
            <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
              {/* Header do dropdown */}
              <div className="px-3 py-2 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={agrupadoPor === 'topico' ? 'default' : 'outline'}
                    onClick={() => setAgrupadoPor('topico')}
                    className="h-6 text-xs px-2"
                  >
                    Por Tópico
                  </Button>
                  <Button
                    size="sm"
                    variant={agrupadoPor === 'usuario' ? 'default' : 'outline'}
                    onClick={() => setAgrupadoPor('usuario')}
                    className="h-6 text-xs px-2"
                  >
                    Por Atendente
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={carregarContatosComAlerta}
                  disabled={loading}
                  className="h-6 text-xs px-2"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Lista de grupos */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Analisando contatos...</p>
                  </div>
                ) : totalAlertas === 0 ? (
                  <div className="p-4 text-center">
                    <Target className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">Tudo sob controle!</p>
                    <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção imediata</p>
                  </div>
                ) : (
                  Object.entries(grupos).map(([nomeGrupo, items]) => {
                    if (!items || items.length === 0) return null;

                    const [grupoExpandido, setGrupoExpandido] = useState(true);

                    return (
                      <div key={nomeGrupo} className="border-b border-slate-100">
                        {/* Header do grupo */}
                        <button
                          onClick={() => setGrupoExpandido(!grupoExpandido)}
                          className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">
                              {agrupadoPor === 'usuario' && nomeGrupo !== 'Não atribuídas' 
                                ? items[0]?.thread?.assigned_user_display_name || nomeGrupo
                                : nomeGrupo
                              }
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {items.length}
                            </Badge>
                          </div>
                          {grupoExpandido ? (
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          )}
                        </button>

                        {/* Items do grupo */}
                        {grupoExpandido && (
                          <div className="bg-slate-50/50">
                            {items.map(item => {
                              const alerta = item.alertaAtual || item.alertas[0];
                              const contato = item.contato;

                              return (
                                <button
                                  key={`${item.contato.id}-${alerta.tipo}`}
                                  onClick={() => {
                                    if (onSelecionarContato && item.thread) {
                                      onSelecionarContato(item.thread);
                                      setExpandido(false);
                                    }
                                  }}
                                  className="w-full px-4 py-2 flex items-start gap-2 hover:bg-white transition-colors border-b border-slate-100 last:border-b-0"
                                >
                                  {/* Indicador de nível */}
                                  <div className={`w-1 h-full absolute left-0 ${getNivelCor(alerta.nivel)}`} />
                                  
                                  {/* Avatar */}
                                  <div className="relative flex-shrink-0 mt-0.5">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-gradient-to-br from-orange-400 to-red-500">
                                      {contato.foto_perfil_url ? (
                                        <img
                                          src={contato.foto_perfil_url}
                                          alt={contato.nome}
                                          className="w-full h-full object-cover rounded-full"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.parentElement.textContent = contato.nome?.charAt(0)?.toUpperCase() || '?';
                                          }}
                                        />
                                      ) : (
                                        contato.nome?.charAt(0)?.toUpperCase() || '?'
                                      )}
                                    </div>
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <p className="font-medium text-xs text-slate-800 truncate">
                                        {contato.empresa || contato.nome}
                                      </p>
                                    </div>

                                    <p className="text-xs text-slate-600 mb-1">
                                      {alerta.mensagem}
                                    </p>

                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Badge className={`${getNivelCor(alerta.nivel)} text-white text-[9px] px-1 py-0`}>
                                        {alerta.nivel}
                                      </Badge>
                                      
                                      {item.analise.score_engajamento && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                                          Score: {item.analise.score_engajamento}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* Ação sugerida (ícone) */}
                                  <div className="flex-shrink-0">
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Versão Sidebar (original)
  return (
    <div className="border-b border-slate-200 bg-white">
      {/* Header clicável */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="font-semibold text-sm text-slate-800">
            Contatos Requerendo Atenção
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {totalAlertas > 0 && (
            <Badge className="bg-red-500 text-white font-bold text-xs">
              {totalAlertas}
            </Badge>
          )}
          
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : expandido ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Conteúdo expandido */}
      {expandido && (
        <div className="border-t border-slate-200">
          {/* Toggle de agrupamento */}
          <div className="px-3 py-2 flex items-center justify-between bg-slate-50 border-b border-slate-200">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={agrupadoPor === 'topico' ? 'default' : 'outline'}
                onClick={() => setAgrupadoPor('topico')}
                className="h-6 text-xs px-2"
              >
                Por Tópico
              </Button>
              <Button
                size="sm"
                variant={agrupadoPor === 'usuario' ? 'default' : 'outline'}
                onClick={() => setAgrupadoPor('usuario')}
                className="h-6 text-xs px-2"
              >
                Por Atendente
              </Button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={carregarContatosComAlerta}
              disabled={loading}
              className="h-6 text-xs px-2"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Lista de grupos */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Analisando contatos...</p>
              </div>
            ) : totalAlertas === 0 ? (
              <div className="p-4 text-center">
                <Target className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Tudo sob controle!</p>
                <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção imediata</p>
              </div>
            ) : (
              Object.entries(grupos).map(([nomeGrupo, items]) => {
                if (!items || items.length === 0) return null;

                const [grupoExpandido, setGrupoExpandido] = useState(true);

                return (
                  <div key={nomeGrupo} className="border-b border-slate-100">
                    {/* Header do grupo */}
                    <button
                      onClick={() => setGrupoExpandido(!grupoExpandido)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">
                          {agrupadoPor === 'usuario' && nomeGrupo !== 'Não atribuídas' 
                            ? items[0]?.thread?.assigned_user_display_name || nomeGrupo
                            : nomeGrupo
                          }
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {items.length}
                        </Badge>
                      </div>
                      {grupoExpandido ? (
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                      )}
                    </button>

                    {/* Items do grupo */}
                    {grupoExpandido && (
                      <div className="bg-slate-50/50">
                        {items.map(item => {
                          const alerta = item.alertaAtual || item.alertas[0];
                          const contato = item.contato;

                          return (
                            <button
                              key={`${item.contato.id}-${alerta.tipo}`}
                              onClick={() => {
                                if (onSelecionarContato && item.thread) {
                                  onSelecionarContato(item.thread);
                                  setExpandido(false);
                                }
                              }}
                              className="w-full px-4 py-2 flex items-start gap-2 hover:bg-white transition-colors border-b border-slate-100 last:border-b-0"
                            >
                              {/* Indicador de nível */}
                              <div className={`w-1 h-full absolute left-0 ${getNivelCor(alerta.nivel)}`} />
                              
                              {/* Avatar */}
                              <div className="relative flex-shrink-0 mt-0.5">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-gradient-to-br from-orange-400 to-red-500">
                                  {contato.foto_perfil_url ? (
                                    <img
                                      src={contato.foto_perfil_url}
                                      alt={contato.nome}
                                      className="w-full h-full object-cover rounded-full"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.textContent = contato.nome?.charAt(0)?.toUpperCase() || '?';
                                      }}
                                    />
                                  ) : (
                                    contato.nome?.charAt(0)?.toUpperCase() || '?'
                                  )}
                                </div>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <p className="font-medium text-xs text-slate-800 truncate">
                                    {contato.empresa || contato.nome}
                                  </p>
                                </div>

                                <p className="text-xs text-slate-600 mb-1">
                                  {alerta.mensagem}
                                </p>

                                <div className="flex items-center gap-1 flex-wrap">
                                  <Badge className={`${getNivelCor(alerta.nivel)} text-white text-[9px] px-1 py-0`}>
                                    {alerta.nivel}
                                  </Badge>
                                  
                                  {item.analise.score_engajamento && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                                      Score: {item.analise.score_engajamento}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Ação sugerida (ícone) */}
                              <div className="flex-shrink-0">
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}