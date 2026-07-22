import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  Edit,
  Eye,
  DollarSign,
  Users,
  MessageSquare,
  NotebookPen
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AtribuidorAtendenteRapido from '../comunicacao/AtribuidorAtendenteRapido';
import ClienteHistoricoDrawer from './ClienteHistoricoDrawer';
import EtiquetaRecorrencia from './EtiquetaRecorrencia';
import EtiquetaFaixaFaturamento from './EtiquetaFaixaFaturamento';
import ClienteChatDrawer from './ClienteChatDrawer';
import { diasParado } from './LegendaTotalizadoresClientes';
import useChatIndicadores from '../crm/useChatIndicadores';

export default function ClienteKanbanCard({ cliente, score, isDragging, onEdit, onViewDetails, statusGradient }) {
  const [historicoOpen, setHistoricoOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const { getIndicadorCliente } = useChatIndicadores();
  const indicadorChat = getIndicadorCliente(cliente);
  const temTelefone = cliente?.telefone || cliente?.celular;
  const dias = diasParado(cliente);

  const getDiasColor = (d) => {
    if (d === null) return null;
    if (d > 60) return 'bg-red-500 text-white';
    if (d >= 21) return 'bg-amber-400 text-amber-900';
    return 'bg-emerald-500 text-white';
  };
  const getScoreColor = (scoreTotal) => {
    if (!scoreTotal) return 'text-slate-600 bg-slate-100';
    if (scoreTotal >= 700) return 'text-green-700 bg-green-100';
    if (scoreTotal >= 500) return 'text-blue-700 bg-blue-100';
    if (scoreTotal >= 300) return 'text-amber-700 bg-amber-100';
    return 'text-red-700 bg-red-100';
  };

  const getUrgenciaColor = (urgencia) => {
    if (!urgencia) return 'bg-slate-100 text-slate-700';
    if (urgencia >= 70) return 'bg-red-100 text-red-700';
    if (urgencia >= 40) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const getRiscoColor = (risco) => {
    if (!risco) return 'bg-slate-100 text-slate-700';
    if (risco === 'critico' || risco === 'alto') return 'bg-red-100 text-red-700';
    if (risco === 'medio') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const getClassificacaoColor = (classificacao) => {
    if (classificacao === 'A - Alto Potencial') return 'bg-orange-500 text-white border-orange-600';
    if (classificacao === 'B - Médio Potencial') return 'bg-orange-400 text-white border-orange-500';
    if (classificacao === 'C - Baixo Potencial') return 'bg-slate-400 text-white border-slate-500';
    return 'bg-gray-400 text-white';
  };

  return (
    <Card
      className={`group hover:shadow-lg transition-all duration-300 cursor-move overflow-hidden rounded-xl border border-slate-200 ${
        isDragging ? 'opacity-70 rotate-2 scale-105 shadow-xl shadow-orange-300/50' : ''
      } bg-white`}
    >
      {/* Header com gradiente laranja→vermelho */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-sm leading-snug truncate">
            {cliente.razao_social || cliente.nome_fantasia || 'Cliente Sem Nome'}
          </h3>
          {cliente.nome_fantasia && cliente.razao_social !== cliente.nome_fantasia && (
            <p className="text-[10px] text-white/80 truncate">{cliente.nome_fantasia}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {dias !== null && (
            <span
              title="Dias desde o último contato"
              className={`rounded-full px-2 py-0.5 text-[10px] font-black shadow-sm ${getDiasColor(dias)}`}
            >
              {dias}d parado
            </span>
          )}
          {score?.score_total && (
            <span className="bg-white text-slate-900 rounded-full px-2.5 py-0.5 text-[11px] font-black shadow-sm">
              {score.score_total}
            </span>
          )}
          {cliente.classificacao && (
            <span className="bg-white text-slate-900 rounded-full w-6 h-6 flex items-center justify-center text-[11px] font-black shadow-sm">
              {cliente.classificacao.split(' - ')[0]}
            </span>
          )}
        </div>
      </div>

      <CardContent className="p-3 space-y-2.5">
        {/* Etiquetas de recorrência e faixa de faturamento (fonte: campos persistidos) */}
        {(cliente.etiqueta_recorrencia && cliente.etiqueta_recorrencia !== 'none') || (cliente.faixa_faturamento && cliente.faixa_faturamento !== 'none') ? (
          <div className="flex flex-wrap gap-1">
            <EtiquetaRecorrencia etiqueta={cliente.etiqueta_recorrencia} />
            <EtiquetaFaixaFaturamento faixa={cliente.faixa_faturamento} />
          </div>
        ) : null}

        {/* Contatos em coluna */}
        <div className="space-y-1.5 text-[11px]">
          {cliente.telefone && (
            <div className="flex items-center gap-2 text-slate-700">
              <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="truncate">{cliente.telefone}</span>
            </div>
          )}
          {cliente.email && (
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="truncate">{cliente.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <AtribuidorAtendenteRapido
              contato={{
                id: cliente.id,
                vendedor_responsavel: cliente.vendedor_responsavel,
                tipo_contato: 'cliente'
              }}
              tipoContato="cliente"
              setorAtual="vendas"
              variant="mini"
            />
          </div>
        </div>

        {/* Métricas (Score) — pills outline */}
        {score && (
          <div className="flex flex-wrap gap-1">
            {score.score_urgencia > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-white ${getUrgenciaColor(score.score_urgencia).replace(/bg-\S+/, '')}`}>
                Urg: {score.score_urgencia}
              </span>
            )}
            {score.score_potencial_compra > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-white text-purple-700">
                Pot: {score.score_potencial_compra}
              </span>
            )}
            {score.risco_churn && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-white ${getRiscoColor(score.risco_churn).replace(/bg-\S+/, '')}`}>
                risco: {score.risco_churn}
              </span>
            )}
          </div>
        )}

        {/* Valor Recorrente */}
        {cliente.valor_recorrente_mensal > 0 && (
          <p className="text-[11px] text-slate-700">
            valor recorrente{' '}
            <span className="font-bold text-slate-900">
              R$ {cliente.valor_recorrente_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </p>
        )}

        {/* Pipeline de orçamentos: potencial aberto x perdas */}
        {(cliente.pipeline_potencial_valor > 0 || cliente.pipeline_perdido_valor > 0) && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {cliente.pipeline_potencial_valor > 0 && (
              <span className="text-blue-700 font-semibold" title="Potencial: orçamentos em aberto">
                ▲ R$ {cliente.pipeline_potencial_valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            )}
            {cliente.pipeline_perdido_valor > 0 && (
              <span className="text-red-600" title="Perdas: orçamentos rejeitados ou vencidos">
                ▼ R$ {cliente.pipeline_perdido_valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        )}

        {/* Próxima Ação (da IA) */}
        {score?.proxima_melhor_acao && (
          <div className="text-[11px] p-2 bg-slate-100 rounded-lg">
            <span className="font-bold text-slate-900">🤖 IA: </span>
            <span className="text-slate-700 leading-tight">{score.proxima_melhor_acao}</span>
          </div>
        )}

        {/* Botões de Ação — ícones circulares com rótulo */}
        <div className="flex items-start justify-between pt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(cliente); }}
            className="flex flex-col items-center gap-1 group/btn"
          >
            <span className="w-9 h-9 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-700 transition-all duration-150 group-hover/btn:bg-orange-500 group-hover/btn:text-white group-hover/btn:border-orange-500 group-hover/btn:shadow-md">
              <Edit className="w-4 h-4" />
            </span>
            <span className="text-[10px] text-slate-700">Editar</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setHistoricoOpen(true); }}
            title="Histórico interno"
            className="flex flex-col items-center gap-1 group/btn"
          >
            <span className="w-9 h-9 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-700 transition-all duration-150 group-hover/btn:bg-amber-500 group-hover/btn:text-white group-hover/btn:border-amber-500 group-hover/btn:shadow-md">
              <NotebookPen className="w-4 h-4" />
            </span>
            <span className="text-[10px] text-slate-700">Notas</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (temTelefone) setChatOpen(true); }}
            disabled={!temTelefone}
            title={temTelefone ? 'Abrir chat aqui mesmo' : 'Sem telefone cadastrado'}
            className={`flex flex-col items-center gap-1 group/btn ${!temTelefone ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            <span className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-150 ${
              temTelefone
                ? 'border-slate-300 bg-white text-slate-700 group-hover/btn:bg-green-500 group-hover/btn:text-white group-hover/btn:border-green-500 group-hover/btn:shadow-md'
                : 'border-slate-200 bg-slate-100 text-slate-400'
            }`}>
              <MessageSquare className="w-4 h-4" />
              {indicadorChat?.naoLidas > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {indicadorChat.naoLidas > 99 ? '99+' : indicadorChat.naoLidas}
                </span>
              )}
            </span>
            <span className="text-[10px] text-slate-700">Chat</span>
          </button>
        </div>
      </CardContent>

      {/* Drawer de Histórico Interno */}
      <ClienteHistoricoDrawer
        cliente={cliente}
        isOpen={historicoOpen}
        onClose={() => setHistoricoOpen(false)}
      />

      {/* Drawer flutuante de chat — mesmo comportamento dos orçamentos */}
      <ClienteChatDrawer
        cliente={cliente}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </Card>
  );
}