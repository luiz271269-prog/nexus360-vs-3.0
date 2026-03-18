import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowLeft,
  Tag,
  Flame,
  Minus,
  Snowflake,
  Users } from
'lucide-react';
import { toast } from 'sonner';
import { useContatosInteligentes } from '../hooks/useContatosInteligentes';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import ModalEnvioPromocoesAutomaticas from './ModalEnvioPromocoesAutomaticas';
import DiagnosticoDiasInativos from './DiagnosticoDiasInativos';
import ChatWindow from './ChatWindow';
import TaggingRapidoContato from './TaggingRapidoContato';


export default function ContatosRequerendoAtencaoKanban({ usuario, onSelecionarContato, onClose, threads = [], integracoes = [], atendentes = [] }) {
  const [diasInatividade, setDiasInatividade] = useState(5);
  const [contatosSelecionados, setContatosSelecionados] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [mostrarModalPromoAuto, setMostrarModalPromoAuto] = useState(false);
  const [totalContatosBanco, setTotalContatosBanco] = useState(null);
  const [contatoAnaliseAberto, setContatoAnaliseAberto] = useState(null);
  const [analiseCarregando, setAnaliseCarregando] = useState(false);
  const [dadosAnalise, setDadosAnalise] = useState(null);
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState([]);
  const [filtroClasse, setFiltroClasse] = useState('todos'); // 'todos' | 'A' | 'B' | 'C'
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'lead' | 'cliente' | 'fornecedor' | 'parceiro'

  // ✅ Estado para abrir chat lateral
  const [chatAberto, setChatAberto] = useState(null); // { thread, contato }
  const [mensagensChat, setMensagensChat] = useState([]);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);

  // ✅ Motor Unificado V3 — forçar fetch ao montar (ignora cache do Layout)
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
    autoRefresh: false,
    refreshInterval: 5 * 60 * 1000
  });

  // Forçar fetch ao montar (ignora cache do Layout que pode ter parâmetros diferentes)
  useEffect(() => {
    if (usuario) {
      refetchHook(); // forçar re-análise com diasInatividade correto
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [analisandoContatos, setAnalisandoContatos] = useState(false);
  const [etiquetasDisponiveis, setEtiquetasDisponiveis] = useState([]);
  const loading = hookLoading || analisandoContatos;

  // ✅ Refetch rápido + análise em background
  const refetch = async () => {
    setAnalisandoContatos(true);
    try {
      await refetchHook();
      toast.success('✅ Lista atualizada!');

      base44.functions.invoke('executarAnaliseDiariaContatos', {}).
      then((resultado) => {
        if (resultado?.data?.success) {
          setTimeout(() => refetchHook(), 800);
        }
      }).
      catch((error) => {
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

  // ✅ Carregar atendentes + etiquetas (UMA VEZ)
  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Carregar atendentes
        const resultado = await base44.functions.invoke('listarUsuariosParaAtribuicao', {});
        if (resultado?.data?.success && resultado?.data?.usuarios) {
          const map = {};
          resultado.data.usuarios.forEach((u) => {
            map[u.id] = u.full_name || u.email;
          });
          setUsuariosMap(map);
        }

        // Carregar etiquetas UMA VEZ
        const etiquetas = await base44.entities.EtiquetaContato.list('-peso_qualificacao', 100);
        setEtiquetasDisponiveis(etiquetas || []);
      } catch (error) {
        console.error('[ContatosKanban] Erro ao carregar dados:', error);
      }
    };

    if (contatosComAlerta.length > 0) {
      carregarDados();
    }
  }, []);

  // ✅ Agrupamento único por Prioridade (baseado em dias inativos)
  const agruparPorPrioridade = () => {
    const grupos = {
      '🔴 Críticos (90+ dias)': [],
      '🟠 Alta Prioridade (60-89 dias)': [],
      '🟡 Prioritários (30-59 dias)': [],
      '🟢 Monitorar (7-29 dias)': []
    };

    contatosComAlerta.forEach((item) => {
      const dias = item.days_inactive_inbound || 0;
      const topico = dias >= 90 ? '🔴 Críticos (90+ dias)' :
      dias >= 60 ? '🟠 Alta Prioridade (60-89 dias)' :
      dias >= 30 ? '🟡 Prioritários (30-59 dias)' :
      '🟢 Monitorar (7-29 dias)';
      grupos[topico].push(item);
    });

    // Ordenar dentro de cada grupo por dias inativos (decrescente)
    Object.keys(grupos).forEach((key) => {
      grupos[key].sort((a, b) => (b.days_inactive_inbound || 0) - (a.days_inactive_inbound || 0));
    });

    return grupos;
  };

  // ✅ Calcular estatísticas ABC
  const statsABC = useMemo(() => {
    const contarTipos = (lista) => ({
      lead: lista.filter((c) => c.tipo_contato === 'lead').length,
      cliente: lista.filter((c) => c.tipo_contato === 'cliente').length,
      fornecedor: lista.filter((c) => c.tipo_contato === 'fornecedor').length,
      parceiro: lista.filter((c) => c.tipo_contato === 'parceiro').length
    });

    const total = contatosComAlerta.length;
    const listaA = contatosComAlerta.filter((c) => c.classe_abc === 'A' || c.score_abc >= 70);
    const listaB = contatosComAlerta.filter((c) => c.classe_abc === 'B' || c.score_abc >= 30 && c.score_abc < 70);
    const listaC = contatosComAlerta.filter((c) => c.classe_abc === 'C' || c.score_abc < 30 && c.score_abc !== undefined && c.score_abc !== null);

    return {
      total,
      totalTipos: contarTipos(contatosComAlerta),
      classA: listaA.length,
      tiposA: contarTipos(listaA),
      classB: listaB.length,
      tiposB: contarTipos(listaB),
      classC: listaC.length,
      tiposC: contarTipos(listaC)
    };
  }, [contatosComAlerta]);

  // ✅ Filtrar por etiquetas, classe ABC e tipo
  const contatosFiltrados = useMemo(() => {
    let lista = contatosComAlerta;

    if (filtroClasse !== 'todos') {
      lista = lista.filter((item) => {
        const score = item.score_abc ?? 0;
        if (filtroClasse === 'A') return item.classe_abc === 'A' || score >= 70;
        if (filtroClasse === 'B') return item.classe_abc === 'B' || score >= 30 && score < 70;
        if (filtroClasse === 'C') return item.classe_abc === 'C' || score < 30;
        return true;
      });
    }

    if (filtroTipo !== 'todos') {
      lista = lista.filter((item) => item.tipo_contato === filtroTipo);
    }

    if (etiquetasSelecionadas.length > 0) {
      lista = lista.filter((item) =>
      item.tags && item.tags.some((tag) => etiquetasSelecionadas.includes(tag))
      );
    }

    return lista;
  }, [contatosComAlerta, filtroClasse, filtroTipo, etiquetasSelecionadas]);

  // ✅ Obter todas as etiquetas únicas
  const todasEtiquetas = useMemo(() => {
    const tags = new Set();
    contatosComAlerta.forEach((item) => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag) => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [contatosComAlerta]);

  const agruparContatosFiltrados = () => {
    const grupos = {
      '🔴 Críticos (90+ dias)': [],
      '🟠 Alta Prioridade (60-89 dias)': [],
      '🟡 Prioritários (30-59 dias)': [],
      '🟢 Monitorar (7-29 dias)': []
    };

    contatosFiltrados.forEach((item) => {
      const dias = item.days_inactive_inbound || 0;
      const topico = dias >= 90 ? '🔴 Críticos (90+ dias)' :
      dias >= 60 ? '🟠 Alta Prioridade (60-89 dias)' :
      dias >= 30 ? '🟡 Prioritários (30-59 dias)' :
      '🟢 Monitorar (7-29 dias)';
      grupos[topico].push(item);
    });

    Object.keys(grupos).forEach((key) => {
      grupos[key].sort((a, b) => (b.days_inactive_inbound || 0) - (a.days_inactive_inbound || 0));
    });

    return grupos;
  };

  const grupos = agruparContatosFiltrados();
  const totalAlertas = contatosFiltrados.length;

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
    const idsGrupo = itemsDoGrupo.map((i) => i.contact_id || i.id);
    const todosDoGrupoJaSelecionados = idsGrupo.every((id) =>
    contatosSelecionados.some((c) => (c.contact_id || c.id) === id)
    );

    if (todosDoGrupoJaSelecionados) {
      setContatosSelecionados((prev) =>
      prev.filter((c) => !idsGrupo.includes(c.contact_id || c.id))
      );
    } else {
      const idsJaSelecionados = new Set(contatosSelecionados.map((c) => c.contact_id || c.id));
      const novosContatos = itemsDoGrupo.filter((i) => !idsJaSelecionados.has(i.contact_id || i.id));
      setContatosSelecionados((prev) => [...prev, ...novosContatos]);
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
      case 'CRITICO':return 'bg-red-500';
      case 'ALTO':return 'bg-orange-500';
      case 'MEDIO':return 'bg-yellow-500';
      default:return 'bg-blue-500';
    }
  };

  const getBucketCor = (bucket) => {
    switch (bucket) {
      case 'active':return 'bg-green-500';
      case '30':return 'bg-yellow-500';
      case '60':return 'bg-orange-500';
      case '90+':return 'bg-red-500';
      default:return 'bg-slate-500';
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

  // ✅ Formatar data da última mensagem
  const formatarDataUltimaMensagem = (data) => {
    if (!data) return 'Sem mensagens';
    try {
      const dataObj = new Date(data);
      const agora = new Date();
      const diffMs = agora - dataObj;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMin = Math.floor(diffMs / (1000 * 60));

      if (diffDias > 0) return `${diffDias}d atrás`;
      if (diffHoras > 0) return `${diffHoras}h atrás`;
      if (diffMin > 0) return `${diffMin}m atrás`;
      return 'Agora';
    } catch {
      return 'Sem data';
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
        className={`px-2 py-1.5 flex items-center gap-2 cursor-pointer transition-all border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 ${
          estaSelecionado ? 'bg-orange-50 border-l-2 border-l-orange-500' : ''}`
        }>

        {/* Checkbox */}
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={estaSelecionado} onCheckedChange={() => toggleSelecaoContato(item)} />
        </div>

        {/* Avatar com foto - igual sidebar */}
        <div className="relative flex-shrink-0">
          <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-red-500`}>
            {item.foto_perfil_url && item.foto_perfil_url !== 'null' && item.foto_perfil_url !== 'undefined' ? (
              <img
                src={item.foto_perfil_url}
                alt={item.nome}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.textContent = item.nome?.charAt(0)?.toUpperCase() || '?';
                }}
              />
            ) : (
              item.nome?.charAt(0)?.toUpperCase() || '?'
            )}
          </div>
          {/* Indicador de dias inativos */}
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${getBucketCor(item.bucket_inactive)}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Linha 1: Nome + Tag */}
          <div className="flex items-center justify-between gap-1">
            <h3 className="font-semibold truncate text-xs text-slate-900 leading-tight flex-1">
              {nomeExibicao}
            </h3>
            <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
              <TaggingRapidoContato
                contactId={contatoId}
                etiquetasAtuais={item.tags || []}
                etiquetasDisponiveis={etiquetasDisponiveis}
                onTagsUpdated={(novasTags) => { item.tags = novasTags; }}
              />
            </div>
          </div>

          {/* Linha 2: Telefone */}
          {item.telefone && (
            <p className="text-[9px] text-slate-400 truncate leading-tight">
              📱 {item.telefone}
            </p>
          )}

          {/* Linha 3: Última mensagem recebida */}
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-[9px] flex items-center gap-0.5 font-medium ${
              (item.days_inactive_inbound || 0) >= 90 ? 'text-red-500' :
              (item.days_inactive_inbound || 0) >= 60 ? 'text-orange-500' :
              (item.days_inactive_inbound || 0) >= 30 ? 'text-yellow-600' :
              'text-slate-500'
            }`}>
              <MessageSquare className="w-2.5 h-2.5" />
              {formatarDataUltimaMensagem(item.last_inbound_at || item.ultima_interacao)}
            </span>
            {item.days_inactive_inbound > 0 && (
              <span className={`text-[8px] font-bold px-1 rounded ${
                (item.days_inactive_inbound || 0) >= 90 ? 'bg-red-100 text-red-700' :
                (item.days_inactive_inbound || 0) >= 60 ? 'bg-orange-100 text-orange-700' :
                (item.days_inactive_inbound || 0) >= 30 ? 'bg-yellow-100 text-yellow-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {item.days_inactive_inbound}d
              </span>
            )}
          </div>

          {/* Linha 4: Badges tipo + prioridade + ABC + atendente */}
          <div className="flex items-center gap-0.5 flex-wrap mt-0.5">
            {(() => {
              const cfg = { lead: ['Lead','bg-amber-500'], cliente: ['Cliente','bg-emerald-500'], fornecedor: ['Fornec.','bg-blue-500'], parceiro: ['Parceiro','bg-purple-500'] }[item.tipo_contato] || ['Novo','bg-slate-400'];
              return <span className={`text-[8px] font-bold text-white px-1.5 py-0 rounded-full ${cfg[1]}`}>{cfg[0]}</span>;
            })()}

            <span className={`text-[8px] font-bold text-white px-1.5 py-0 rounded ${getPrioridadeCor(item.prioridadeLabel)}`}>
              {item.prioridadeLabel}
            </span>

            {item.classe_abc && item.classe_abc !== 'none' && (() => {
              const cfg = { A: 'bg-green-600', B: 'bg-yellow-500', C: 'bg-blue-500' }[item.classe_abc];
              return cfg ? <span className={`text-[8px] font-black text-white px-1.5 py-0 rounded ${cfg}`}>{item.classe_abc}</span> : null;
            })()}

            {assignedId && (
              <span className="text-[8px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0 rounded-full shrink-0">
                👤 {atendenteNome.split(' ')[0].substring(0, 10)}
              </span>
            )}
          </div>

          {/* Linha 5: Etiquetas */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center gap-0.5 flex-wrap mt-0.5">
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[8px] font-medium text-purple-700 bg-purple-100 px-1 rounded">
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 && <span className="text-[8px] text-slate-400">+{item.tags.length - 3}</span>}
            </div>
          )}
        </div>
      </div>);

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
        }} />


      {/* Modal de Análise IA */}
      {contatoAnaliseAberto &&
      <>
          <div
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          onClick={() => setContatoAnaliseAberto(null)} />

          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div
            className="w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()}>

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

              {analiseCarregando ?
            <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-3" />
                  <p className="text-sm text-slate-600">Analisando...</p>
                </div> :
            !dadosAnalise ?
            <div className="p-6 text-center">
                  <Brain className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-sm text-slate-600">Sem análise disponível</p>
                </div> :

            <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4">
                    <p className="text-xs font-bold text-slate-700 mb-2">PRIORIDADE</p>
                    <div className="w-full bg-slate-300 rounded-full h-2">
                      <div
                    className={`h-2 rounded-full transition-all ${
                    dadosAnalise.priority_score > 70 ? 'bg-red-500' :
                    dadosAnalise.priority_score > 40 ? 'bg-orange-500' :
                    'bg-green-500'}`
                    }
                    style={{ width: `${dadosAnalise.priority_score}%` }} />

                    </div>
                    <p className="text-xs text-slate-600 mt-2">Score: {dadosAnalise.priority_score || 0}/100</p>
                  </div>
                </div>
            }
            </div>
          </div>
        </>
      }

      <div className="flex h-full min-h-0 bg-slate-50">


        {/* ✅ KANBAN COLUMNS */}
        <div className={`flex flex-col h-full min-h-0 transition-all ${chatAberto ? 'flex-1' : 'flex-1'}`}>
        {/* ✅ HEADER COM CONTROLES */}
         <div className="flex-shrink-0 bg-slate-800 border-b-2 border-slate-700 p-2 sm:p-3 space-y-1.5 sm:space-y-2">
           {/* Linha 1: Título + botões */}
           <div className="flex items-center justify-between gap-1">
             <div className="flex items-center gap-1.5 min-w-0">
               {onClose &&
                 <Button onClick={onClose} variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-white/20 text-white flex-shrink-0">
                   <X className="w-3 h-3" />
                 </Button>
               }
               <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-sm flex-shrink-0">
                 <AlertTriangle className="w-3 h-3 text-white" />
               </div>
               <div className="min-w-0 flex-1">
                 <h2 className="font-bold text-xs sm:text-sm text-white truncate">Contatos Urgentes</h2>
                 <p className="text-[9px] text-slate-400">{totalAlertas} requerem atenção</p>
               </div>
             </div>
             <div className="flex items-center gap-1 flex-shrink-0">
               <div className="hidden sm:flex items-center gap-1 bg-slate-700 rounded px-2 py-1">
                 <Calendar className="w-3 h-3 text-slate-400" />
                 <Input
                   type="number" min="1" max="90" value={diasInatividade}
                   onChange={(e) => setDiasInatividade(Math.max(1, Math.min(90, parseInt(e.target.value) || 5)))}
                   className="h-5 w-10 text-[10px] text-center bg-transparent border-0 text-white p-0 focus-visible:ring-0" />
                 <span className="text-[10px] text-slate-400">dias</span>
                 <button onClick={() => refetch()} className="text-[10px] text-amber-400 font-semibold hover:text-amber-300 ml-1">ok</button>
               </div>
               <Button onClick={() => setMostrarModalPromoAuto(true)} disabled={loading || totalAlertas === 0}
                 className="h-6 text-[10px] sm:text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-50 px-1.5 sm:px-2 flex-shrink-0">
                 <Sparkles className="w-2.5 h-2.5 mr-0.5 sm:mr-1 hidden sm:inline" />Auto
               </Button>
               <Button onClick={abrirEnvioMassa} disabled={contatosSelecionados.length === 0}
                 className="h-6 text-[10px] sm:text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md disabled:opacity-50 px-1.5 sm:px-2 flex-shrink-0">
                 <Send className="w-2.5 h-2.5 hidden sm:inline" />M
               </Button>
               <Button size="sm" variant="ghost" onClick={refetch} disabled={loading} className="h-6 w-6 p-0 hover:bg-white/20 text-white flex-shrink-0">
                 <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
               </Button>
             </div>
           </div>

          {/* Linha 2: Cards ABC */}
          <div className="hidden sm:grid grid-cols-4 gap-1.5">
            {[
              { key: 'todos', label: 'TOTAL', value: statsABC.total, accentColor: 'border-t-2 border-slate-500', valueColor: 'text-white', letter: null, tipos: statsABC.totalTipos },
              { key: 'A', label: 'CLASSE A — QUENTES', value: statsABC.classA, accentColor: 'border-t-2 border-green-400', valueColor: 'text-green-400', letter: 'A', letterColor: 'text-green-400/15', tipos: statsABC.tiposA },
              { key: 'B', label: 'CLASSE B — MÉDIOS', value: statsABC.classB, accentColor: 'border-t-2 border-yellow-400', valueColor: 'text-yellow-400', letter: 'B', letterColor: 'text-yellow-400/15', tipos: statsABC.tiposB },
              { key: 'C', label: 'CLASSE C — FRIOS', value: statsABC.classC, accentColor: 'border-t-2 border-blue-400', valueColor: 'text-blue-300', letter: 'C', letterColor: 'text-blue-300/15', tipos: statsABC.tiposC },
            ].map((stat) =>
              <button key={stat.key} onClick={() => setFiltroClasse(stat.key)}
                className={`relative overflow-hidden bg-slate-700 ${stat.accentColor} rounded-lg p-2 text-left transition-all hover:bg-slate-600 ${filtroClasse === stat.key ? 'ring-2 ring-white/40 bg-slate-600' : 'opacity-80 hover:opacity-100'}`}>
                {stat.letter &&
                  <span className={`absolute -bottom-2 -right-1 text-6xl font-black ${stat.letterColor} leading-none select-none pointer-events-none`}>{stat.letter}</span>
                }
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide leading-tight mb-1">{stat.label}</p>
                <span className={`text-xl font-black ${stat.valueColor} block`}>{stat.value}</span>
                <div className="flex flex-col items-end gap-0.5 mt-1">
                  {stat.tipos?.lead > 0 && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">🎯 {stat.tipos.lead}</span>}
                  {stat.tipos?.cliente > 0 && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">⭐ {stat.tipos.cliente}</span>}
                  {stat.tipos?.fornecedor > 0 && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">🔧 {stat.tipos.fornecedor}</span>}
                  {stat.tipos?.parceiro > 0 && <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">🤝 {stat.tipos.parceiro}</span>}
                </div>
              </button>
            )}
          </div>

          {/* Linha 3: Filtros de tipo + etiquetas */}
          <div className="hidden sm:flex gap-1 flex-wrap items-center">
            {[
              { key: 'todos', label: '👥 Todos' },
              { key: 'lead', label: '🎯 Leads' },
              { key: 'cliente', label: '⭐ Clientes' },
              { key: 'fornecedor', label: '🔧 Fornec.' },
              { key: 'parceiro', label: '🤝 Parceiros' },
            ].map((t) =>
              <button key={t.key} onClick={() => setFiltroTipo(t.key)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${filtroTipo === t.key ? 'bg-white text-slate-800' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {t.label}
              </button>
            )}
            {todasEtiquetas.map((tag) =>
              <Button key={tag} size="sm"
                variant={etiquetasSelecionadas.includes(tag) ? 'default' : 'outline'}
                onClick={() => setEtiquetasSelecionadas((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                className={`h-5 px-2 text-[10px] ${etiquetasSelecionadas.includes(tag) ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0' : 'border-slate-600 text-slate-300 hover:bg-slate-600'}`}>
                {tag}
              </Button>
            )}
          </div>
        </div>

        {/* ✅ KANBAN COLUMNS */}
        {loading ?
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">Carregando contatos...</p>
            </div>
          </div> :
          totalAlertas === 0 ?
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Target className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800">Tudo sob controle!</p>
              <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção imediata</p>
            </div>
          </div> :

          <>
          {/* ── DESKTOP: Colunas horizontais ── */}
          <div className="hidden sm:flex flex-1 overflow-x-auto p-3 gap-3">
             {Object.entries(grupos).map(([nomeColuna, items]) =>
             <div key={nomeColuna} className="flex-shrink-0 w-64 rounded-lg overflow-hidden flex flex-col">
                 <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 rounded-t-lg shadow-md">
                   <div className="flex items-center justify-between gap-2">
                     <span className="text-sm font-bold text-white truncate">{nomeColuna}</span>
                     <div className="flex items-center gap-2 flex-shrink-0">
                       <Badge className="bg-white/30 text-white text-xs font-bold">{items.length}</Badge>
                       {items.length > 0 &&
                         <button onClick={() => toggleSelecionarGrupo(items)} className="text-white hover:bg-white/20 rounded px-2 py-1 transition-colors text-sm font-medium">
                           {items.every((i) => contatosSelecionados.some((c) => (c.contact_id || c.id) === (i.contact_id || i.id))) ? '❌' : '✅'}
                         </button>
                       }
                     </div>
                   </div>
                 </div>
                 <div className="flex-1 overflow-y-auto p-1.5 space-y-1 scrollbar-custom bg-white rounded-b-lg shadow-sm border border-slate-200 border-t-0">
                   {items.length === 0 ? <div className="text-center py-8 text-slate-400 text-xs">Sem contatos</div> : items.map(renderContatoCard)}
                 </div>
               </div>
             )}
           </div>

          {/* ── MOBILE: Abas por coluna ── */}
          <div className="sm:hidden flex-1 flex flex-col min-h-0">
            {(() => {
              const gruposEntries = Object.entries(grupos);
              const tabKeys = ['criticos', 'alta', 'prioritarios', 'monitorar'];
              const defaultTab = gruposEntries.find(([, items]) => items.length > 0)?.[0] || gruposEntries[0]?.[0];

              return (
                <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 min-h-0">
                  <TabsList className="grid grid-cols-4 h-9 bg-slate-700 rounded-none flex-shrink-0 w-full">
                    {gruposEntries.map(([nomeColuna, items]) => {
                      const emoji = nomeColuna.startsWith('🔴') ? '🔴' : nomeColuna.startsWith('🟠') ? '🟠' : nomeColuna.startsWith('🟡') ? '🟡' : '🟢';
                      return (
                        <TabsTrigger
                          key={nomeColuna}
                          value={nomeColuna}
                          className="text-[9px] px-0.5 py-1 text-slate-300 data-[state=active]:bg-slate-500 data-[state=active]:text-white flex flex-col items-center gap-0.5 h-full"
                        >
                          <span>{emoji}</span>
                          {items.length > 0 && (
                            <span className="bg-white/30 text-white text-[8px] font-bold rounded-full px-1 min-w-4 text-center">{items.length}</span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    {gruposEntries.map(([nomeColuna, items]) => (
                      <TabsContent key={nomeColuna} value={nomeColuna} className="m-0 h-full flex flex-col">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-2 flex items-center justify-between flex-shrink-0">
                          <span className="text-xs font-bold text-white truncate flex-1">{nomeColuna}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className="bg-white/30 text-white text-xs font-bold">{items.length}</Badge>
                            {items.length > 0 && (
                              <button onClick={() => toggleSelecionarGrupo(items)} className="text-white hover:bg-white/20 rounded px-1.5 py-0.5 text-xs font-medium">
                                {items.every((i) => contatosSelecionados.some((c) => (c.contact_id || c.id) === (i.contact_id || i.id))) ? '❌' : '✅'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-white">
                          {items.length === 0
                            ? <div className="text-center py-12 text-slate-400 text-xs">Sem contatos</div>
                            : items.map(renderContatoCard)
                          }
                        </div>
                      </TabsContent>
                    ))}
                  </div>
                </Tabs>
              );
            })()}
          </div>
          </>
          }
      </div>

    </div>

      {/* ✅ CHAT FLUTUANTE */}
      {chatAberto && (
        <div className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-50 flex flex-col w-[calc(100vw-16px)] sm:w-[420px] h-[calc(100vh-100px)] sm:h-[600px] max-h-[80vh] bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header da bolha */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                {chatAberto.contato?.nome?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate max-w-[240px]">
                  {chatAberto.contato?.empresa || chatAberto.contato?.nome || 'Contato'}
                </p>
                {chatAberto.contato?.telefone && (
                  <p className="text-[10px] text-slate-400 truncate">{chatAberto.contato.telefone}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setChatAberto(null)}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/20 text-slate-300 hover:text-white transition-all flex-shrink-0"
              title="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conteúdo */}
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
                const msgs = await base44.entities.Message.filter(
                  { thread_id: chatAberto.thread.id }, '-sent_at', 200
                );
                setMensagensChat(msgs.reverse());
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
    </>);

}