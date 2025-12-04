
import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Search,
  Eye,
  CheckCircle2,
  Send,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Clock,
  AlertTriangle,
  Zap } from
'lucide-react';

// Configuração das etapas separadas por fluxo
const statusConfig = {
  // ETAPA INTERNA (Sistema/Compras/Gerência)
  rascunho: {
    label: 'Rascunho',
    icon: FileText,
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    etapa: 'interna',
    responsavel: ['admin', 'compras'],
    prazoIdeal: 0
  },
  aguardando_cotacao: {
    label: 'Aguard. Cotação',
    icon: Search,
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    etapa: 'interna',
    responsavel: ['admin', 'compras'],
    prazoIdeal: 2
  },
  analisando: {
    label: 'Analisando',
    icon: Eye,
    color: 'bg-violet-100 text-violet-800 border-violet-300',
    etapa: 'interna',
    responsavel: ['admin'],
    prazoIdeal: 1
  },
  liberado: {
    label: 'Liberado',
    icon: CheckCircle2,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    etapa: 'interna',
    responsavel: ['admin', 'user'],
    prazoIdeal: 0
  },

  // ETAPA DE NEGOCIAÇÃO (Vendedor/Cliente)
  enviado: {
    label: 'Enviado',
    icon: Send,
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    etapa: 'negociacao',
    responsavel: ['admin', 'user'],
    prazoIdeal: 0
  },
  negociando: {
    label: 'Negociando',
    icon: MessageSquare,
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    etapa: 'negociacao',
    responsavel: ['admin', 'user'],
    prazoIdeal: 7
  },
  aprovado: {
    label: 'Aprovado',
    icon: ThumbsUp,
    color: 'bg-green-100 text-green-800 border-green-300',
    etapa: 'negociacao',
    responsavel: ['admin', 'user'],
    prazoIdeal: 0
  },
  rejeitado: {
    label: 'Rejeitado',
    icon: ThumbsDown,
    color: 'bg-red-100 text-red-800 border-red-300',
    etapa: 'negociacao',
    responsavel: ['admin', 'user'],
    prazoIdeal: 0
  },
  vencido: {
    label: 'Vencido',
    icon: Clock,
    color: 'bg-red-100 text-red-800 border-red-300',
    etapa: 'negociacao',
    responsavel: ['admin', 'user'],
    prazoIdeal: 0
  }
};

// Fluxos lineares organizados
const fluxoEtapaInterna = ['rascunho', 'aguardando_cotacao', 'analisando', 'liberado'];
const fluxoEtapaNegociacao = ['enviado', 'negociando', 'aprovado', 'rejeitado', 'vencido'];

// Função para calcular se o orçamento está atrasado
const calcularAtraso = (orcamento) => {
  if (!orcamento.data_orcamento || !orcamento.status) return { atrasado: false, dias: 0 };

  const config = statusConfig[orcamento.status];
  if (!config || config.prazoIdeal === 0) return { atrasado: false, dias: 0 };

  const dataInicio = new Date(orcamento.data_orcamento);
  const hoje = new Date();
  const diasDecorridos = Math.floor((hoje - dataInicio) / (1000 * 60 * 60 * 24));
  const atrasado = diasDecorridos > config.prazoIdeal;

  return { atrasado, dias: diasDecorridos - config.prazoIdeal };
};

