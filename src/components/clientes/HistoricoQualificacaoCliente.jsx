import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_ICON = {
  novo_lead: '🆕', primeiro_contato: '📞', em_conversa: '💬',
  levantamento_dados: '📋', pre_qualificado: '✅', qualificacao_tecnica: '🔍',
  em_aquecimento: '🔥', lead_qualificado: '🎯', desqualificado: '❌',
  Prospect: '🤝', Ativo: '✅', 'Em Risco': '⚠️', Promotor: '⭐'
};

const STATUS_COLOR = {
  novo_lead: 'text-slate-300 border-slate-500',
  primeiro_contato: 'text-blue-300 border-blue-500',
  em_conversa: 'text-cyan-300 border-cyan-500',
  levantamento_dados: 'text-indigo-300 border-indigo-500',
  pre_qualificado: 'text-purple-300 border-purple-500',
  qualificacao_tecnica: 'text-violet-300 border-violet-500',
  em_aquecimento: 'text-amber-300 border-amber-500',
  lead_qualificado: 'text-green-300 border-green-500',
  desqualificado: 'text-red-300 border-red-500',
};

const CAMPO_NOME = {
  razao_social: 'Razão Social', nome_fantasia: 'Nome Fantasia', telefone: 'Telefone',
  email: 'E-mail', contato_principal_nome: 'Contato', contato_principal_cargo: 'Cargo',
  numero_maquinas: 'Máquinas', numero_funcionarios: 'Funcionários',
  valor_recorrente_mensal: 'Valor Mensal', interesses_produtos: 'Produtos',
  classificacao: 'Classificação', segmento: 'Segmento',
  vendedor_responsavel: 'Vendedor', necessidade_verificada: 'Necessidade',
  capacidade_compra_verificada: 'Capacidade', motivo_desqualificacao: 'Motivo Desqualif.',
  observacoes: 'Observações', status: 'Status'
};

const CAMPOS_IGNORAR = ['id', 'created_date', 'updated_date', 'created_by', 'status'];

const formatarValor = (campo, valor) => {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (campo === 'valor_recorrente_mensal') return `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (campo === 'interesses_produtos' && Array.isArray(valor)) return valor.join(', ') || '—';
  if (typeof valor === 'boolean') return valor ? '✅ Sim' : '❌ Não';
  return String(valor);
};

const EventoTimeline = ({ evento, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const { dados_evento, timestamp, created_date } = evento;
  const { status_anterior, status_novo, dados_atualizados } = dados_evento || {};

  const dataFormatada = (timestamp || created_date)
    ? format(new Date(timestamp || created_date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
    : '—';

  const camposAlterados = dados_atualizados
    ? Object.keys(dados_atualizados).filter(c => !CAMPOS_IGNORAR.includes(c) && dados_atualizados[c] !== null && dados_atualizados[c] !== '')
    : [];

  const colorClass = STATUS_COLOR[status_novo] || 'text-gray-300 border-gray-500';

  return (
    <div className="relative flex gap-2 pb-4">
      {/* linha vertical */}
      {!isLast && <div className="absolute left-3.5 top-8 bottom-0 w-px bg-white/10" />}

      {/* bolinha */}
      <div className={`relative z-10 flex-shrink-0 w-7 h-7 rounded-full border-2 ${colorClass} bg-black/40 flex items-center justify-center text-sm`}>
        {STATUS_ICON[status_novo] || '📌'}
      </div>

      {/* card compacto */}
      <div className="flex-1 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wide ${colorClass.split(' ')[0]}`}>
              {status_novo?.replace(/_/g, ' ')}
            </span>
            {status_anterior && (
              <span className="text-[9px] text-white/30 truncate">← {status_anterior?.replace(/_/g, ' ')}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[9px] text-white/40">{dataFormatada}</span>
            {camposAlterados.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[9px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {camposAlterados.length}
              </button>
            )}
          </div>
        </div>

        {expanded && camposAlterados.length > 0 && (
          <div className="border-t border-white/10 px-2.5 py-1.5 grid grid-cols-2 gap-1">
            {camposAlterados.map((campo) => (
              <div key={campo} className="text-[9px]">
                <span className="text-white/40">{CAMPO_NOME[campo] || campo}: </span>
                <span className="text-white/80 font-medium">{formatarValor(campo, dados_atualizados[campo])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function HistoricoQualificacaoCliente({ clienteId }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clienteId) return;
    setLoading(true);
    base44.entities.EventoSistema.filter({
      tipo_evento: 'cliente_atualizado',
      entidade_id: clienteId
    }).then((data) => {
      const ordenados = (data || []).sort((a, b) =>
        new Date(b.timestamp || b.created_date) - new Date(a.timestamp || a.created_date)
      );
      setEventos(ordenados);
    }).catch(console.error).finally(() => setLoading(false));
  }, [clienteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Clock className="w-5 h-5 text-orange-400 animate-spin mr-2" />
        <span className="text-white/50 text-xs">Carregando...</span>
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <AlertCircle className="w-8 h-8 text-white/20 mb-3" />
        <p className="text-white/50 text-xs font-semibold mb-1">Nenhum histórico registrado</p>
        <p className="text-white/30 text-[10px]">
          O histórico será criado automaticamente quando o lead for movido entre as etapas do funil.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-white/40 uppercase tracking-wide">Timeline de movimentações</span>
        <span className="text-[10px] text-orange-400 font-semibold">{eventos.length} evento{eventos.length > 1 ? 's' : ''}</span>
      </div>
      {eventos.map((evento, index) => (
        <EventoTimeline
          key={evento.id || index}
          evento={evento}
          isLast={index === eventos.length - 1}
        />
      ))}
    </div>
  );
}