import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  Target,
  ChevronRight,
  ChevronDown,
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
  TrendingUp } from
'lucide-react';
import { toast } from 'sonner';
import { useContatosInteligentes } from '../hooks/useContatosInteligentes';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import ModalEnvioPromocoesAutomaticas from './ModalEnvioPromocoesAutomaticas';

export default function ContatosRequerendoAtencao({ usuario, onSelecionarContato, variant = 'sidebar' }) {
  const [expandido, setExpandido] = useState(false);
  const [agrupadoPor, setAgrupadoPor] = useState('prioridade'); // prioridade | atendente | bucket
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const [usuariosMap, setUsuariosMap] = useState({});
  const [enviandoPromos, setEnviandoPromos] = useState(false);
  const [contatosSelecionados, setContatosSelecionados] = useState([]);
  const [diasInatividade, setDiasInatividade] = useState(5);
  const [totalContatosBanco, setTotalContatosBanco] = useState(null);
  const [mostrarModalPromoAuto, setMostrarModalPromoAuto] = useState(false);
  const [contatoAnaliseAberto, setContatoAnaliseAberto] = useState(null);
  const [analiseCarregando, setAnaliseCarregando] = useState(false);
  const [dadosAnalise, setDadosAnalise] = useState(null);
  const isHeader = variant === 'header';

  // ✅ Motor Unificado V3 - BUSCA TODOS do banco
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

  // ✅ Estado local para controlar loading da análise
  const [analisandoContatos, setAnalisandoContatos] = useState(false);
  const loading = hookLoading || analisandoContatos;

  // ✅ Refetch rápido + análise em background
  const refetch = async () => {
    setAnalisandoContatos(true);
    try {
      console.log('[ContatosRequerendoAtencao] ⚡ Recarregando lista...');
      
      // ✅ 1. Recarregar imediatamente (rápido)
      await refetchHook();
      toast.success('✅ Lista atualizada!');
      
      // ✅ 2. Dispara análise em background (não bloqueia)
      console.log('[ContatosRequerendoAtencao] 🔄 Análise iniciada (background)...');
      base44.functions.invoke('executarAnaliseDiariaContatos', {})
        .then((resultado) => {
          if (resultado?.data?.success) {
            console.log(`[ContatosRequerendoAtencao] ✅ Análise concluída (${resultado.data.analisados || 0} contatos)`);
            // Recarregar dados após análise
            setTimeout(() => refetchHook(), 800);
          }
        })
        .catch((error) => {
          console.warn('[ContatosRequerendoAtencao] ⚠️ Análise em background falhou:', error.message);
        });
      
    } catch (error) {
      console.error('[ContatosRequerendoAtencao] ❌ Erro ao recarregar:', error);
      toast.error(`❌ ${error.message}`);
    } finally {
      setAnalisandoContatos(false);
    }
  };

  // ✅ Carregar total de contatos do banco
  useEffect(() => {
    const carregarTotalContatos = async () => {
      try {
        const total = await base44.asServiceRole.entities.Contact.filter({
          tipo_contato: { $in: ['lead', 'cliente'] }
        });
        setTotalContatosBanco(total.length);
      } catch (error) {
        console.error('[ContatosRequerendoAtencao] Erro ao carregar total:', error);
      }
    };

    if (usuario) {
      carregarTotalContatos();
    }
  }, [usuario]);

  // ✅ Carregar nomes dos atendentes via função centralizada
  useEffect(() => {
    const carregarAtendentes = async () => {
      try {
        // ✅ Usar mesma função que o resto do sistema
        const resultado = await base44.functions.invoke('listarUsuariosParaAtribuicao', {});
        
        if (resultado?.data?.success && resultado?.data?.usuarios) {
          const todosUsuarios = resultado.data.usuarios;
          const map = {};
          
          todosUsuarios.forEach((u) => {
            map[u.id] = u.full_name || u.email;
          });
          
          setUsuariosMap(map);
          console.log('[ContatosRequerendoAtencao] ✅ Mapa de atendentes carregado:', Object.keys(map).length);
        } else {
          console.warn('[ContatosRequerendoAtencao] ⚠️ Fallback para busca direta User');
          
          // Fallback: buscar diretamente
          const assignedIds = [...new Set(
            contatosComAlerta
              .map((c) => c.vendedor_responsavel || c.assigned_user_id)
              .filter(Boolean)
          )];

          if (assignedIds.length > 0) {
            const users = await base44.asServiceRole.entities.User.filter({
              id: { $in: assignedIds }
            });

            const map = {};
            users.forEach((u) => {
              map[u.id] = u.full_name || u.email;
            });
            setUsuariosMap(map);
          }
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

    // ✅ ORDENAR por score dentro de cada grupo
    Object.keys(grupos).forEach((key) => {
      grupos[key].sort((a, b) => (b.prioridadeScore || 0) - (a.prioridadeScore || 0));
    });

    return grupos;
  };

  // ✅ AGRUPAMENTO POR ATENDENTE
  const agruparPorAtendente = () => {
    const grupos = { '❓ Não atribuídas': [] };

    contatosComAlerta.forEach((item) => {
      const assignedId = item.vendedor_responsavel || item.assigned_user_id;
      const key = assignedId ? usuariosMap[assignedId] || assignedId : '❓ Não atribuídas';

      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(item);
    });

    // ✅ ORDENAR por score dentro de cada grupo
    Object.keys(grupos).forEach((key) => {
      grupos[key].sort((a, b) => (b.prioridadeScore || 0) - (a.prioridadeScore || 0));
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

    // ✅ ORDENAR por score dentro de cada grupo
    Object.keys(grupos).forEach((key) => {
      grupos[key].sort((a, b) => (b.prioridadeScore || 0) - (a.prioridadeScore || 0));
    });

    return grupos;
  };

  const grupos =
  agrupadoPor === 'prioridade' ? agruparPorPrioridade() :
  agrupadoPor === 'bucket' ? agruparPorBucket() :
  agruparPorAtendente();

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

  // ✅ Selecionar todos de um grupo específico
  const toggleSelecionarGrupo = (itemsDoGrupo) => {
    const idsGrupo = itemsDoGrupo.map(i => i.contact_id || i.id);
    const todosDoGrupoJaSelecionados = idsGrupo.every(id => 
      contatosSelecionados.some(c => (c.contact_id || c.id) === id)
    );

    if (todosDoGrupoJaSelecionados) {
      // Desmarcar todos do grupo
      setContatosSelecionados(prev => 
        prev.filter(c => !idsGrupo.includes(c.contact_id || c.id))
      );
    } else {
      // Selecionar todos do grupo
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

    // Salvar no localStorage para passar para página Comunicacao
    localStorage.setItem('envio_massa_contatos', JSON.stringify(
      contatosSelecionados.map((c) => ({
        contact_id: c.contact_id || c.id,
        nome: c.nome,
        empresa: c.empresa,
        telefone: c.telefone
      }))
    ));

    // Navegar para página de comunicação
    window.location.href = createPageUrl('Comunicacao') + '?modo=envio_massa';
  };

  const enviarPromocoesAutomaticas = async () => {
    if (!contatosComAlerta.length) {
      toast.error('Nenhum contato para enviar promoções');
      return;
    }

    // ✅ Abrir modal moderno ao invés de window.confirm
    setMostrarModalPromoAuto(true);
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
      console.error('[ContatosRequerendoAtencao] Erro ao carregar análise:', error);
      toast.error('Erro ao carregar análise');
    } finally {
      setAnaliseCarregando(false);
    }
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

  // ✅ Renderizar item de contato (com seleção)
  const renderContatoItem = (item) => {
    const assignedId = item.vendedor_responsavel || item.assigned_user_id;
    const atendenteNome = assignedId ? usuariosMap[assignedId] || 'Carregando...' : 'Não atribuído';
    const contatoId = item.contact_id || item.id;
    const estaSelecionado = contatosSelecionados.some((c) => (c.contact_id || c.id) === contatoId);

    return (
      <div
        key={contatoId}
        className={`relative w-full px-4 py-2 flex items-start gap-2 border-b border-slate-100 last:border-b-0 transition-colors ${
        estaSelecionado ? 'bg-blue-50' : 'hover:bg-white'}`
        }>

        {/* Indicador lateral */}
        <div className={`w-1 h-full absolute left-0 top-0 ${getPrioridadeCor(item.prioridadeLabel)}`} />

        {/* Checkbox de seleção */}
        <div className="flex-shrink-0 mt-2.5">
          <Checkbox
            checked={estaSelecionado}
            onCheckedChange={() => toggleSelecaoContato(item)}
            onClick={(e) => e.stopPropagation()} />

        </div>

        {/* Avatar - Clique para abrir conversa */}
        <button
          onClick={async (e) => {
            e.stopPropagation();

            console.log('[ContatosRequerendoAtencao] 🖱️ Avatar clicado para:', item.nome, '| onSelecionarContato:', !!onSelecionarContato);

            if (!onSelecionarContato) {
              console.error('[ContatosRequerendoAtencao] ❌ onSelecionarContato não está configurado!');
              toast.error('❌ Erro ao abrir conversa');
              return;
            }

            try {
              console.log('[ContatosRequerendoAtencao] 🔍 Buscando thread para contact_id:', item.contact_id);

              // Buscar thread canônica
              const threads = await base44.entities.MessageThread.filter({
                contact_id: item.contact_id,
                is_canonical: true
              }, '-last_message_at', 1);

              if (threads && threads.length > 0) {
                console.log('[ContatosRequerendoAtencao] ✅ Thread encontrada:', threads[0].id);
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
                setExpandido(false);
                toast.success('✅ Conversa aberta!');
              } else {
                console.warn('[ContatosRequerendoAtencao] ⚠️ Nenhuma thread encontrada');
                toast.error('❌ Conversa não disponível');
              }
            } catch (error) {
              console.error('[ContatosRequerendoAtencao] ❌ Erro ao abrir:', error);
              toast.error(`❌ ${error.message}`);
            }
          }}
          className="relative flex-shrink-0 mt-0.5 cursor-pointer hover:scale-105 transition-transform active:scale-95">

          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm bg-gradient-to-br from-orange-400 to-red-500">
            {item.nome?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <Badge className={`absolute -bottom-1 -right-1 ${getBucketCor(item.bucket_inactive)} text-white text-[8px] px-1 py-0 h-4 min-w-4 flex items-center justify-center`}>
            {item.bucket_inactive === 'active' ? '✓' : item.bucket_inactive}
          </Badge>
        </button>

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
          {item.root_causes && item.root_causes.length > 0 &&
          <p className="text-xs text-slate-600 mb-1 italic">
              • {item.root_causes[0]}
            </p>
          }

          <div className="flex items-center gap-1 flex-wrap">
            <Badge className={`${getPrioridadeCor(item.prioridadeLabel)} text-white text-[9px] px-1 py-0`}>
              {item.prioridadeLabel}
            </Badge>

            {item.deal_risk > 0 &&
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-300 text-red-700">
                Risco: {item.deal_risk}%
              </Badge>
            }

            {item.buy_intent > 0 &&
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-700">
                Intenção: {item.buy_intent}%
              </Badge>
            }

            {agrupadoPor !== 'atendente' &&
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-300 text-slate-600">
                <User className="w-2 h-2 inline mr-0.5" />
                {atendenteNome}
              </Badge>
            }
          </div>

          {/* Botões de ação */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                
                // Formatar dados analisados para copiar
                const dadosFormatados = `
📊 ANÁLISE IA - ${item.empresa || item.nome}

🎯 PRIORIDADE: ${item.prioridadeLabel}
   Score: ${item.prioridadeScore}/100

⏰ INATIVIDADE: ${item.days_inactive_inbound || 0} dias sem responder
   Bucket: ${item.bucket_inactive}

💼 ATENDENTE: ${atendenteNome}

📈 MÉTRICAS:
   • Intenção de Compra: ${item.buy_intent || 0}%
   • Engajamento: ${item.engagement || 0}%
   • Risco Deal: ${item.deal_risk || 0}%
   • Saúde Relação: ${item.health || 0}%

⚠️ MOTIVOS: ${item.root_causes?.join(', ') || 'N/A'}

${item.suggested_message ? `💬 SUGESTÃO IA:\n${item.suggested_message}` : ''}
`.trim();
                
                navigator.clipboard.writeText(dadosFormatados);
                toast.success('✅ Análise copiada!');
              }}
              className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors inline-block">

              📋 Copiar Análise
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                abrirAnaliseIA(item);
              }}
              className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors inline-block flex items-center gap-0.5">

              <Brain className="w-3 h-3" />
              Análise IA
            </button>
          </div>
          </div>
          </div>);

          };

  // ═══════════════════════════════════════════════════════════════
  // VERSÃO HEADER (compacta para o topo)
  // ═══════════════════════════════════════════════════════════════
  if (isHeader) {
    return (
      <div className="relative">
        <Button
          onClick={() => setExpandido(!expandido)}
          variant="outline"
          size="sm" className="bg-orange-500 text-slate-50 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-accent-foreground h-8 border-2 transition-all duration-300 shadow-md relative border-red-500 hover:bg-red-100"







          disabled={loading}>

          {loading ?
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :

          <AlertTriangle className={`w-4 h-4 mr-2 ${totalAlertas > 0 ? 'animate-pulse' : ''}`} />
          }
          <span className="font-semibold">Requerem Atenção</span>
          {totalAlertas > 0 &&
          <Badge className={`ml-2 font-bold text-xs shadow-sm ${
          totalAlertas >= 10 ? 'bg-red-600' :
          totalAlertas >= 5 ? 'bg-orange-600' :
          'bg-yellow-600'} text-white`
          }>
              {totalAlertas}
            </Badge>
          }
        </Button>

        {expandido &&
        <>
            <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setExpandido(false)} />

            <div className="absolute top-full right-0 mt-3 w-[420px] bg-white rounded-xl shadow-2xl border-2 border-slate-200 z-50 max-h-[650px] overflow-hidden flex flex-col">
              {/* Header do dropdown */}
              <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Contatos Urgentes</h3>
                    <p className="text-xs text-slate-500">
                      {totalAlertas} requerem atenção
                      {totalContatosBanco && <span className="text-slate-400"> • {totalContatosBanco} total</span>}
                    </p>
                  </div>
                </div>

                <Button
                size="sm"
                variant="ghost"
                onClick={refetch}
                disabled={loading}
                className="h-7 w-7 p-0 hover:bg-slate-200">

                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Filtros de agrupamento */}
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 space-y-2">
                {/* Configuração de dias */}
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
                
                <div className="flex gap-1.5">
                  <Button
                  size="sm"
                  variant={agrupadoPor === 'prioridade' ? 'default' : 'outline'}
                  onClick={() => setAgrupadoPor('prioridade')}
                  className="h-7 text-xs px-2.5 flex-1">

                    🔴 Prioridade
                  </Button>
                  <Button
                  size="sm"
                  variant={agrupadoPor === 'bucket' ? 'default' : 'outline'}
                  onClick={() => setAgrupadoPor('bucket')}
                  className="h-7 text-xs px-2.5 flex-1">

                    📅 Inatividade
                  </Button>
                  <Button
                  size="sm"
                  variant={agrupadoPor === 'atendente' ? 'default' : 'outline'}
                  onClick={() => setAgrupadoPor('atendente')}
                  className="h-7 text-xs px-2.5 flex-1">

                    👤 Atendente
                  </Button>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-2">
                  <Button
                  onClick={enviarPromocoesAutomaticas}
                  disabled={enviandoPromos || loading || totalAlertas === 0}
                  className="flex-1 h-8 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-50">

                    {enviandoPromos ?
                  <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Enviando...
                      </> :

                  <>
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        Auto ({totalAlertas})
                      </>
                  }
                  </Button>
                  <Button
                  onClick={abrirEnvioMassa}
                  disabled={contatosSelecionados.length === 0}
                  className="flex-1 h-8 text-xs bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md disabled:opacity-50">

                    <MessageSquare className="w-3.5 h-3.5 mr-1" />
                    Massa ({contatosSelecionados.length})
                  </Button>
                </div>

                {/* Selecionar todos */}
                {totalAlertas > 0 &&
              <Button
                onClick={toggleSelecionarTodos}
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs">

                    {contatosSelecionados.length === contatosComAlerta.length ? '❌ Desmarcar Todos' : '✅ Selecionar Todos'}
                  </Button>
              }
              </div>

              {/* Lista */}
              <div className="flex-1 overflow-y-auto scrollbar-custom">
                {loading ?
              <div className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-700">Analisando contatos...</p>
                    <p className="text-xs text-slate-500 mt-1">Aguarde um momento</p>
                  </div> :
              totalAlertas === 0 ?
              <div className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                      <Target className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">Tudo sob controle!</p>
                    <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção imediata</p>
                  </div> :

              Object.entries(grupos).map(([nomeGrupo, items]) => {
                if (!items || items.length === 0) return null;

                const grupoExpandido = gruposExpandidos[nomeGrupo] === true;

                return (
                  <div key={nomeGrupo} className="border-b border-slate-100">
                        {/* Header do grupo */}
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleGrupo(nomeGrupo)}
                            className="flex-1 px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
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
                          
                          {/* Botão Selecionar Grupo */}
                          {grupoExpandido && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelecionarGrupo(items);
                              }}
                              className="h-7 text-xs px-2 mr-2"
                            >
                              {items.every(i => contatosSelecionados.some(c => (c.contact_id || c.id) === (i.contact_id || i.id))) 
                                ? '❌ Desmarcar' 
                                : '✅ Todos'}
                            </Button>
                          )}
                        </div>

                        {/* Items */}
                        {grupoExpandido &&
                    <div className="bg-slate-50/50">
                            {items.map(renderContatoItem)}
                          </div>
                    }
                      </div>);

              })
              }
              </div>

              {/* Footer com estatísticas */}
              {estatisticas &&
            <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-t-2 border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-red-700 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        {criticos.length} críticos
                      </span>
                      <span className="flex items-center gap-1 text-orange-700 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        {altos.length} altos
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-600 font-medium">
                        Filtrados: {contatosComAlerta.length}
                      </div>
                      {totalContatosBanco && (
                        <div className="text-slate-400 text-[10px]">
                          Base total: {totalContatosBanco}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            }
            </div>
          </>
        }
      </div>);

  }

  // ═══════════════════════════════════════════════════════════════
  // VERSÃO SIDEBAR (original)
  // ═══════════════════════════════════════════════════════════════
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
              {/* Header */}
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

              {/* Conteúdo */}
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
                  {/* Priority Score */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">PRIORIDADE</span>
                      <Badge className={
                        dadosAnalise.priority_label === 'CRITICO' ? 'bg-red-500' :
                        dadosAnalise.priority_label === 'ALTO' ? 'bg-orange-500' :
                        dadosAnalise.priority_label === 'MEDIO' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }>
                        {dadosAnalise.priority_label || 'BAIXO'}
                      </Badge>
                    </div>
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

                  {/* AI Insights */}
                  {dadosAnalise.ai_insights && (
                    <div className="bg-purple-50 rounded-lg p-4 space-y-3">
                      {/* Sentimento */}
                      {dadosAnalise.ai_insights.sentiment && (
                        <div>
                          <p className="text-xs font-bold text-slate-700 mb-1">Sentimento</p>
                          <Badge className={
                            dadosAnalise.ai_insights.sentiment?.includes('positivo') 
                              ? 'bg-green-100 text-green-800' 
                              : dadosAnalise.ai_insights.sentiment?.includes('negativo')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-800'
                          }>
                            {dadosAnalise.ai_insights.sentiment}
                          </Badge>
                        </div>
                      )}

                      {/* Scores Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {dadosAnalise.ai_insights.buy_intent > 0 && (
                          <div className="bg-white rounded p-2">
                            <p className="text-slate-600">Intenção Compra</p>
                            <p className="font-bold text-green-600">{dadosAnalise.ai_insights.buy_intent}%</p>
                          </div>
                        )}
                        {dadosAnalise.ai_insights.engagement > 0 && (
                          <div className="bg-white rounded p-2">
                            <p className="text-slate-600">Engajamento</p>
                            <p className="font-bold text-blue-600">{dadosAnalise.ai_insights.engagement}%</p>
                          </div>
                        )}
                        {dadosAnalise.ai_insights.deal_risk > 0 && (
                          <div className="bg-white rounded p-2">
                            <p className="text-slate-600">Risco Deal</p>
                            <p className="font-bold text-red-600">{dadosAnalise.ai_insights.deal_risk}%</p>
                          </div>
                        )}
                        {dadosAnalise.ai_insights.health > 0 && (
                          <div className="bg-white rounded p-2">
                            <p className="text-slate-600">Saúde</p>
                            <p className="font-bold text-purple-600">{dadosAnalise.ai_insights.health}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Próxima Ação */}
                  {dadosAnalise.ai_insights?.next_best_action && (
                    <div className="bg-indigo-50 border-l-4 border-indigo-500 rounded p-3">
                      <p className="text-xs font-bold text-indigo-900 mb-1">🎯 Próxima Ação</p>
                      <p className="text-xs text-slate-700">{dadosAnalise.ai_insights.next_best_action.action}</p>
                      {dadosAnalise.ai_insights.next_best_action.deadline_hours && (
                        <p className="text-xs text-indigo-700 mt-1 font-semibold">
                          ⏱️ Prazo: {dadosAnalise.ai_insights.next_best_action.deadline_hours}h
                        </p>
                      )}
                    </div>
                  )}

                  {/* Root Causes */}
                  {dadosAnalise.root_causes?.length > 0 && (
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs font-bold text-orange-900 mb-2">⚠️ Motivos</p>
                      <div className="space-y-1">
                        {dadosAnalise.root_causes.map((cause, idx) => (
                          <div key={idx} className="text-xs text-slate-700">• {cause}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="border-b-2 border-slate-200 bg-gradient-to-r from-white to-slate-50">
              {/* Header clicável com auto-refresh após envio */}
              <button
                onClick={() => setExpandido(!expandido)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-all duration-200 group">

        <div className="flex items-center gap-2.5">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-all
            ${totalAlertas >= 10 ? 'bg-gradient-to-br from-red-500 to-red-600' :
          totalAlertas >= 5 ? 'bg-gradient-to-br from-orange-500 to-orange-600' :
          totalAlertas > 0 ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
          'bg-gradient-to-br from-slate-400 to-slate-500'}
          `}>
            <AlertTriangle className={`w-4 h-4 text-white ${totalAlertas > 0 ? 'animate-pulse' : ''}`} />
          </div>
          <div className="text-left">
            <span className="font-bold text-sm text-slate-800 block">
              Requerem Atenção
            </span>
            {totalAlertas > 0 &&
            <span className="text-xs text-slate-500">
                {criticos.length} críticos • {altos.length} altos
              </span>
            }
            {totalContatosBanco && (
              <span className="text-[10px] text-slate-400 block">
                Base: {totalContatosBanco} contatos
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {totalAlertas > 0 &&
          <Badge className={`font-bold text-xs shadow-sm ${
          totalAlertas >= 10 ? 'bg-red-600' :
          totalAlertas >= 5 ? 'bg-orange-600' :
          'bg-yellow-600'} text-white`
          }>
              {totalAlertas}
            </Badge>
          }
          
          {loading ?
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> :
          expandido ?
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> :

          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          }
        </div>
      </button>

      {/* Conteúdo expandido */}
      {expandido &&
      <div className="border-t-2 border-slate-200 bg-slate-50/30">
          {/* Toggle de agrupamento + Botão Promoções */}
          <div className="px-3 py-2.5 bg-slate-100 border-b border-slate-200 space-y-2">
            {/* Configuração de dias */}
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
            
            <div className="flex gap-1.5">
              <Button
              size="sm"
              variant={agrupadoPor === 'prioridade' ? 'default' : 'outline'}
              onClick={() => setAgrupadoPor('prioridade')}
              className="h-7 text-xs px-2.5 flex-1">

                🔴 Prioridade
              </Button>
              <Button
              size="sm"
              variant={agrupadoPor === 'bucket' ? 'default' : 'outline'}
              onClick={() => setAgrupadoPor('bucket')}
              className="h-7 text-xs px-2.5 flex-1">

                📅 Dias
              </Button>
              <Button
              size="sm"
              variant={agrupadoPor === 'atendente' ? 'default' : 'outline'}
              onClick={() => setAgrupadoPor('atendente')}
              className="h-7 text-xs px-2.5 flex-1">

                👤 Pessoa
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

            {/* Botões de Ação */}
            <div className="flex gap-2">
              <Button
              onClick={enviarPromocoesAutomaticas}
              disabled={enviandoPromos || loading || totalAlertas === 0}
              className="flex-1 h-8 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-50">

                {enviandoPromos ?
              <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Enviando...
                  </> :

              <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Auto ({totalAlertas})
                  </>
              }
              </Button>
              <Button
              onClick={abrirEnvioMassa}
              disabled={contatosSelecionados.length === 0}
              className="flex-1 h-8 text-xs bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md disabled:opacity-50">

                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                Massa ({contatosSelecionados.length})
              </Button>
            </div>

            {/* Botão selecionar todos */}
            {totalAlertas > 0 &&
          <Button
            onClick={toggleSelecionarTodos}
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs">

                {contatosSelecionados.length === contatosComAlerta.length ? '❌ Desmarcar Todos' : '✅ Selecionar Todos'}
              </Button>
          }
          </div>

          {/* Lista de grupos */}
          <div className="max-h-[400px] overflow-y-auto scrollbar-custom">
            {loading ?
          <div className="p-6 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-orange-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">Analisando contatos...</p>
                <p className="text-xs text-slate-500 mt-1">Aguarde um momento</p>
              </div> :
          totalAlertas === 0 ?
          <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Target className="w-7 h-7 text-green-600" />
                </div>
                <p className="text-sm font-bold text-slate-800">Tudo sob controle!</p>
                <p className="text-xs text-slate-500 mt-1">Nenhum contato requer atenção imediata</p>
              </div> :

          Object.entries(grupos).map(([nomeGrupo, items]) => {
            if (!items || items.length === 0) return null;

            const grupoExpandido = gruposExpandidos[nomeGrupo] === true;

            return (
              <div key={nomeGrupo} className="border-b border-slate-100">
                    {/* Header do grupo */}
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleGrupo(nomeGrupo)}
                        className="flex-1 px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
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
                      
                      {/* Botão Selecionar Grupo */}
                      {grupoExpandido && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelecionarGrupo(items);
                          }}
                          className="h-7 text-xs px-2 mr-2"
                        >
                          {items.every(i => contatosSelecionados.some(c => (c.contact_id || c.id) === (i.contact_id || i.id))) 
                            ? '❌ Desmarcar' 
                            : '✅ Todos'}
                        </Button>
                      )}
                    </div>

                    {/* Items */}
                    {grupoExpandido &&
                <div className="bg-slate-50/50">
                        {items.map(renderContatoItem)}
                      </div>
                }
                  </div>);

          })
          }
          </div>

          {/* Footer com estatísticas */}
          {estatisticas &&
        <div className="px-4 py-3 bg-gradient-to-r from-slate-100 to-slate-50 border-t-2 border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-red-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    {criticos.length} críticos
                  </span>
                  <span className="flex items-center gap-1.5 text-orange-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    {altos.length} altos
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-slate-600 font-medium">
                    Filtrados: {contatosComAlerta.length}
                  </div>
                  {totalContatosBanco && (
                    <div className="text-slate-400 text-[10px]">
                      Base total: {totalContatosBanco}
                    </div>
                  )}
                </div>
              </div>
            </div>
        }
        </div>
      }


      </div>
    </>
  );
}