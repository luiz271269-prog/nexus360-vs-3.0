import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Target,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Loader2,
  User,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useContatosInteligentes } from '../hooks/useContatosInteligentes';
import { base44 } from '@/api/base44Client';

export default function ContatosRequerendoAtencao({ usuario, onSelecionarContato, variant = 'sidebar' }) {
  const [expandido, setExpandido] = useState(false);
  const [agrupadoPor, setAgrupadoPor] = useState('prioridade'); // prioridade | atendente | bucket
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const [usuariosMap, setUsuariosMap] = useState({});
  const isHeader = variant === 'header';

  // ✅ Motor Unificado V3
  const {
    clientes: contatosComAlerta,
    loading,
    estatisticas,
    totalUrgentes,
    criticos,
    altos,
    refetch
  } = useContatosInteligentes(usuario, {
    tipo: ['lead', 'cliente'],
    diasSemMensagem: 2,
    minDealRisk: 20,
    limit: 100,
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000
  });

  // ✅ Carregar nomes dos atendentes
  useEffect(() => {
    const carregarAtendentes = async () => {
      try {
        const assignedIds = [...new Set(
          contatosComAlerta
            .map(c => c.vendedor_responsavel || c.assigned_user_id)
            .filter(Boolean)
        )];

        if (assignedIds.length > 0) {
          const users = await base44.asServiceRole.entities.User.filter({
            id: { $in: assignedIds }
          });
          
          const map = {};
          users.forEach(u => {
            map[u.id] = u.full_name || u.email;
          });
          setUsuariosMap(map);
        }
      } catch (error) {
        console.error('[ContatosRequerendoAtencao] Erro ao carregar atendentes:', error);
      }
    };

    if (contatosComAlerta.length > 0) {
      carregarAtendentes();
    }
  }, [contatosComAlerta]);

  const toggleGrupo = (nomeGrupo) => {
    setGruposExpandidos((prev) => ({
      ...prev,
      [nomeGrupo]: !prev[nomeGrupo]
    }));
  };

  // ✅ AGRUPAMENTO POR PRIORIDADE (usando novos campos)
  const agruparPorPrioridade = () => {
    const grupos = {
      '🔴 Críticos': [],
      '🟠 Alta Prioridade': [],
      '🟡 Média Prioridade': [],
      '🟢 Monitorar': []
    };

    contatosComAlerta.forEach((item) => {
      const topico = item.prioridadeLabel === 'CRITICO' ? '🔴 Críticos' :
        item.prioridadeLabel === 'ALTO' ? '🟠 Alta Prioridade' :
        item.prioridadeLabel === 'MEDIO' ? '🟡 Média Prioridade' :
        '🟢 Monitorar';

      grupos[topico].push(item);
    });

    return grupos;
  };

  // ✅ AGRUPAMENTO POR ATENDENTE
  const agruparPorAtendente = () => {
    const grupos = { '❓ Não atribuídas': [] };

    contatosComAlerta.forEach((item) => {
      const assignedId = item.vendedor_responsavel || item.assigned_user_id;
      const key = assignedId ? (usuariosMap[assignedId] || assignedId) : '❓ Não atribuídas';
      
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(item);
    });

    return grupos;
  };

  // ✅ AGRUPAMENTO POR BUCKET DE INATIVIDADE (30/60/90+)
  const agruparPorBucket = () => {
    const grupos = {
      '🔥 Ativos (<30 dias)': [],
      '⚠️ 30-59 dias inativos': [],
      '🚨 60-89 dias inativos': [],
      '💀 90+ dias inativos': []
    };

    contatosComAlerta.forEach((item) => {
      const bucket = item.bucket_inactive || 'active';
      const key = 
        bucket === 'active' ? '🔥 Ativos (<30 dias)' :
        bucket === '30' ? '⚠️ 30-59 dias inativos' :
        bucket === '60' ? '🚨 60-89 dias inativos' :
        '💀 90+ dias inativos';

      grupos[key].push(item);
    });

    return grupos;
  };

  const grupos = 
    agrupadoPor === 'prioridade' ? agruparPorPrioridade() :
    agrupadoPor === 'bucket' ? agruparPorBucket() :
    agruparPorAtendente();

  const totalAlertas = totalUrgentes || contatosComAlerta.length;

  const getPrioridadeCor = (label) => {
    switch (label) {
      case 'CRITICO': return 'bg-red-500';
      case 'ALTO': return 'bg-orange-500';
      case 'MEDIO': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getBucketCor = (bucket) => {
    switch (bucket) {
      case 'active': return 'bg-green-500';
      case '30': return 'bg-yellow-500';
      case '60': return 'bg-orange-500';
      case '90+': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  // ✅ Renderizar item de contato
  const renderContatoItem = (item) => {
    const assignedId = item.vendedor_responsavel || item.assigned_user_id;
    const atendenteNome = assignedId ? (usuariosMap[assignedId] || 'Carregando...') : 'Não atribuído';
    
    return (
      <button
        key={item.contact_id}
        onClick={() => {
          if (onSelecionarContato) {
            // ✅ Usar thread_id já vindo do endpoint (ou buscar se null)
            if (item.thread_id) {
              onSelecionarContato({ id: item.thread_id });
              setExpandido(false);
            } else {
              // Fallback: buscar thread se não veio
              base44.entities.MessageThread.filter({ contact_id: item.contact_id }, '-last_message_at', 1)
                .then(threads => {
                  if (threads.length > 0) {
                    onSelecionarContato({ id: threads[0].id });
                    setExpandido(false);
                  }
                });
            }
          }
        }}
        className="w-full px-4 py-2 flex items-start gap-2 hover:bg-white transition-colors border-b border-slate-100 last:border-b-0 relative"
      >
        {/* Indicador lateral */}
        <div className={`w-1 h-full absolute left-0 ${getPrioridadeCor(item.prioridadeLabel)}`} />

        {/* Avatar */}
        <div className="relative flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-gradient-to-br from-orange-400 to-red-500">
            {item.nome?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <Badge className={`absolute -bottom-1 -right-1 ${getBucketCor(item.bucket_inactive)} text-white text-[8px] px-1 py-0 h-4 min-w-4 flex items-center justify-center`}>
            {item.bucket_inactive === 'active' ? '✓' : item.bucket_inactive}
          </Badge>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1 mb-0.5">
            <p className="font-medium text-xs text-slate-800 truncate">
              {item.empresa || item.nome}
            </p>
          </div>

          <div className="text-xs text-slate-500 mb-1">
            <Clock className="w-3 h-3 inline mr-1" />
            {item.days_inactive_inbound || 0} dias sem responder
          </div>

          {/* Root causes (primeira) */}
          {item.root_causes && item.root_causes.length > 0 && (
            <p className="text-xs text-slate-600 mb-1 italic">
              • {item.root_causes[0]}
            </p>
          )}

          <div className="flex items-center gap-1 flex-wrap">
            <Badge className={`${getPrioridadeCor(item.prioridadeLabel)} text-white text-[9px] px-1 py-0`}>
              {item.prioridadeLabel}
            </Badge>

            {item.deal_risk > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-300 text-red-700">
                Risco: {item.deal_risk}%
              </Badge>
            )}

            {item.buy_intent > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-700">
                Intenção: {item.buy_intent}%
              </Badge>
            )}

            {agrupadoPor !== 'atendente' && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-300 text-slate-600">
                <User className="w-2 h-2 inline mr-0.5" />
                {atendenteNome}
              </Badge>
            )}
          </div>

          {/* Mensagem sugerida (preview) */}
          {item.suggested_message && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(item.suggested_message);
                toast.success('✅ Mensagem copiada!');
              }}
              className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors mt-1 inline-block"
            >
              📋 Copiar Sugestão IA
            </button>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
      </button>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // VERSÃO HEADER (compacta para o topo)
  // ═══════════════════════════════════════════════════════════════
  if (isHeader) {
    return (
      <div className="bg-orange-500 text-slate-50 relative">
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

        {expandido && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExpandido(false)} />

            <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
              {/* Header do dropdown */}
              <div className="px-3 py-2 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={agrupadoPor === 'prioridade' ? 'default' : 'outline'}
                    onClick={() => setAgrupadoPor('prioridade')}
                    className="h-6 text-xs px-2"
                  >
                    Prioridade
                  </Button>
                  <Button
                    size="sm"
                    variant={agrupadoPor === 'bucket' ? 'default' : 'outline'}
                    onClick={() => setAgrupadoPor('bucket')}
                    className="h-6 text-xs px-2"
                  >
                    Inatividade
                  </Button>
                  <Button
                    size="sm"
                    variant={agrupadoPor === 'atendente' ? 'default' : 'outline'}
                    onClick={() => setAgrupadoPor('atendente')}
                    className="h-6 text-xs px-2"
                  >
                    Atendente
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={refetch}
                  disabled={loading}
                  className="h-6 text-xs px-2"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Lista */}
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
                    <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção</p>
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
                              {nomeGrupo}
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

                        {/* Items */}
                        {grupoExpandido && (
                          <div className="bg-slate-50/50">
                            {items.map(renderContatoItem)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer com estatísticas */}
              {estatisticas && (
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    {criticos.length} críticos · {altos.length} altos
                  </span>
                  <span className="text-slate-500">
                    Total: {contatosComAlerta.length}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VERSÃO SIDEBAR (original)
  // ═══════════════════════════════════════════════════════════════
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
            Requerem Atenção
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
                variant={agrupadoPor === 'prioridade' ? 'default' : 'outline'}
                onClick={() => setAgrupadoPor('prioridade')}
                className="h-6 text-xs px-2"
              >
                Prioridade
              </Button>
              <Button
                size="sm"
                variant={agrupadoPor === 'bucket' ? 'default' : 'outline'}
                onClick={() => setAgrupadoPor('bucket')}
                className="h-6 text-xs px-2"
              >
                Inatividade
              </Button>
              <Button
                size="sm"
                variant={agrupadoPor === 'atendente' ? 'default' : 'outline'}
                onClick={() => setAgrupadoPor('atendente')}
                className="h-6 text-xs px-2"
              >
                Atendente
              </Button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={refetch}
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
                <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção</p>
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
                          {nomeGrupo}
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

                    {/* Items */}
                    {grupoExpandido && (
                      <div className="bg-slate-50/50">
                        {items.map(renderContatoItem)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer com estatísticas */}
          {estatisticas && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                {criticos.length} críticos · {altos.length} altos
              </span>
              <span className="text-slate-500">
                Total: {contatosComAlerta.length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}