import React from 'react';
import { User, Calendar, DollarSign, MessageSquare, Mic, FileText, MoreHorizontal, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const probabilidadeCor = {
  'Alta':  'bg-green-100 text-green-800 border border-green-200',
  'Média': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  'Baixa': 'bg-red-100 text-red-800 border border-red-200',
};

// Cores para avatar baseado na inicial
const getAvatarColor = (initial) => {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-orange-500', 'bg-cyan-500', 'bg-indigo-500'];
  const charCode = initial?.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
};

export default function OrcamentoCard({ orcamento, onEdit, onWhatsApp }) {
  const navigate = useNavigate();

  const formatCurrency = (value) => {
    const v = Number(value) || 0;
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)} mil`;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : '-';

  const formatTime = (d) =>
    d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '';

  const temTelefone = orcamento.cliente_telefone || orcamento.cliente_celular;
  const origemChat  = orcamento.origem_chat;
  const probCor     = probabilidadeCor[orcamento.probabilidade] || probabilidadeCor['Média'];
  const inicial = orcamento.cliente_nome?.[0]?.toUpperCase() || 'O';
  const avatarColor = getAvatarColor(inicial);

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer overflow-hidden"
      onClick={() => navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`))}
    >
      {/* Mídia do chat */}
      {origemChat?.media_url && origemChat.media_type === 'image' && (
        <div className="overflow-hidden h-20">
          <img
            src={origemChat.media_url}
            className="w-full h-full object-cover"
            onClick={(e) => { e.stopPropagation(); window.open(origemChat.media_url, '_blank'); }}
            onError={(e) => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}

      <div className="px-3 py-2 space-y-1">
        {/* Linha 1: Avatar + Nome + Data/Hora + Menu */}
        <div className="flex items-start gap-2">
          <div className={`${avatarColor} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm`}>
            {inicial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-1">
              <h4 className="font-bold text-slate-900 text-xs leading-tight truncate flex-1 uppercase">
                {orcamento.cliente_nome || '-'}
              </h4>
              <span className="text-[10px] text-slate-400 flex-shrink-0">{formatTime(orcamento.data_orcamento)}</span>
            </div>
            <div className="text-[10px] text-slate-500">{formatDate(orcamento.data_orcamento)}</div>
          </div>
          <button
            className="text-slate-400 hover:text-slate-600 flex-shrink-0 p-0.5 rounded"
            onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(orcamento); }}
            title="Opções"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Linha 2: Número + Valor */}
        <div className="flex items-center justify-between text-xs px-10">
          <span className="text-slate-500 font-mono">{orcamento.numero_orcamento || '#---'}</span>
          <span className="font-bold text-green-600">{formatCurrency(orcamento.valor_total)}</span>
        </div>

        {/* Linha 3: Badges */}
        <div className="flex items-center gap-1 flex-wrap pt-0.5 px-10">
          {orcamento.probabilidade && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${probCor}`}>
              {orcamento.probabilidade}
            </span>
          )}
          {orcamento.vendedor && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white bg-indigo-500 shadow-sm">
              {(orcamento.vendedor || '').split(' ')[0]}
            </span>
          )}
          {origemChat && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-green-100 text-green-700 border border-green-200">
              💬
            </span>
          )}
        </div>

        {/* Botão Msg */}
        <button
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition-all mt-0.5 ${
            temTelefone
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (temTelefone && onWhatsApp) onWhatsApp(orcamento);
          }}
          disabled={!temTelefone}
          title={temTelefone ? 'Abrir conversa' : 'Telefone não cadastrado'}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Msg
        </button>
      </div>
    </div>
  );
}