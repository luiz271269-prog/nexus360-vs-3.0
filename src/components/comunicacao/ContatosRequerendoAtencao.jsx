import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Target,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Loader2 } from
'lucide-react';
import { toast } from 'sonner';
import { useContatosInteligentes } from '../hooks/useContatosInteligentes';

export default function ContatosRequerendoAtencao({ usuario, onSelecionarContato, variant = 'sidebar' }) {
  const [expandido, setExpandido] = useState(false);
  const [agrupadoPor, setAgrupadoPor] = useState('topico');
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const isHeader = variant === 'header';

  // 🎯 MOTOR UNIFICADO - Única fonte de verdade
  const {
    clientes: contatosComAlerta,
    loading,
    estatisticas,
    totalUrgentes,
    refetch
  } = useContatosInteligentes(usuario, {
    tipo: ['lead', 'cliente'],
    diasSemMensagem: 2,
    minDealRisk: 30,
    limit: 100,
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000
  });

  const toggleGrupo = (nomeGrupo) => {
    setGruposExpandidos((prev) => ({
      ...prev,
      [nomeGrupo]: !prev[nomeGrupo]
    }));
  };

  // 🎨 AGRUPAMENTO (apenas UI, sem lógica de negócio)
  const agruparPorTopico = () => {
    const grupos = {};

    contatosComAlerta.forEach((item) => {
      // Usar prioridadeLabel como tópico principal
      const topico = item.prioridadeLabel === 'CRITICO' ? '🔴 Críticos' :
      item.prioridadeLabel === 'ALTO' ? '🟠 Alta Prioridade' :
      item.prioridadeLabel === 'MEDIO' ? '🟡 Média Prioridade' :
      '🟢 Monitorar';

      if (!grupos[topico]) grupos[topico] = [];
      grupos[topico].push(item);
    });

    return grupos;
  };

  const agruparPorUsuario = () => {
    const grupos = { 'Não atribuídas': [] };

    contatosComAlerta.forEach((item) => {
      const key = item.atendente_nome || 'Não atribuídas';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(item);
    });

    return grupos;
  };

  const grupos = agrupadoPor === 'topico' ? agruparPorTopico() : agruparPorUsuario();
  const totalAlertas = totalUrgentes || contatosComAlerta.length;

  const getPrioridadeCor = (label) => {
    switch (label) {
      case 'CRITICO':return 'bg-red-500';
      case 'ALTO':return 'bg-orange-500';
      case 'MEDIO':return 'bg-yellow-500';
      default:return 'bg-blue-500';
    }
  };

  // Versão Header (compacta para o topo)
  if (isHeader) {
    return (
      <div className="bg-orange-500 text-slate-50 relative">
        <Button
          onClick={() => setExpandido(!expandido)}
          variant="outline"
          size="sm"
          className="border-white/30 text-white hover:bg-white/20 shadow-lg relative"
          disabled={loading}>

          {loading ?
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :

          <AlertTriangle className="w-4 h-4 mr-2" />
          }
          Contatos Requerendo Atenção
          {totalAlertas > 0 &&
          <Badge className="ml-2 bg-red-500 text-white font-bold text-xs">
              {totalAlertas}
            </Badge>
          }
        </Button>

        {/* Dropdown expandido */}
        {expandido &&
        <>
            <div
            className="fixed inset-0 z-40"
            onClick={() => setExpandido(false)} />

            <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
              {/* Header do dropdown */}
              <div className="px-3 py-2 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                <div className="flex gap-1">
                  <Button
                  size="sm"
                  variant={agrupadoPor === 'topico' ? 'default' : 'outline'}
                  onClick={() => setAgrupadoPor('topico')}
                  className="h-6 text-xs px-2">

                    Por Prioridade
                  </Button>
                  <Button
                  size="sm"
                  variant={agrupadoPor === 'usuario' ? 'default' : 'outline'}
                  onClick={() => setAgrupadoPor('usuario')}
                  className="h-6 text-xs px-2">

                    Por Atendente
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {estatisticas &&
                <span className="text-xs text-slate-500">
                      {estatisticas.criticos}C / {estatisticas.altos}A
                    </span>
                }
                  <Button
                  size="sm"
                  variant="ghost"
                  onClick={refetch}
                  disabled={loading}
                  className="h-6 text-xs px-2">

                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Lista de grupos */}
              <div className="flex-1 overflow-y-auto">
                {loading ?
              <div className="p-4 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Analisando contatos...</p>
                  </div> :
              totalAlertas === 0 ?
              <div className="p-4 text-center">
                    <Target className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">Tudo sob controle!</p>
                    <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção imediata</p>
                  </div> :

              Object.entries(grupos).map(([nomeGrupo, items]) => {
                if (!items || items.length === 0) return null;

                const grupoExpandido = gruposExpandidos[nomeGrupo] !== false;

                return (
                  <div key={nomeGrupo} className="border-b border-slate-100">
                        {/* Header do grupo */}
                        <button
                      onClick={() => toggleGrupo(nomeGrupo)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors">

                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">
                              {nomeGrupo}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {items.length}
                            </Badge>
                          </div>
                          {grupoExpandido ?
                      <ChevronDown className="w-3 h-3 text-slate-400" /> :

                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      }
                        </button>

                        {/* Items do grupo */}
                        {grupoExpandido &&
                    <div className="bg-slate-50/50">
                            {items.map((item) =>
                      <button
                        key={item.id}
                        onClick={() => {
                          if (onSelecionarContato && item.thread_id) {
                            onSelecionarContato({ id: item.thread_id });
                            setExpandido(false);
                          }
                        }}
                        className="w-full px-4 py-2 flex items-start gap-2 hover:bg-white transition-colors border-b border-slate-100 last:border-b-0">

                                {/* Indicador de prioridade */}
                                <div className={`w-1 h-full absolute left-0 ${getPrioridadeCor(item.prioridadeLabel)}`} />
                                
                                {/* Avatar */}
                                <div className="relative flex-shrink-0 mt-0.5">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-gradient-to-br from-orange-400 to-red-500">
                                    {item.foto_perfil_url ?
                            <img
                              src={item.foto_perfil_url}
                              alt={item.nome}
                              className="w-full h-full object-cover rounded-full"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.textContent = item.nome?.charAt(0)?.toUpperCase() || '?';
                              }} /> :


                            item.nome?.charAt(0)?.toUpperCase() || '?'
                            }
                                  </div>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <p className="font-medium text-xs text-slate-800 truncate">
                                      {item.empresa || item.nome}
                                    </p>
                                  </div>

                                  <p className="text-xs text-slate-600 mb-1">
                                    {item.rootCause || 'Requer atenção'}
                                  </p>

                                  <div className="flex items-center gap-1 flex-wrap">
                                    <Badge className={`${getPrioridadeCor(item.prioridadeLabel)} text-white text-[9px] px-1 py-0`}>
                                      {item.prioridadeLabel}
                                    </Badge>
                                    
                                    {item.dealRisk > 0 &&
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-300 text-red-700">
                                        Risco: {item.dealRisk}
                                      </Badge>
                            }

                                    {item.health > 0 &&
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-700">
                                        Saúde: {item.health}
                                      </Badge>
                            }
                                  </div>
                                </div>

                                {/* Ação sugerida */}
                                <div className="flex-shrink-0">
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                </div>
                              </button>
                      )}
                          </div>
                    }
                      </div>);

              })
              }
              </div>
            </div>
          </>
        }
      </div>);

  }

  // Versão Sidebar (original)
  return (
    <div className="border-b border-slate-200 bg-white">
      {/* Header clicável */}
      <button
        onClick={() => setExpandido(!expandido)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors">

        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="font-semibold text-sm text-slate-800">
            Contatos Requerendo Atenção
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {totalAlertas > 0 &&
          <Badge className="bg-red-500 text-white font-bold text-xs">
              {totalAlertas}
            </Badge>
          }
          
          {loading ?
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> :
          expandido ?
          <ChevronDown className="w-4 h-4 text-slate-400" /> :

          <ChevronRight className="w-4 h-4 text-slate-400" />
          }
        </div>
      </button>

      {/* Conteúdo expandido */}
      {expandido &&
      <div className="border-t border-slate-200">
          {/* Toggle de agrupamento */}
          <div className="px-3 py-2 flex items-center justify-between bg-slate-50 border-b border-slate-200">
            <div className="flex gap-1">
              <Button
              size="sm"
              variant={agrupadoPor === 'topico' ? 'default' : 'outline'}
              onClick={() => setAgrupadoPor('topico')}
              className="h-6 text-xs px-2">

                Por Prioridade
              </Button>
              <Button
              size="sm"
              variant={agrupadoPor === 'usuario' ? 'default' : 'outline'}
              onClick={() => setAgrupadoPor('usuario')}
              className="h-6 text-xs px-2">

                Por Atendente
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {estatisticas &&
            <span className="text-xs text-slate-500">
                  {estatisticas.criticos}C / {estatisticas.altos}A
                </span>
            }
              <Button
              size="sm"
              variant="ghost"
              onClick={refetch}
              disabled={loading}
              className="h-6 text-xs px-2">

                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Lista de grupos */}
          <div className="max-h-96 overflow-y-auto">
            {loading ?
          <div className="p-4 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Analisando contatos...</p>
              </div> :
          totalAlertas === 0 ?
          <div className="p-4 text-center">
                <Target className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Tudo sob controle!</p>
                <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção imediata</p>
              </div> :

          Object.entries(grupos).map(([nomeGrupo, items]) => {
            if (!items || items.length === 0) return null;

            const grupoExpandido = gruposExpandidos[nomeGrupo] !== false;

            return (
              <div key={nomeGrupo} className="border-b border-slate-100">
                    {/* Header do grupo */}
                    <button
                  onClick={() => toggleGrupo(nomeGrupo)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors">

                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">
                          {nomeGrupo}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {items.length}
                        </Badge>
                      </div>
                      {grupoExpandido ?
                  <ChevronDown className="w-3 h-3 text-slate-400" /> :

                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  }
                    </button>

                    {/* Items do grupo */}
                    {grupoExpandido &&
                <div className="bg-slate-50/50">
                        {items.map((item) =>
                  <button
                    key={item.id}
                    onClick={() => {
                      if (onSelecionarContato && item.thread_id) {
                        onSelecionarContato({ id: item.thread_id });
                        setExpandido(false);
                      }
                    }}
                    className="w-full px-4 py-2 flex items-start gap-2 hover:bg-white transition-colors border-b border-slate-100 last:border-b-0">

                            {/* Indicador de prioridade */}
                            <div className={`w-1 h-full absolute left-0 ${getPrioridadeCor(item.prioridadeLabel)}`} />

                            {/* Avatar */}
                            <div className="relative flex-shrink-0 mt-0.5">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-gradient-to-br from-orange-400 to-red-500">
                                {item.foto_perfil_url ?
                        <img
                          src={item.foto_perfil_url}
                          alt={item.nome}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.textContent = item.nome?.charAt(0)?.toUpperCase() || '?';
                          }} /> :


                        item.nome?.charAt(0)?.toUpperCase() || '?'
                        }
                              </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1 mb-0.5">
                                <p className="font-medium text-xs text-slate-800 truncate">
                                  {item.empresa || item.nome}
                                </p>
                              </div>

                              <p className="text-xs text-slate-600 mb-1">
                                {item.rootCause || 'Requer atenção'}
                              </p>

                              {/* Ação sugerida */}
                              {item.suggestedMessage &&
                      <p className="text-xs text-green-700 font-medium mb-1">
                                  💡 {item.suggestedMessage.substring(0, 50)}...
                                </p>
                      }

                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge className={`${getPrioridadeCor(item.prioridadeLabel)} text-white text-[9px] px-1 py-0`}>
                                  {item.prioridadeLabel}
                                </Badge>

                                {item.dealRisk > 0 &&
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-300 text-red-700">
                                    Risco: {item.dealRisk}
                                  </Badge>
                        }

                                {item.health > 0 &&
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-700">
                                    Saúde: {item.health}
                                  </Badge>
                        }
                              </div>

                              {/* Copiar mensagem sugerida */}
                              {item.suggestedMessage &&
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(item.suggestedMessage);
                          toast.success('✅ Mensagem copiada!');
                        }}
                        className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors mt-1">

                                  📋 Copiar Msg
                                </button>
                      }
                            </div>

                            {/* Ação sugerida */}
                            <div className="flex-shrink-0">
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </button>
                  )}
                      </div>
                }
                  </div>);

          })
          }
          </div>
        </div>
      }
    </div>);

}