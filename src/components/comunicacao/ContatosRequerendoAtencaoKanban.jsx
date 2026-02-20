import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  Target,
  RefreshCw,
  Loader2,
  User,
  Clock,
  Send,
  Sparkles,
  MessageSquare,
  Calendar,
  Brain,
  X,
  TrendingUp,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useContatosInteligentes } from '../hooks/useContatosInteligentes';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import ModalEnvioPromocoesAutomaticas from './ModalEnvioPromocoesAutomaticas';
import DiagnosticoDiasInativos from './DiagnosticoDiasInativos';

export default function ContatosRequerendoAtencaoKanban({ usuario, onSelecionarContato }) {
  const [agrupadoPor, setAgrupadoPor] = useState('bucket'); // bucket | prioridade
  const [diasInatividade, setDiasInatividade] = useState(5);
  const [contatosSelecionados, setContatosSelecionados] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [mostrarModalPromoAuto, setMostrarModalPromoAuto] = useState(false);
  const [totalContatosBanco, setTotalContatosBanco] = useState(null);
  const [contatoAnaliseAberto, setContatoAnaliseAberto] = useState(null);
  const [analiseCarregando, setAnaliseCarregando] = useState(false);
  const [dadosAnalise, setDadosAnalise] = useState(null);

  // ✅ Motor Unificado V3
  const {
    clientes: contatosComAlerta,
    loading: hookLoading,
    estatisticas,
    totalUrgentes,
    criticos,
    altos,
    refetch: refetchHook
  } = useContatosInteligentes(usuario, {
    tipo: ['lead', 'cliente'],
    diasSemMensagem: diasInatividade,
    minDealRisk: 0,
    limit: null,
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000
  });

  const [analisandoContatos, setAnalisandoContatos] = useState(false);
  const loading = hookLoading || analisandoContatos;

  // ✅ Refetch rápido + análise em background
  const refetch = async () => {
    setAnalisandoContatos(true);
    try {
      await refetchHook();
      toast.success('✅ Lista atualizada!');
      
      base44.functions.invoke('executarAnaliseDiariaContatos', {})
        .then((resultado) => {
          if (resultado?.data?.success) {
            setTimeout(() => refetchHook(), 800);
          }
        })
        .catch((error) => {
          console.warn('[ContatosKanban] ⚠️ Análise em background falhou:', error.message);
        });
    } catch (error) {
      console.error('[ContatosKanban] ❌ Erro ao recarregar:', error);
      toast.error(`❌ ${error.message}`);
    } finally {
      setAnalisandoContatos(false);
    }
  };

  // ✅ Carregar total de contatos
  useEffect(() => {
    const carregarTotalContatos = async () => {
      try {
        const total = await base44.asServiceRole.entities.Contact.filter({
          tipo_contato: { $in: ['lead', 'cliente'] }
        });
        setTotalContatosBanco(total.length);
      } catch (error) {
        console.error('[ContatosKanban] Erro ao carregar total:', error);
      }
    };

    if (usuario) {
      carregarTotalContatos();
    }
  }, [usuario]);

  // ✅ Carregar atendentes
  useEffect(() => {
    const carregarAtendentes = async () => {
      try {
        const resultado = await base44.functions.invoke('listarUsuariosParaAtribuicao', {});
        
        if (resultado?.data?.success && resultado?.data?.usuarios) {
          const map = {};
          resultado.data.usuarios.forEach((u) => {
            map[u.id] = u.full_name || u.email;
          });
          setUsuariosMap(map);
        }
      } catch (error) {
        console.error('[ContatosKanban] Erro ao carregar atendentes:', error);
      }
    };

    if (contatosComAlerta.length > 0) {
      carregarAtendentes();
    }
  }, [contatosComAlerta]);

  // ✅ Agrupamento por Bucket de Inatividade
  const agruparPorBucket = () => {
    const grupos = {
      '🔥 Ativos (<30 dias)': [],
      '⚠️ 30-59 dias': [],
      '🚨 60-89 dias': [],
      '💀 90+ dias': []
    };

    contatosComAlerta.forEach((item) => {
      const bucket = item.bucket_inactive || 'active';
      const key =
        bucket === 'active' ? '🔥 Ativos (<30 dias)' :
        bucket === '30' ? '⚠️ 30-59 dias' :
        bucket === '60' ? '🚨 60-89 dias' :
        '💀 90+ dias';
      grupos[key].push(item);
    });

    Object.keys(grupos).forEach((key) => {
      grupos[key].sort((a, b) => (b.prioridadeScore || 0) - (a.prioridadeScore || 0));
    });

    return grupos;
  };

  // ✅ Agrupamento por Prioridade
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

    Object.keys(grupos).forEach((key) => {
      grupos[key].sort((a, b) => (b.prioridadeScore || 0) - (a.prioridadeScore || 0));
    });

    return grupos;
  };

  const grupos = agrupadoPor === 'bucket' ? agruparPorBucket() : agruparPorPrioridade();
  const totalAlertas = totalUrgentes || contatosComAlerta.length;

  const toggleSelecaoContato = (contato) => {
    setContatosSelecionados((prev) => {
      const id = contato.contact_id || contato.id;
      const jaEsta = prev.some((c) => (c.contact_id || c.id) === id);
      if (jaEsta) {
        return prev.filter((c) => (c.contact_id || c.id) !== id);
      } else {
        return [...prev, contato];
      }
    });
  };

  const toggleSelecionarTodos = () => {
    if (contatosSelecionados.length === contatosComAlerta.length) {
      setContatosSelecionados([]);
    } else {
      setContatosSelecionados([...contatosComAlerta]);
    }
  };

  const abrirEnvioMassa = () => {
    if (contatosSelecionados.length === 0) {
      toast.error('Selecione ao menos 1 contato');
      return;
    }

    localStorage.setItem('envio_massa_contatos', JSON.stringify(
      contatosSelecionados.map((c) => ({
        contact_id: c.contact_id || c.id,
        nome: c.nome,
        empresa: c.empresa,
        telefone: c.telefone
      }))
    ));

    window.location.href = createPageUrl('Comunicacao') + '?modo=envio_massa';
  };

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

  const abrirAnaliseIA = async (contato) => {
    try {
      setContatoAnaliseAberto(contato);
      setAnaliseCarregando(true);

      const analises = await base44.entities.ContactBehaviorAnalysis.filter({
        contact_id: contato.contact_id || contato.id
      }, '-analyzed_at', 1);

      if (analises.length > 0) {
        setDadosAnalise(analises[0]);
      } else {
        setDadosAnalise(null);
        toast.info('Sem análise disponível para este contato');
      }
    } catch (error) {
      console.error('[ContatosKanban] Erro ao carregar análise:', error);
      toast.error('Erro ao carregar análise');
    } finally {
      setAnaliseCarregando(false);
    }
  };

  // ✅ Card de Contato
  const renderContatoCard = (item) => {
    const assignedId = item.vendedor_responsavel || item.assigned_user_id;
    const atendenteNome = assignedId ? usuariosMap[assignedId] || 'Carregando...' : 'Não atribuído';
    const contatoId = item.contact_id || item.id;
    const estaSelecionado = contatosSelecionados.some((c) => (c.contact_id || c.id) === contatoId);

    return (
      <div
        key={contatoId}
        className={`p-3 rounded-lg border-l-4 transition-all ${
          estaSelecionado ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-200 hover:shadow-md'
        }`}
        style={{ borderLeftColor: agrupadoPor === 'prioridade' ? undefined : undefined }}
      >
        {/* Header com checkbox + avatar */}
        <div className="flex items-start gap-2 mb-2">
          <Checkbox
            checked={estaSelecionado}
            onCheckedChange={() => toggleSelecaoContato(item)}
            className="mt-0.5"
          />
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br from-orange-400 to-red-500 flex-shrink-0">
            {item.nome?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs text-slate-800 truncate">
              {item.empresa || item.nome}
            </p>
            <p className="text-[10px] text-slate-500">
              {item.dias_sem_responder || item.days_inactive_inbound || 0}d inativo
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex gap-1 flex-wrap mb-2">
          <Badge className={`${getPrioridadeCor(item.prioridadeLabel)} text-white text-[8px] px-1 py-0`}>
            {item.prioridadeLabel}
          </Badge>
          {item.deal_risk > 0 && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-red-300 text-red-700">
              Risco: {item.deal_risk}%
            </Badge>
          )}
        </div>

        {/* Botões de ação */}
        <div className="flex gap-1">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const threads = await base44.entities.MessageThread.filter({
                  contact_id: item.contact_id,
                  is_canonical: true
                }, '-last_message_at', 1);

                if (threads && threads.length > 0) {
                  onSelecionarContato({
                    id: threads[0].id,
                    contatoPreCarregado: {
                      id: item.contact_id,
                      nome: item.nome,
                      empresa: item.empresa,
                      telefone: item.telefone,
                      tipo_contato: item.tipo_contato,
                      vendedor_responsavel: item.vendedor_responsavel
                    }
                  });
                  toast.success('✅ Conversa aberta!');
                } else {
                  toast.error('❌ Conversa não disponível');
                }
              } catch (error) {
                toast.error(`❌ ${error.message}`);
              }
            }}
            className="flex-1 text-[8px] px-1.5 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            💬 Chat
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              abrirAnaliseIA(item);
            }}
            className="flex-1 text-[8px] px-1.5 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
          >
            🧠 IA
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <ModalEnvioPromocoesAutomaticas
        isOpen={mostrarModalPromoAuto}
        onClose={() => setMostrarModalPromoAuto(false)}
        contatosSelecionados={contatosComAlerta}
        onEnvioCompleto={() => {
          setMostrarModalPromoAuto(false);
          toast.info('🔄 Atualizando lista de contatos...');
          setTimeout(() => refetch(), 1000);
        }}
      />

      {/* Modal de Análise IA */}
      {contatoAnaliseAberto && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" 
            onClick={() => setContatoAnaliseAberto(null)} 
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div 
              className="w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Brain className="w-5 h-5" />
                  <div>
                    <h3 className="font-bold text-sm">{contatoAnaliseAberto.empresa || contatoAnaliseAberto.nome}</h3>
                    <p className="text-xs opacity-90">Análise de Comportamento IA</p>
                  </div>
                </div>
                <Button
                  onClick={() => setContatoAnaliseAberto(null)}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-white/20 text-white">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {analiseCarregando ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-3" />
                  <p className="text-sm text-slate-600">Analisando...</p>
                </div>
              ) : !dadosAnalise ? (
                <div className="p-6 text-center">
                  <Brain className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-sm text-slate-600">Sem análise disponível</p>
                </div>
              ) : (
                <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4">
                    <p className="text-xs font-bold text-slate-700 mb-2">PRIORIDADE</p>
                    <div className="w-full bg-slate-300 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          dadosAnalise.priority_score > 70 ? 'bg-red-500' :
                          dadosAnalise.priority_score > 40 ? 'bg-orange-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${dadosAnalise.priority_score}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-600 mt-2">Score: {dadosAnalise.priority_score || 0}/100</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col h-full min-h-0 bg-slate-50">
        {/* ✅ HEADER COM CONTROLES */}
        <div className="flex-shrink-0 bg-white border-b-2 border-slate-200 p-4 space-y-3">
          {/* Título */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-800">Contatos Urgentes</h2>
                <p className="text-xs text-slate-500">{totalAlertas} requerem atenção</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setMostrarModalPromoAuto(true)}
                disabled={loading || totalAlertas === 0}
                className="h-7 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-50 px-3">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Automático ({totalAlertas})
              </Button>
              <Button
                onClick={abrirEnvioMassa}
                disabled={contatosSelecionados.length === 0}
                className="h-7 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md disabled:opacity-50 px-3">
                <MessageSquare className="w-3.5 h-3.5 mr-1" />
                Massa ({contatosSelecionados.length})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={refetch}
                disabled={loading}
                className="h-7 w-7 p-0 hover:bg-slate-200">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Configurações */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <Input
                type="number"
                min="1"
                max="90"
                value={diasInatividade}
                onChange={(e) => {
                  const dias = parseInt(e.target.value) || 5;
                  setDiasInatividade(Math.max(1, Math.min(90, dias)));
                }}
                className="h-7 w-16 text-xs text-center"
              />
              <span className="text-xs text-slate-600">dias inativos</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetch()}
                className="h-7 px-2 text-xs ml-auto"
              >
                Aplicar
              </Button>
            </div>

            {/* Toggle Visualização */}
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={agrupadoPor === 'bucket' ? 'default' : 'outline'}
                onClick={() => setAgrupadoPor('bucket')}
                className="h-7 text-xs px-2.5 flex-1">
                📅 Inatividade
              </Button>
              <Button
                size="sm"
                variant={agrupadoPor === 'prioridade' ? 'default' : 'outline'}
                onClick={() => setAgrupadoPor('prioridade')}
                className="h-7 text-xs px-2.5 flex-1">
                🔴 Prioridade
              </Button>
            </div>



            {/* Selecionar Todos */}
            {totalAlertas > 0 && (
              <Button
                onClick={toggleSelecionarTodos}
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs">
                {contatosSelecionados.length === contatosComAlerta.length ? '❌ Desmarcar Todos' : '✅ Selecionar Todos'}
              </Button>
            )}
          </div>
        </div>

        {/* ✅ KANBAN COLUMNS */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">Carregando contatos...</p>
            </div>
          </div>
        ) : totalAlertas === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Target className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800">Tudo sob controle!</p>
              <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção imediata</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto p-4 space-x-4 flex">
            {Object.entries(grupos).map(([nomeColuna, items]) => (
              <div key={nomeColuna} className="flex-shrink-0 w-72 rounded-lg overflow-hidden flex flex-col">
                {/* Header da Coluna */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 rounded-t-lg shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{nomeColuna}</span>
                    <Badge className="bg-white/30 text-white text-xs font-bold">
                      {items.length}
                    </Badge>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-custom bg-white rounded-b-lg shadow-sm border border-slate-200 border-t-0">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Sem contatos
                    </div>
                  ) : (
                    items.map(renderContatoCard)
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}