
import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Zap, ArrowRight, Clock, CheckCircle, Brain } from 'lucide-react'; // Added Brain icon
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import NexusEngineV3 from '../inteligencia/NexusEngineV3'; // Added import for NexusEngineV3

// --- Card do Alerta ---
function AlertaCard({ alerta, onAcaoIA }) {
  const obterEstiloPrioridade = (prioridade) => {
    switch (prioridade) {
      case 'critica': return {
        gradiente: 'bg-gradient-to-br from-red-500 via-red-600 to-red-700',
        badge: 'bg-white/90 text-red-800 font-bold'
      };
      case 'alta': return {
        gradiente: 'bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600',
        badge: 'bg-white/90 text-orange-800 font-bold'
      };
      default: return {
        gradiente: 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-500',
        badge: 'bg-black/80 text-yellow-100 font-bold'
      };
    }
  };

  const obterIconePrioridade = (prioridade) => {
    switch (prioridade) {
      case 'critica': return <AlertTriangle className="w-4 h-4" />;
      case 'alta': return <Clock className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const estilo = obterEstiloPrioridade(alerta.prioridade);

  return (
    <div
      className={`relative w-full h-24 ${estilo.gradiente} rounded-lg p-3 text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer flex flex-col justify-between`}
      onClick={() => onAcaoIA && onAcaoIA(alerta)}
    >
      <div className="flex items-center justify-between">
        {obterIconePrioridade(alerta.prioridade)}
        <Badge className={`${estilo.badge} text-[10px] px-1 py-0`}>
          {alerta.prioridade.toUpperCase()}
        </Badge>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <p className="font-bold text-xs leading-tight mb-1 line-clamp-1">{alerta.cliente}</p>
        <p className="text-[10px] opacity-90 line-clamp-1">{alerta.titulo}</p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[9px] opacity-80 line-clamp-1 flex-1 mr-1">{alerta.acaoSugerida}</p>
        <ArrowRight className="w-3 h-3 opacity-80 flex-shrink-0" />
      </div>
      {alerta.contextoCom && ( // Display context if available
        <div className="absolute bottom-1 left-2 right-2 text-[8px] text-white/70 flex items-center gap-1">
          <Brain className="w-2.5 h-2.5" />
          <span>{alerta.contextoCom}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg pointer-events-none" />
    </div>
  );
}


// --- Componente Principal Flutuante ---
export default function LembreteFlutuanteIA({ orcamentos, usuario, onAcaoIA }) {
  const [alertas, setAlertas] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [conhecimentosRelevantes, setConhecimentosRelevantes] = useState([]); // New state for relevant knowledge

  const analisarFluxoIA = useCallback(async () => { // Made async
    if (!orcamentos || !Array.isArray(orcamentos)) {
        setAlertas([]);
        return;
    }

    const novosAlertas = [];
    let currentConhecimentosForAlerts = []; // Local variable to use immediately

    // ═══════════════════════════════════════════════════════════
    // 🆕 CONSULTAR CONHECIMENTO DA NKDB PARA ALERTAS MAIS RICOS
    // ═══════════════════════════════════════════════════════════
    try {
      const conhecimentos = await NexusEngineV3.consultarConhecimento({
        tipo_registro: 'resultado_acao',
        categoria: 'estrategia',
        tags: ['urgente', 'alerta'],
        limite: 5
      });

      setConhecimentosRelevantes(conhecimentos); // Update state for UI indicator
      currentConhecimentosForAlerts = conhecimentos; // Use this for enriching current alerts
    } catch (error) {
      console.warn('[LembreteFlutuanteIA] Erro ao buscar conhecimento:', error);
    }

    // Análise tradicional de orçamentos
    orcamentos.forEach((orcamento) => {
      if (!orcamento.created_date || !orcamento.status) return;
      const diasDesdeCriacao = Math.floor(
        (new Date() - new Date(orcamento.created_date)) / (1000 * 60 * 60 * 24)
      );

      switch (orcamento.status) {
        case 'aguardando_cotacao':
          if (diasDesdeCriacao > 2) novosAlertas.push({
            id: `cotacao_${orcamento.id}`,
            prioridade: diasDesdeCriacao > 5 ? 'critica' : 'alta',
            titulo: 'Cotação Atrasada',
            cliente: orcamento.cliente_nome,
            orcamentoId: orcamento.id,
            tipo: 'atraso_interno',
            responsavel: 'compras',
            acaoSugerida: 'Cobrar setor de compras',
            contextoCom: currentConhecimentosForAlerts.length > 0 ? '🧠 Com base em conhecimento histórico' : null // Added context
          });
          break;
        case 'aguardando_analise':
          if (diasDesdeCriacao > 3) novosAlertas.push({
            id: `analise_${orcamento.id}`,
            prioridade: diasDesdeCriacao > 7 ? 'critica' : 'alta',
            titulo: 'Análise Pendente',
            cliente: orcamento.cliente_nome,
            orcamentoId: orcamento.id,
            tipo: 'atraso_interno',
            responsavel: 'gerencia',
            acaoSugerida: 'Notificar gerente de vendas'
          });
          break;
        case 'liberado':
          if (diasDesdeCriacao > 1) novosAlertas.push({
            id: `envio_${orcamento.id}`,
            prioridade: diasDesdeCriacao > 3 ? 'alta' : 'media',
            titulo: 'Pronto para Envio',
            cliente: orcamento.cliente_nome,
            orcamentoId: orcamento.id,
            tipo: 'acao_vendedor',
            responsavel: 'vendedor',
            acaoSugerida: 'Enviar para o cliente'
          });
          break;
        case 'enviado':
          if (diasDesdeCriacao > 3) novosAlertas.push({
            id: `followup_${orcamento.id}`,
            prioridade: diasDesdeCriacao > 7 ? 'alta' : 'media',
            titulo: 'Follow-up Necessário',
            cliente: orcamento.cliente_nome,
            orcamentoId: orcamento.id,
            tipo: 'acao_vendedor',
            responsavel: 'vendedor',
            acaoSugerida: 'Fazer follow-up com cliente'
          });
          break;
        case 'negociando':
          if (diasDesdeCriacao > 7) novosAlertas.push({
            id: `negociacao_${orcamento.id}`,
            prioridade: diasDesdeCriacao > 14 ? 'critica' : 'alta',
            titulo: 'Negociação Prolongada',
            cliente: orcamento.cliente_nome,
            orcamentoId: orcamento.id,
            tipo: 'acao_vendedor',
            responsavel: 'vendedor',
            acaoSugerida: 'Acelerar fechamento'
          });
          break;
      }
    });

    const alertasFiltrados = novosAlertas.filter((alerta) => {
      if (!usuario) return false;
      if (usuario.role === 'admin') return true;
      if (alerta.tipo === 'acao_vendedor' && usuario.role === 'user') return true;
      if (alerta.responsavel === 'vendedor' && usuario.role === 'user') return true;
      return false;
    });

    setAlertas(alertasFiltrados.sort((a, b) => {
        const prioridades = { critica: 0, alta: 1, media: 2 };
        return prioridades[a.prioridade] - prioridades[b.prioridade];
    }));
  }, [orcamentos, usuario]); // Dependencies for useCallback remain the same

  useEffect(() => {
    analisarFluxoIA();
  }, [analisarFluxoIA]); // useEffect dependency on analisarFluxoIA

  if (alertas.length === 0 && !isOpen && conhecimentosRelevantes.length === 0) { // Condition updated to consider knowledge
    return null;
  }

  return (
    <>
      {/* Botão Flutuante */}
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-2xl shadow-orange-500/30 z-40 border-2 border-white/20 transition-all duration-300 hover:scale-110 ${isOpen ? 'hidden' : 'flex'}`}
      >
        <AlertTriangle className="w-6 h-6 text-white" />
        {alertas.length > 0 && (
          <Badge className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full px-2 py-0.5 text-xs font-bold border-2 border-amber-500">
            {alertas.length}
          </Badge>
        )}
      </Button>

      {/* Painel de Alertas */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm bg-slate-800/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-slate-700/50 transition-all duration-300 animate-in fade-in-50 slide-in-from-bottom-5">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">Lembretes da IA</h3>
                <Badge className="bg-red-500 text-white text-xs">{alertas.length}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-slate-700 hover:text-white h-8 w-8" onClick={() => setIsOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* 🆕 Indicador de Conhecimento */}
            {conhecimentosRelevantes.length > 0 && (
              <div className="mb-3 p-2 bg-purple-900/50 rounded-lg border border-purple-500/30">
                <p className="text-xs text-purple-200 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  Alertas enriquecidos com {conhecimentosRelevantes.length} conhecimentos da NKDB
                </p>
              </div>
            )}

            {alertas.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-2">
                    {alertas.map(alerta => (
                        <AlertaCard key={alerta.id} alerta={alerta} onAcaoIA={onAcaoIA} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center text-center py-8 text-white">
                    <CheckCircle className="w-10 h-10 text-green-400 mb-3" />
                    <p className="font-semibold">Nenhuma ação pendente!</p>
                    <p className="text-sm text-slate-300">Seu fluxo de trabalho está em dia.</p>
                </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