// Componente do Fluxo Linear
function FluxoLinear({ fluxo, statusAtual, orcamentos, titulo, corTema, onStatusClick }) {
  const statusCounts = fluxo.reduce((acc, status) => {
    const orcamentosStatus = orcamentos?.filter((o) => o.status === status) || [];
    const count = orcamentosStatus.length;
    const total = orcamentosStatus.reduce((sum, o) => sum + (o.valor_total || 0), 0);
    const atrasados = orcamentosStatus.filter((o) => calcularAtraso(o).atrasado).length;
    acc[status] = { count, total, atrasados };
    return acc;
  }, {});

  const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className={`bg-gradient-to-r px-3 py-4 ${corTema} backdrop-blur-xl rounded-xl border border-white/20 shadow-lg flex-1`}>
      <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
        {titulo}
      </h3>
      
      {/* Fluxo Linear */}
      <div className="relative">
        {/* Linha de conexão */}
        <div className="absolute top-4 left-4 right-4 h-px bg-white/20"></div>
        
        {/* Steps */}
        <div className="flex justify-between items-start relative">
          {fluxo.map((status, index) => {
            const config = statusConfig[status];
            const Icon = config.icon;
            const data = statusCounts[status];
            const isAtual = statusAtual === status;
            const temDados = data.count > 0;

            return (
              <div key={status} className="flex flex-col items-center relative group cursor-pointer" onClick={() => onStatusClick && onStatusClick(status)}>
                {/* Círculo do Status */}
                <div className={`
                  relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110
                  ${isAtual ?
                'bg-yellow-400 text-slate-800 shadow-lg ring-4 ring-yellow-300/50 animate-pulse' :
                temDados ?
                'bg-white/90 text-gray-600 hover:bg-white' :
                'bg-white/20 text-white/60 hover:bg-white/30'}
                `
                }>
                  <Icon className="w-4 h-4" />
                  
                  {/* Badge de alertas */}
                  {data.atrasados > 0 &&
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center border-2 border-slate-800">
                      <span className="text-[8px] text-white font-bold">{data.atrasados}</span>
                    </div>
                  }
                </div>
                
                {/* Label e Dados */}
                <div className="mt-1 text-center min-h-[1.5rem]">
                  <div className={`text-[10px] font-medium ${isAtual ? 'text-yellow-300 font-bold' : 'text-white/80'}`}>
                    {config.label}
                  </div>
                  
                  {temDados &&
                  <div className="space-y-0.5">
                      <div className={`text-xs font-bold ${isAtual ? 'text-yellow-200' : 'text-white/90'}`}>
                        {data.count}
                      </div>
                    </div>
                  }
                </div>
                
                {/* Tooltip em hover */}
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  {config.label}: {data.count} | {formatCurrency(data.total)}
                  {data.atrasados > 0 && ` (${data.atrasados} ⚠️)`}
                </div>
              </div>);

          })}
        </div>
      </div>
    </div>);

}

export default function StatusPipeline({ orcamentos, currentStatus, onStatusChange, showInteractive = false, usuario }) {
  // Se for o pipeline do cabeçalho (overview geral)
  if (!currentStatus) {
    return (
      <div className="flex gap-4 mb-6">
        {/* Etapa Interna */}
        <FluxoLinear
          fluxo={fluxoEtapaInterna}
          statusAtual={null}
          orcamentos={orcamentos}
          titulo="Etapa Interna"
          corTema="from-blue-600/90 via-indigo-600/90 to-purple-600/90" />

        
        {/* Etapa de Negociação */}
        <FluxoLinear
          fluxo={fluxoEtapaNegociacao}
          statusAtual={null}
          orcamentos={orcamentos}
          titulo="Etapa de Negociação"
          corTema="from-orange-600/90 via-amber-600/90 to-yellow-600/90" />

      </div>);

  }

  // Se for o pipeline interativo individual
  const config = statusConfig[currentStatus] || statusConfig.rascunho;
  const Icon = config.icon;

  if (!showInteractive) {
    return (
      <Badge className={`${config.color} border font-medium`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>);

  }

  // Verificar permissões do usuário
  const temPermissao = usuario && config.responsavel.includes(usuario.role);

  return (
    <select
      value={currentStatus}
      onChange={(e) => onStatusChange(e.target.value)}
      disabled={!temPermissao}
      className={`${config.color} border rounded-md px-2 py-1 text-xs font-medium cursor-pointer ${
      !temPermissao ? 'opacity-50 cursor-not-allowed' : ''}`
      }>

      {Object.entries(statusConfig).map(([status, statusConfig]) =>
      <option key={status} value={status}>{statusConfig.label}</option>
      )}
    </select>);

}
