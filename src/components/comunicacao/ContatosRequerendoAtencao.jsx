import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  MessageSquare } from
'lucide-react';
import { toast } from 'sonner';
import { useContatosInteligentes } from '../hooks/useContatosInteligentes';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function ContatosRequerendoAtencao({ usuario, onSelecionarContato, variant = 'sidebar' }) {
  const [expandido, setExpandido] = useState(false);
  const [agrupadoPor, setAgrupadoPor] = useState('prioridade'); // prioridade | atendente | bucket
  const [gruposExpandidos, setGruposExpandidos] = useState({});
  const [usuariosMap, setUsuariosMap] = useState({});
  const [enviandoPromos, setEnviandoPromos] = useState(false);
  const [contatosSelecionados, setContatosSelecionados] = useState([]);
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
          contatosComAlerta.
          map((c) => c.vendedor_responsavel || c.assigned_user_id).
          filter(Boolean)
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

    const confirmacao = window.confirm(
      `🚀 Enviar promoções automáticas para ${contatosComAlerta.length} contatos?\n\n` +
      `Processo:\n` +
      `1️⃣ Saudação personalizada (agora)\n` +
      `2️⃣ Aguardar 5 minutos\n` +
      `3️⃣ Enviar promoção ativa\n\n` +
      `Bloqueios: Fornecedores, tags bloqueadas, financeiro\n` +
      `Tempo estimado: ${Math.ceil(contatosComAlerta.length * 0.8)}s para saudações`
    );

    if (!confirmacao) return;

    setEnviandoPromos(true);

    try {
      const contactIds = contatosComAlerta.map((c) => c.contact_id || c.id);

      toast.loading(`📤 Enviando saudações para ${contactIds.length} contatos...`, { id: 'envio-lote' });

      const resultado = await base44.functions.invoke('enviarCampanhaLote', {
        contact_ids: contactIds,
        modo: 'promocao',
        delay_minutos: 5
      });

      if (resultado.data?.success) {
        toast.success(
          `✅ ${resultado.data.enviados} saudações enviadas!\n` +
          `⏰ Promoções serão enviadas em 5 minutos`,
          { id: 'envio-lote', duration: 5000 }
        );

        // Mostrar resumo dos resultados
        if (resultado.data.erros > 0) {
          toast.warning(
            `⚠️ ${resultado.data.erros} contatos com erro`,
            { duration: 4000 }
          );
        }
      } else {
        throw new Error(resultado.data?.error || 'Erro desconhecido');
      }

    } catch (error) {
      console.error('[ContatosRequerendoAtencao] Erro ao enviar promoções:', error);
      toast.error(`❌ ${error.message}`, { id: 'envio-lote' });
    } finally {
      setEnviandoPromos(false);
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

        {/* Avatar */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            
            if (!onSelecionarContato) return;
            
            try {
              let threadId = item.thread_id;
              
              if (!threadId) {
                toast.info('🔄 Buscando conversa...');
                const threads = await base44.entities.MessageThread.filter({
                  contact_id: item.contact_id,
                  is_canonical: true
                }, '-last_message_at', 1);
                
                if (!threads.length) {
                  toast.error('❌ Conversa não encontrada. Crie um novo contato.');
                  return;
                }
                
                threadId = threads[0].id;
              }
              
              onSelecionarContato({
                id: threadId,
                contatoPreCarregado: {
                  id: item.contact_id,
                  nome: item.nome,
                  empresa: item.empresa,
                  telefone: item.telefone,
                  tipo_contato: item.tipo_contato,
                  vendedor_responsavel: item.vendedor_responsavel,
                  score_engajamento: item.engagement,
                  cliente_score: item.health
                }
              });
              
              setExpandido(false);
              
            } catch (error) {
              console.error('[ContatosRequerendoAtencao] Erro ao abrir:', error);
              toast.error('❌ Erro ao abrir conversa');
            }
          }}
          className="relative flex-shrink-0 mt-0.5 cursor-pointer hover:scale-105 transition-transform">

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

          {/* Mensagem sugerida (preview) */}
          {item.suggested_message &&
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(item.suggested_message);
              toast.success('✅ Mensagem copiada!');
            }}
            className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors mt-1 inline-block">

              📋 Copiar Sugestão IA
            </button>
          }
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
                    <p className="text-xs text-slate-500">{totalAlertas} requerem atenção</p>
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
                    <span className="text-slate-600 font-medium">
                      Total: {contatosComAlerta.length}
                    </span>
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
    <div className="border-b-2 border-slate-200 bg-gradient-to-r from-white to-slate-50">
      {/* Header clicável */}
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
                <span className="text-slate-600 font-medium">
                  Total: {contatosComAlerta.length}
                </span>
              </div>
            </div>
        }
        </div>
      }


    </div>);

}