import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, Zap, CheckCircle, TrendingUp, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Componente para monitoramento inteligente do fluxo
export default function FluxoInteligente({ orcamentos, usuario, onAcaoIA }) {
  const [alertas, setAlertas] = useState([]);

  const analisarFluxoIA = useCallback(() => {
    const novosAlertas = [];

    orcamentos.forEach((orcamento) => {
      const diasDesdeCriacao = Math.floor(
        (new Date() - new Date(orcamento.created_date)) / (1000 * 60 * 60 * 24)
      );

      // Lógica de alertas por etapa
      switch (orcamento.status) {
        case 'aguardando_cotacao':
          if (diasDesdeCriacao > 2) {
            novosAlertas.push({
              id: `cotacao_${orcamento.id}`,
              tipo: 'atraso_interno',
              prioridade: diasDesdeCriacao > 5 ? 'critica' : 'alta',
              titulo: 'Cotação Atrasada',
              mensagem: `Aguardando cotação há ${diasDesdeCriacao} dias.`,
              cliente: orcamento.cliente_nome,
              orcamentoId: orcamento.id,
              responsavel: 'compras',
              diasAtraso: diasDesdeCriacao - 2,
              acaoSugerida: 'Cobrar setor de compras'
            });
          }
          break;

        case 'aguardando_analise':
          if (diasDesdeCriacao > 3) {
            novosAlertas.push({
              id: `analise_${orcamento.id}`,
              tipo: 'atraso_interno',
              prioridade: diasDesdeCriacao > 7 ? 'critica' : 'alta',
              titulo: 'Análise Pendente',
              mensagem: `Precisa de análise gerencial há ${diasDesdeCriacao} dias.`,
              cliente: orcamento.cliente_nome,
              orcamentoId: orcamento.id,
              responsavel: 'gerencia',
              diasAtraso: diasDesdeCriacao - 3,
              acaoSugerida: 'Notificar gerente de vendas'
            });
          }
          break;

        case 'liberado':
          if (diasDesdeCriacao > 1) {
            novosAlertas.push({
              id: `envio_${orcamento.id}`,
              tipo: 'acao_vendedor',
              prioridade: diasDesdeCriacao > 3 ? 'alta' : 'media',
              titulo: 'Pronto para Envio',
              mensagem: `Liberado há ${diasDesdeCriacao} dias. Enviar ao cliente.`,
              cliente: orcamento.cliente_nome,
              orcamentoId: orcamento.id,
              responsavel: 'vendedor',
              diasAtraso: diasDesdeCriacao - 1,
              acaoSugerida: 'Enviar para o cliente'
            });
          }
          break;

        case 'enviado':
          if (diasDesdeCriacao > 3) {
            novosAlertas.push({
              id: `followup_${orcamento.id}`,
              tipo: 'acao_vendedor',
              prioridade: diasDesdeCriacao > 7 ? 'alta' : 'media',
              titulo: 'Follow-up Necessário',
              mensagem: `Enviado há ${diasDesdeCriacao} dias sem retorno.`,
              cliente: orcamento.cliente_nome,
              orcamentoId: orcamento.id,
              responsavel: 'vendedor',
              diasAtraso: diasDesdeCriacao - 3,
              acaoSugerida: 'Fazer follow-up com cliente'
            });
          }
          break;

        case 'negociando':
          if (diasDesdeCriacao > 7) {
            novosAlertas.push({
              id: `negociacao_${orcamento.id}`,
              tipo: 'acao_vendedor',
              prioridade: diasDesdeCriacao > 14 ? 'critica' : 'alta',
              titulo: 'Negociação Prolongada',
              mensagem: `Em negociação há ${diasDesdeCriacao} dias.`,
              cliente: orcamento.cliente_nome,
              orcamentoId: orcamento.id,
              responsavel: 'vendedor',
              diasAtraso: diasDesdeCriacao - 7,
              acaoSugerida: 'Acelerar fechamento'
            });
          }
          break;
      }
    });

    setAlertas(novosAlertas.sort((a, b) => {
        const prioridades = { critica: 0, alta: 1, media: 2 };
        return prioridades[a.prioridade] - prioridades[b.prioridade];
    }));
  }, [orcamentos]);

  useEffect(() => {
    analisarFluxoIA();
  }, [analisarFluxoIA, usuario]);

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
      case 'media': return { 
        gradiente: 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-500', 
        badge: 'bg-black/80 text-yellow-100 font-bold' 
      };
      default: return { 
        gradiente: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600', 
        badge: 'bg-white/90 text-blue-800 font-bold' 
      };
    }
  };

  const obterIconePrioridade = (prioridade) => {
    switch (prioridade) {
      case 'critica': return <AlertTriangle className="w-4 h-4" />;
      case 'alta': return <Clock className="w-4 h-4" />;
      case 'media': return <Zap className="w-4 h-4" />;
      default: return <TrendingUp className="w-4 h-4" />;
    }
  };

  // Filtrar alertas relevantes para o usuário
  const alertasRelevantes = alertas.filter((alerta) => {
    if (!usuario) return false;
    if (usuario.role === 'admin') return true;
    if (alerta.tipo === 'acao_vendedor' && usuario.role === 'user') return true;
    if (alerta.responsavel === 'vendedor' && usuario.role === 'user') return true;
    return false;
  });

  if (alertasRelevantes.length === 0) {
    return (
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl p-4 flex items-center justify-center text-center shadow-lg max-w-xs mx-auto">
        <div>
          <CheckCircle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-bold text-sm">Fluxo em Dia!</h3>
          <p className="text-xs opacity-90">Todos os orçamentos estão dentro dos prazos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <h3 className="text-lg font-semibold text-slate-800">🤖 IA - Monitor de Fluxo</h3>
        <Badge className="bg-red-100 text-red-800 text-xs font-bold">
          {alertasRelevantes.length}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {alertasRelevantes.map((alerta) => {
          const estilo = obterEstiloPrioridade(alerta.prioridade);
          return (
            <div 
              key={alerta.id} 
              className={`
                relative w-32 h-24 ${estilo.gradiente} rounded-lg p-3 text-white shadow-lg 
                transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer
                flex flex-col justify-between
              `}
              onClick={() => onAcaoIA && onAcaoIA(alerta)}
            >
              {/* Header com ícone e prioridade */}
              <div className="flex items-center justify-between">
                {obterIconePrioridade(alerta.prioridade)}
                <Badge className={`${estilo.badge} text-[10px] px-1 py-0`}>
                  {alerta.prioridade.toUpperCase()}
                </Badge>
              </div>

              {/* Conteúdo principal */}
              <div className="flex-1 flex flex-col justify-center">
                <p className="font-bold text-xs leading-tight mb-1 line-clamp-1">
                  {alerta.cliente}
                </p>
                <p className="text-[10px] opacity-90 line-clamp-1">
                  {alerta.titulo}
                </p>
              </div>

              {/* Footer com ação */}
              <div className="flex items-center justify-between">
                <p className="text-[9px] opacity-80 line-clamp-1 flex-1 mr-1">
                  {alerta.acaoSugerida}
                </p>
                <ArrowRight className="w-3 h-3 opacity-80 flex-shrink-0" />
              </div>

              {/* Overlay de brilho */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg pointer-events-none" />
            </div>
          );
        })}
      </div>
    </div>
  );
}