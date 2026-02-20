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
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useContatosInteligentes } from '../hooks/useContatosInteligentes';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import ModalEnvioPromocoesAutomaticas from './ModalEnvioPromocoesAutomaticas';
import DiagnosticoDiasInativos from './DiagnosticoDiasInativos';
import ChatWindow from './ChatWindow';

export default function ContatosRequerendoAtencaoKanban({ usuario, onSelecionarContato, onClose }) {
  const [agrupadoPor, setAgrupadoPor] = useState('bucket'); // bucket | prioridade
  const [diasInatividade, setDiasInatividade] = useState(5);
  const [contatosSelecionados, setContatosSelecionados] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [mostrarModalPromoAuto, setMostrarModalPromoAuto] = useState(false);
  const [totalContatosBanco, setTotalContatosBanco] = useState(null);
  const [contatoAnaliseAberto, setContatoAnaliseAberto] = useState(null);
  const [analiseCarregando, setAnaliseCarregando] = useState(false);
  const [dadosAnalise, setDadosAnalise] = useState(null);
  
  // ✅ Estado para abrir chat lateral
  const [chatAberto, setChatAberto] = useState(null); // { thread, contato }
  const [mensagensChat, setMensagensChat] = useState([]);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);

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

  const toggleSelecionarGrupo = (itemsDoGrupo) => {
    const idsGrupo = itemsDoGrupo.map(i => i.contact_id || i.id);
    const todosDoGrupoJaSelecionados = idsGrupo.every(id => 
      contatosSelecionados.some(c => (c.contact_id || c.id) === id)
    );

    if (todosDoGrupoJaSelecionados) {
      setContatosSelecionados(prev => 
        prev.filter(c => !idsGrupo.includes(c.contact_id || c.id))
      );
    } else {
      const idsJaSelecionados = new Set(contatosSelecionados.map(c => c.contact_id || c.id));
      const novosContatos = itemsDoGrupo.filter(i => !idsJaSelecionados.has(i.contact_id || i.id));
      setContatosSelecionados(prev => [...prev, ...novosContatos]);
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

  // ✅ Card de Contato - IGUAL à lista de contatos da sidebar
  const renderContatoCard = (item) => {
    const assignedId = item.vendedor_responsavel || item.assigned_user_id;
    const atendenteNome = assignedId ? usuariosMap[assignedId] || 'Carregando...' : 'Não atribuído';
    const contatoId = item.contact_id || item.id;
    const estaSelecionado = contatosSelecionados.some((c) => (c.contact_id || c.id) === contatoId);

    // Nome formatado: Empresa + Cargo + Nome (igual ChatSidebar)
    let nomeExibicao = "";
    if (item.empresa) nomeExibicao += item.empresa;
    if (item.cargo) nomeExibicao += (nomeExibicao ? " - " : "") + item.cargo;
    if (item.nome && item.nome !== item.telefone) nomeExibicao += (nomeExibicao ? " - " : "") + item.nome;
    if (!nomeExibicao || nomeExibicao.trim() === '') {
      nomeExibicao = item.telefone || "Sem Nome";
    }

    return (
      <div
        key={contatoId}
        onClick={async (e) => {
          e.stopPropagation();
          try {
            const threads = await base44.entities.MessageThread.filter({
              contact_id: item.contact_id,
              is_canonical: true
            }, '-last_message_at', 1);

            if (threads && threads.length > 0) {
              // ✅ Abrir chat lateral dentro do Kanban
              setCarregandoMensagens(true);
              const mensagens = await base44.entities.Message.filter(
                { thread_id: threads[0].id },
                '-sent_at',
                200
              );
              
              setChatAberto({
                thread: threads[0],
                contato: {
                  id: item.contact_id,
                  nome: item.nome,
                  empresa: item.empresa,
                  telefone: item.telefone,
                  tipo_contato: item.tipo_contato,
                  vendedor_responsavel: item.vendedor_responsavel
                }
              });
              setMensagensChat(mensagens.reverse());
              setCarregandoMensagens(false);
            } else {
              toast.error('❌ Conversa não disponível');
            }
          } catch (error) {
            toast.error(`❌ ${error.message}`);
            setCarregandoMensagens(false);
          }
        }}
        className={`px-2 py-2 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 ${
          estaSelecionado ? 'bg-orange-100 border-l-4 border-l-orange-500' : ''
        }`}
      >
        {/* Checkbox */}
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={estaSelecionado}
            onCheckedChange={() => toggleSelecaoContato(item)}
          />
        </div>

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br from-amber-400 via-orange-500 to-red-500">
            {item.nome?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <Badge className={`absolute -bottom-1 -right-1 ${getBucketCor(item.bucket_inactive)} text-white text-[8px] px-1 py-0 h-4 min-w-4 flex items-center justify-center`}>
            {item.bucket_inactive === 'active' ? '✓' : item.bucket_inactive}
          </Badge>
        </div>

        <div className="flex-1 min-w-0">
          {/* Linha 1: Nome - text-sm (14px semibold) */}
          <div className="flex items-center justify-between mb-0.5">
            <h3 className="font-semibold truncate text-sm text-slate-900">
              {nomeExibicao}
            </h3>
          </div>

          {/* Linha 2: Inatividade - text-xs (12px regular) */}
          <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3" />
            {item.days_inactive_inbound || 0}d sem responder
          </p>

          {/* Linha 3: Badges - text-[10px] (10px semibold) */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Tipo Contato */}
            {(() => {
              const tipoContato = item.tipo_contato || 'novo';
              const tiposConfig = {
                'novo': { emoji: '?', label: 'Novo', bg: 'bg-slate-400' },
                'lead': { emoji: 'L', label: 'Lead', bg: 'bg-amber-500' },
                'cliente': { emoji: 'C', label: 'Cliente', bg: 'bg-emerald-500' },
                'fornecedor': { emoji: 'F', label: 'Fornec.', bg: 'bg-blue-500' },
                'parceiro': { emoji: 'P', label: 'Parceiro', bg: 'bg-purple-500' }
              };
              const cfg = tiposConfig[tipoContato] || tiposConfig['novo'];
              return (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${cfg.bg} shadow-sm`}>
                  {cfg.emoji} {cfg.label}
                </span>
              );
            })()}

            {/* Prioridade */}
            <Badge className={`${getPrioridadeCor(item.prioridadeLabel)} text-white text-[10px] px-1.5 py-0.5`}>
              {item.prioridadeLabel}
            </Badge>

            {/* Deal Risk */}
            {item.deal_risk > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-red-300 text-red-700">
                Risco: {item.deal_risk}%
              </Badge>
            )}

            {/* Atendente */}
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-indigo-500 shadow-sm">
              <User className="w-3 h-3" />
              {atendenteNome.split(' ')[0]}
            </span>
          </div>
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

      <div className="flex h-full min-h-0 bg-slate-50">
        {/* ✅ KANBAN COLUMNS */}
        <div className={`flex flex-col h-full min-h-0 transition-all ${chatAberto ? 'w-1/2' : 'w-full'}`}>
        {/* ✅ HEADER COM CONTROLES */}
        <div className="flex-shrink-0 bg-white border-b-2 border-slate-200 p-4 space-y-3">
          {/* Título */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onClose && (
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-800">Contatos Urgentes</h2>
                <p className="text-xs text-slate-500">{totalAlertas} requerem atenção</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setMostrarModalPromoAuto(true)}
                disabled={loading || totalAlertas === 0}
                className="h-7 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-50 px-3">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Automático
              </Button>
              <Button
                onClick={abrirEnvioMassa}
                disabled={contatosSelecionados.length === 0}
                className="h-7 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md disabled:opacity-50 px-3">
                <MessageSquare className="w-3.5 h-3.5 mr-1" />
                Massa
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
                {/* Header da Coluna - 14px */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 rounded-t-lg shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">{nomeColuna}</span>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white/30 text-white text-xs font-bold">
                        {items.length}
                      </Badge>
                      {items.length > 0 && (
                        <button
                          onClick={() => toggleSelecionarGrupo(items)}
                          className="text-white hover:bg-white/20 rounded px-2 py-1 transition-colors text-sm font-medium"
                        >
                          {items.every(i => contatosSelecionados.some(c => (c.contact_id || c.id) === (i.contact_id || i.id))) 
                            ? '❌' 
                            : '✅'}
                        </button>
                      )}
                    </div>
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

      {/* ✅ CHAT LATERAL */}
      {chatAberto && (
        <div className="w-1/2 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
          {/* Header do Chat */}
          <div className="flex-shrink-0 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center justify-between border-b border-slate-600">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                onClick={() => setChatAberto(null)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-white/20 text-white flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex-shrink-0">
                {chatAberto.contato.nome?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-white text-sm truncate">
                  {chatAberto.contato.empresa || chatAberto.contato.nome}
                </h3>
                <p className="text-xs text-slate-300 truncate">
                  {chatAberto.contato.cargo ? `${chatAberto.contato.cargo} - ` : ''}{chatAberto.contato.nome}
                </p>
              </div>
            </div>
          </div>

          {/* Chat Window */}
          {carregandoMensagens ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <ChatWindow
              thread={chatAberto.thread}
              mensagens={mensagensChat}
              usuario={usuario}
              contatoPreCarregado={chatAberto.contato}
              onEnviarMensagem={async () => {}}
              onSendMessageOptimistic={async () => {}}
              onSendInternalMessageOptimistic={async () => {}}
              onShowContactInfo={() => {}}
              onAtualizarMensagens={async () => {
                const mensagens = await base44.entities.Message.filter(
                  { thread_id: chatAberto.thread.id },
                  '-sent_at',
                  200
                );
                setMensagensChat(mensagens.reverse());
              }}
              integracoes={[]}
              selectedCategoria="all"
              modoSelecaoMultipla={false}
              contatosSelecionados={[]}
              broadcastInterno={null}
              onCancelarSelecao={() => {}}
              atendentes={[]}
              filterScope="all"
              selectedIntegrationId="all"
              selectedAttendantId={null}
              contatoAtivo={chatAberto.contato}
            />
          )}
        </div>
      )}
    </div>
    </>
  );
}