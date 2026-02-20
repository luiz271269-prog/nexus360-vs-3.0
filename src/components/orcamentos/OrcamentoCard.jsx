import React from 'react';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, DollarSign, MessageSquare, Mic, FileText, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const probabilidadeCor = {
  'Alta': 'bg-green-100 text-green-800 border-green-200',
  'Média': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Baixa': 'bg-red-100 text-red-800 border-red-200',
};

export default function OrcamentoCard({ orcamento, onEdit, onDelete, onDuplicar, onWhatsApp }) {
  const navigate = useNavigate();

  const formatCurrency = (value) => {
    if (!value && value !== 0) return 'R$ 0';
    const v = Number(value);
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)} mil`;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateString) =>
    dateString ? new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : '-';

  const temTelefone = orcamento.cliente_telefone || orcamento.cliente_celular;
  const origemChat = orcamento.origem_chat;
  const probCor = probabilidadeCor[orcamento.probabilidade] || probabilidadeCor['Média'];

  // Primeira linha de identificação do cliente
  const nomeCliente = orcamento.cliente_nome || '-';
  const primeiroNomeVendedor = (orcamento.vendedor || '').split(' ')[0] || '-';

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer overflow-hidden"
      onClick={() => navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`))}
    >
      {/* ── Mídia do chat (preview imagem/audio/doc) ── */}
      {origemChat?.media_url && origemChat.media_type === 'image' && (
        <div className="relative overflow-hidden">
          <img
            src={origemChat.media_url}
            className="w-full h-24 object-cover"
            onClick={(e) => { e.stopPropagation(); window.open(origemChat.media_url, '_blank'); }}
            onError={(e) => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}
      {origemChat?.media_type === 'audio' && (
        <div className="h-12 bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center gap-2 text-white text-xs font-medium">
          <Mic className="w-4 h-4" /> Áudio do Cliente
        </div>
      )}
      {origemChat?.media_type === 'document' && (
        <div className="h-12 bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center gap-2 text-white text-xs font-medium">
          <FileText className="w-4 h-4" /> Documento
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* Linha 1: Nome + botão opções */}
        <div className="flex items-start justify-between gap-1">
          <span className="font-bold text-slate-900 text-sm leading-tight truncate uppercase tracking-wide">
            {nomeCliente}
          </span>
          <button
            className="text-slate-400 hover:text-slate-600 flex-shrink-0 p-0.5 rounded"
            onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(orcamento); }}
            title="Opções"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Linha 2: Nº orçamento + Valor */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">{orcamento.numero_orcamento || '#---'}</span>
          <span className="font-bold text-slate-800">{formatCurrency(orcamento.valor_total)}</span>
        </div>

        {/* Linha 3: Vendedor */}
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="truncate">{primeiroNomeVendedor}</span>
        </div>

        {/* Linha 4: Data */}
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span>{formatDate(orcamento.data_orcamento)}</span>
        </div>

        {/* Linha 5: Probabilidade + badge chat */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {orcamento.probabilidade && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${probCor}`}>
              {orcamento.probabilidade}
            </span>
          )}
          {origemChat && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">
              💬 Chat
            </span>
          )}
        </div>

        {/* Botão Msg estilo barra de contatos */}
        <button
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all mt-1 ${
            temTelefone
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (temTelefone && onWhatsApp) onWhatsApp(orcamento);
          }}
          disabled={!temTelefone}
          title={temTelefone ? 'Abrir conversa WhatsApp' : 'Telefone não cadastrado'}
        >
          <MessageSquare className="w-4 h-4" />
          Msg
        </button>
      </div>
    </div>
  );
}