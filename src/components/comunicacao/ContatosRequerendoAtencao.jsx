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
  const [gruposExpandidos, setGruposExpandidos] = useState({}); // ✅ FIX: Hook fora do map
  const isHeader = variant === 'header';

  // Toggle grupo expandido
  const toggleGrupo = (nomeGrupo) => {
    setGruposExpandidos(prev => ({
      ...prev,
      [nomeGrupo]: !prev[nomeGrupo]
    }));
  };

  useEffect(() => {
    if (expandido) {
      carregarContatosComAlerta();
    }
  }, [expandido]);

  const carregarContatosComAlerta = async () => {
    setLoading(true);
    try {
      // 1. BUSCAR TODOS CONTATOS DO USUÁRIO (leads e clientes)
      let queryContatos = {
        tipo_contato: { $in: ['lead', 'cliente'] }
      };
      
      if (usuario?.role !== 'admin') {
        queryContatos.vendedor_responsavel = usuario.id;
      }
      
      const contatosUsuario = await base44.entities.Contact.filter(
        queryContatos,
        '-ultima_interacao',
        100
      );
      
      if (contatosUsuario.length === 0) {
        setContatos([]);
        setLoading(false);
        return;
      }
      
      // 2. BUSCAR ANÁLISES EXISTENTES (últimas 24h)
      const contactIds = contatosUsuario.map(c => c.id);
      const analisesExistentes = await base44.entities.ContactBehaviorAnalysis.filter(
        {
          contact_id: { $in: contactIds },
          ultima_analise: { 
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() 
          }
        },
        '-ultima_analise',
        200
      );
      
      const analisesMap = new Map(analisesExistentes.map(a => [a.contact_id, a]));
      
      // 3. IDENTIFICAR CONTATOS SEM ANÁLISE RECENTE
      const contatosSemAnalise = contatosUsuario.filter(c => !analisesMap.has(c.id));
      
      // 4. EXECUTAR ANÁLISE EM LOTE PARA CONTATOS SEM ANÁLISE
      if (contatosSemAnalise.length > 0) {
        console.log(`[ContatosRequerendo] Analisando ${contatosSemAnalise.length} contatos sem análise recente...`);
        
        try {
          // Chamar função de análise em lote
          await base44.functions.invoke('analisarClientesEmLote', {
            contact_ids: contatosSemAnalise.map(c => c.id).slice(0, 20), // Máximo 20 por vez
            force: true
          });
          
          // Aguardar 2s para análises serem salvas
          await new Promise(r => setTimeout(r, 2000));
          
          // Buscar análises atualizadas
          const novasAnalises = await base44.entities.ContactBehaviorAnalysis.filter(
            {
              contact_id: { $in: contatosSemAnalise.map(c => c.id) }
            },
            '-ultima_analise',
            50
          );
          
          novasAnalises.forEach(a => analisesMap.set(a.contact_id, a));
        } catch (error) {
          console.warn('[ContatosRequerendo] Erro ao analisar em lote:', error.message);
        }
      }
      
      // 5. USAR ANÁLISES DISPONÍVEIS
      const analisesDoUsuario = Array.from(analisesMap.values());

      // ✅ FIX N+1: Buscar TODAS as threads em UMA query
      const contactIds = [...new Set(analisesRecentes.map(a => a.contact_id))];
      const todasThreads = await base44.entities.MessageThread.filter(
        { 
          contact_id: { $in: contactIds },
          status: 'aberta'
        },
        '-last_message_at',
        500
      );

      // Criar mapa contact_id -> thread mais recente
      const threadsMap = new Map();
      todasThreads.forEach(t => {
        if (!t.contact_id) return;
        const existing = threadsMap.get(t.contact_id);
        if (!existing || new Date(t.last_message_at) > new Date(existing.last_message_at)) {
          threadsMap.set(t.contact_id, t);
        }
      });

      // Processar análises (SEM queries adicionais)
      const contatosProcessados = analisesDoUsuario.map((analise) => {
        try {
          // Buscar contato do array de contatos do usuário
          const contato = contatosUsuario.find(c => c.id === analise.contact_id);
          if (!contato) return null;

          const thread = threadsMap.get(analise.contact_id);

          // ✅ PRIORIZAR insights do motor (se existir)
          let alertas = [];
          let scores = null;
          let nextAction = null;

          // Tentar usar insights do motor primeiro
          if (analise.insights?.alerts && analise.insights.alerts.length > 0) {
            // ✅ Usar alertas do motor
            alertas = analise.insights.alerts.map(a => ({
              tipo: a.reason?.toLowerCase().replace(/\s+/g, '_'),
              nivel: a.level,
              mensagem: a.reason,
              topico: a.reason.includes('follow-up') ? 'Follow-ups Sem Resposta' :
                      a.reason.includes('negociação') || a.reason.includes('parad') ? 'Negociação Estagnada' :
                      a.reason.includes('risco') ? 'Risco de Perda' :
                      a.reason.includes('reclamação') || a.reason.includes('sentimento') ? 'Risco de Churn' :
                      a.reason.includes('oportunidade') || a.reason.includes('quente') ? 'Oportunidade Esfriando' :
                      'Outros Alertas'
            }));

            scores = analise.insights.scores;
            nextAction = analise.insights.next_best_action;
          } else {
            // ✅ FALLBACK: Regras locais (compatibilidade com análises antigas)
            if (analise.score_engajamento < 40) {
              alertas.push({
                tipo: 'score_baixo',
                nivel: 'alto',
                mensagem: `Score muito baixo (${analise.score_engajamento}/100)`,
                topico: 'Engajamento Crítico'
              });
            }

            if (analise.analise_sentimento?.score_sentimento < 40) {
              alertas.push({
                tipo: 'sentimento_negativo',
                nivel: 'alto',
                mensagem: 'Sentimento negativo detectado',
                topico: 'Risco de Churn'
              });
            }

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

            if (analise.segmento_sugerido === 'risco_churn') {
              alertas.push({
                tipo: 'risco_churn',
                nivel: 'critico',
                mensagem: 'Cliente em risco de cancelamento',
                topico: 'Risco de Churn'
              });
            }

            if (analise.segmento_sugerido === 'cliente_inativo' && analise.metricas_engajamento?.total_mensagens > 10) {
              alertas.push({
                tipo: 'cliente_inativo',
                nivel: 'medio',
                mensagem: 'Cliente ativo agora inativo',
                topico: 'Reativação Necessária'
              });
            }
          }

          if (alertas.length === 0) return null;

          // Calcular prioridade baseada em scores do motor (se disponível)
          let prioridade = 3;
          if (alertas.some(a => a.nivel === 'critico')) prioridade = 1;
          else if (alertas.some(a => a.nivel === 'alto')) prioridade = 2;
          
          // Refinar com deal_risk (se disponível)
          if (scores?.deal_risk > 70) prioridade = Math.min(prioridade, 1);
          else if (scores?.deal_risk > 50) prioridade = Math.min(prioridade, 2);

          return {
            contato,
            thread,
            analise,
            alertas,
            scores,
            nextAction,
            atendente_id: thread?.assigned_user_id || null,
            prioridade,
            deal_risk: scores?.deal_risk || 0
          };
        } catch (error) {
          console.error('Erro ao processar análise:', error);
          return null;
        }
      });

      const contatosValidos = contatosProcessados.filter(c => c !== null);
      
      // ✅ Ordenar por: prioridade → deal_risk → score_engajamento
      contatosValidos.sort((a, b) => {
        if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
        if (a.deal_risk !== b.deal_risk) return b.deal_risk - a.deal_risk;
        return (a.analise.score_engajamento || 0) - (b.analise.score_engajamento || 0);
      });

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

                    const grupoExpandido = gruposExpandidos[nomeGrupo] !== false; // ✅ Default true

                    return (
                      <div key={nomeGrupo} className="border-b border-slate-100">
                        {/* Header do grupo */}
                        <button
                          onClick={() => toggleGrupo(nomeGrupo)}
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

                const grupoExpandido = gruposExpandidos[nomeGrupo] !== false;

                return (
                  <div key={nomeGrupo} className="border-b border-slate-100">
                    {/* Header do grupo */}
                    <button
                      onClick={() => toggleGrupo(nomeGrupo)}
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

                                {/* Próxima ação (se disponível) */}
                                {item.nextAction?.action && (
                                  <p className="text-xs text-green-700 font-medium mb-1">
                                    💡 {item.nextAction.action}
                                    {item.nextAction.deadline_hours && (
                                      <span className="text-slate-500 ml-1">({item.nextAction.deadline_hours}h)</span>
                                    )}
                                  </p>
                                )}

                                <div className="flex items-center gap-1 flex-wrap">
                                  <Badge className={`${getNivelCor(alerta.nivel)} text-white text-[9px] px-1 py-0`}>
                                    {alerta.nivel}
                                  </Badge>
                                  
                                  {item.scores?.deal_risk > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-300 text-red-700">
                                      Risco: {item.scores.deal_risk}
                                    </Badge>
                                  )}

                                  {item.scores?.health > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-700">
                                      Saúde: {item.scores.health}
                                    </Badge>
                                  )}
                                  </div>

                                  {/* Ações rápidas */}
                                  {item.nextAction?.message_suggestion && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(item.nextAction.message_suggestion);
                                      toast.success('✅ Mensagem sugerida copiada!');
                                    }}
                                    className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors mt-1"
                                    title="Copiar mensagem sugerida pela IA"
                                  >
                                    📋 Copiar Msg
                                  </button>
                                  )}
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