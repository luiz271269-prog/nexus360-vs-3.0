import React from 'react';
import { MessageSquare, Pencil, Calendar, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const probCores = {
  'Alta':  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Média': 'bg-amber-50 text-amber-700 border-amber-200',
  'Baixa': 'bg-red-50 text-red-700 border-red-200',
};

export default function OrcamentoCard({ orcamento, onEdit, onWhatsApp }) {
  const navigate = useNavigate();

  const formatCurrency = (v) => {
    const n = Number(v) || 0;
    if (n === 0) return 'R$ 0';
    if (n >= 1000) return `R$ ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `R$ ${n.toLocaleString('pt-BR')}`;
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : null;

  const temTelefone = orcamento.cliente_telefone || orcamento.cliente_celular;
  const probCor = probCores[orcamento.probabilidade] || probCores['Média'];
  // Mostrar apenas primeiro nome do vendedor
  const vendedorNome = (orcamento.vendedor || '').split(' ')[0] || null;
  const dataFormatada = formatDate(orcamento.data_orcamento);

  return (
    <div
      className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`))}
    >
      {/* Imagem do chat (se existir) */}
      {orcamento.origem_chat?.media_url && orcamento.origem_chat.media_type === 'image' && (
        <div className="h-16 overflow-hidden rounded-t-lg">
          <img
            src={orcamento.origem_chat.media_url}
            className="w-full h-full object-cover"
            onClick={(e) => { e.stopPropagation(); window.open(orcamento.origem_chat.media_url, '_blank'); }}
            onError={(e) => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}

      <div className="p-2.5 space-y-1.5">
        {/* Linha 1: Nome + menu */}
        <div className="flex items-start justify-between gap-1">
          <h4 className="font-semibold text-slate-800 text-xs leading-tight truncate flex-1 uppercase tracking-tight">
            {orcamento.cliente_nome || '—'}
          </h4>

        </div>

        {/* Linha 2: Número + Valor */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400">
            {orcamento.numero_orcamento ? `#${orcamento.numero_orcamento}` : '#—'}
          </span>
          <span className="text-[11px] font-bold text-green-600">
            {formatCurrency(orcamento.valor_total)}
          </span>
        </div>

        {/* Linha 3: Vendedor + Data */}
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          {vendedorNome && (
            <div className="flex items-center gap-0.5">
              <User className="w-2.5 h-2.5" />
              <span>{vendedorNome}</span>
            </div>
          )}
          {dataFormatada && (
            <div className="flex items-center gap-0.5 ml-auto">
              <Calendar className="w-2.5 h-2.5" />
              <span>{dataFormatada}</span>
            </div>
          )}
        </div>

        {/* Linha 4: Badge prob + botão Msg */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          {orcamento.probabilidade && (
            <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded border ${probCor}`}>
              {orcamento.probabilidade}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(orcamento); }}
              title="Editar orçamento"
            >
              <Pencil className="w-2.5 h-2.5" />
              Editar
            </button>
            <button
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                temTelefone
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (temTelefone && onWhatsApp) onWhatsApp(orcamento);
              }}
              disabled={!temTelefone}
            >
              <MessageSquare className="w-2.5 h-2.5" />
              Msg
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}