import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Phone,
  Mail,
  Edit,
  Eye,
  DollarSign
} from 'lucide-react';

export default function ClienteKanbanCard({ cliente, score, isDragging, onEdit, onViewDetails, statusGradient }) {
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
      className={`group hover:shadow-lg transition-all duration-300 cursor-move border-l-4 border-l-orange-500 ${
        isDragging ? 'opacity-70 rotate-2 scale-105 shadow-xl shadow-orange-300/50' : ''
      } bg-white`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header: Nome e Score */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 truncate text-sm">
              {cliente.razao_social || cliente.nome_fantasia || 'Cliente Sem Nome'}
            </h3>
            {cliente.nome_fantasia && cliente.razao_social !== cliente.nome_fantasia && (
              <p className="text-[10px] text-slate-600 truncate">{cliente.nome_fantasia}</p>
            )}
          </div>
          {score?.score_total && (
            <div className={`flex-shrink-0 ml-2 px-2 py-0.5 rounded-lg text-[10px] font-black ${getScoreColor(score.score_total)}`}>
              {score.score_total}
            </div>
          )}
        </div>

        {/* Classificação */}
        {cliente.classificacao && (
          <Badge className={`text-[10px] px-2 py-0.5 border ${getClassificacaoColor(cliente.classificacao)}`}>
            {cliente.classificacao.split(' - ')[0]}
          </Badge>
        )}

        {/* Contatos */}
        <div className="space-y-0.5 text-[10px]">
          {cliente.telefone && (
            <div className="flex items-center gap-1 text-slate-700">
              <Phone className="w-2.5 h-2.5" />
              <span className="truncate">{cliente.telefone}</span>
            </div>
          )}
          {cliente.email && (
            <div className="flex items-center gap-1 text-slate-700">
              <Mail className="w-2.5 h-2.5" />
              <span className="truncate">{cliente.email}</span>
            </div>
          )}
        </div>

        {/* Vendedor */}
        {cliente.vendedor_responsavel && (
          <div className="text-[10px] text-slate-600 truncate">
            👤 {cliente.vendedor_responsavel}
          </div>
        )}

        {/* Métricas (Score) */}
        {score && (
          <div className="flex flex-wrap gap-1">
            {score.score_urgencia > 0 && (
              <Badge className={`text-[9px] px-1 py-0 ${getUrgenciaColor(score.score_urgencia)}`}>
                Urg: {score.score_urgencia}
              </Badge>
            )}
            {score.score_potencial_compra > 0 && (
              <Badge className="text-[9px] px-1 py-0 bg-purple-100 text-purple-700">
                Pot: {score.score_potencial_compra}
              </Badge>
            )}
            {score.risco_churn && (
              <Badge className={`text-[9px] px-1 py-0 ${getRiscoColor(score.risco_churn)}`}>
                {score.risco_churn}
              </Badge>
            )}
          </div>
        )}

        {/* Valor Recorrente */}
        {cliente.valor_recorrente_mensal > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
            <DollarSign className="w-2.5 h-2.5" />
            <span className="font-bold">
              R$ {cliente.valor_recorrente_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Próxima Ação (da IA) */}
        {score?.proxima_melhor_acao && (
          <div className="text-[10px] p-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded border border-indigo-200">
            <p className="font-bold text-indigo-700 mb-0.5">🤖 IA:</p>
            <p className="text-slate-700 leading-tight">{score.proxima_melhor_acao}</p>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-1 pt-1 border-t border-slate-200">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.(cliente);
            }}
            size="sm"
            variant="ghost"
            className="flex-1 h-6 text-[10px] hover:bg-blue-500 hover:text-white px-1"
          >
            <Eye className="w-3 h-3 mr-0.5" />
            Ver
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(cliente);
            }}
            size="sm"
            variant="ghost"
            className="flex-1 h-6 text-[10px] hover:bg-orange-500 hover:text-white px-1"
          >
            <Edit className="w-3 h-3 mr-0.5" />
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}