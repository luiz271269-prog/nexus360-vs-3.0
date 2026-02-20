import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KanbanSquare, Tag, Target, Users, FileText, User, Calendar, Clock, MessageSquare } from "lucide-react";

export const FASES_KANBAN = [
  { value: 'rascunho',          label: 'Rascunho',         etapa: 'interna',    color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { value: 'aguardando_cotacao',label: 'Aguard. Cotação',  etapa: 'interna',    color: 'bg-sky-100 text-sky-800 border-sky-300' },
  { value: 'analisando',        label: 'Analisando',       etapa: 'interna',    color: 'bg-violet-100 text-violet-800 border-violet-300' },
  { value: 'liberado',          label: 'Liberado',         etapa: 'interna',    color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'enviado',           label: 'Enviado',          etapa: 'negociacao', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'negociando',        label: 'Negociando',       etapa: 'negociacao', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'aprovado',          label: 'Aprovado',         etapa: 'negociacao', color: 'bg-green-100 text-green-800 border-green-300' },
];

export const DESTINOS_KANBAN = [
  {
    value: 'orcamentos',
    label: 'Pipeline de Orçamentos',
    descricao: 'Cria um orçamento no pipeline de vendas',
    icon: FileText,
    color: 'bg-blue-600',
    bgSel: 'bg-blue-50 border-blue-500 text-blue-800',
    bgNormal: 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/50',
    mostrarFase: true,
  },
  {
    value: 'leads',
    label: 'Funil de Leads',
    descricao: 'Registra como novo lead no funil',
    icon: Target,
    color: 'bg-orange-500',
    bgSel: 'bg-orange-50 border-orange-500 text-orange-800',
    bgNormal: 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:bg-orange-50/50',
    mostrarFase: false,
  },
  {
    value: 'clientes',
    label: 'Gestão de Clientes',
    descricao: 'Adiciona à base de clientes',
    icon: Users,
    color: 'bg-purple-600',
    bgSel: 'bg-purple-50 border-purple-500 text-purple-800',
    bgNormal: 'bg-white border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-purple-50/50',
    mostrarFase: false,
  },
];

/**
 * Dialog que aparece ao etiquetar uma mensagem.
 * Permite escolher QUAL Kanban e a fase (se orçamento).
 *
 * onConfirmar(fase, criarOportunidade, destino) => void
 */
export default function EtiquetaFaseDialog({ aberto, onFechar, etiqueta, onConfirmar, mensagem, contato }) {
  const [destino, setDestino] = React.useState('orcamentos');
  const [faseSelecionada, setFaseSelecionada] = React.useState(null);
  const [criarOportunidade, setCriarOportunidade] = React.useState(false);

  React.useEffect(() => {
    if (aberto && etiqueta) {
      setDestino('orcamentos');
      const fasePadrao = etiqueta.kanban_fase_padrao || null;
      setFaseSelecionada(fasePadrao);
      setCriarOportunidade(!!fasePadrao);
    }
  }, [aberto, etiqueta]);

  const toggleFase = (valor) => {
    if (faseSelecionada === valor && criarOportunidade) {
      setFaseSelecionada(null);
      setCriarOportunidade(false);
    } else {
      setFaseSelecionada(valor);
      setCriarOportunidade(true);
    }
  };

  const destinoAtual = DESTINOS_KANBAN.find(d => d.value === destino);
  const fasesInternas   = FASES_KANBAN.filter(f => f.etapa === 'interna');
  const fasesNegociacao = FASES_KANBAN.filter(f => f.etapa === 'negociacao');
  const faseAtiva = FASES_KANBAN.find(f => f.value === faseSelecionada);

  const podeConfirmar = destino === 'orcamentos'
    ? criarOportunidade && !!faseSelecionada
    : !!destino;

  const handleConfirmar = () => {
    onConfirmar(
      destino === 'orcamentos' ? faseSelecionada : null,
      true,
      destino
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Tag className="w-4 h-4 text-purple-600" />
            {etiqueta?.emoji} {etiqueta?.label}
          </DialogTitle>
        </DialogHeader>

        {/* ── CARD DE PRÉVIA DA MENSAGEM ── */}
        {(contato || mensagem) && (
          <div className="border-2 border-amber-200 bg-amber-50 rounded-xl p-3 shadow-sm">
            {/* Cabeçalho: nome */}
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-800 text-sm uppercase tracking-wide truncate">
                {contato?.nome || contato?.empresa || mensagem?.sender_id?.slice(0,8) || 'Contato'}
              </span>
              <span className="text-[10px] text-slate-400">···</span>
            </div>
            {/* Empresa / cargo se houver */}
            {contato?.empresa && contato?.nome && contato.empresa !== contato.nome && (
              <p className="text-[11px] text-slate-500 truncate mb-1">{contato.empresa}</p>
            )}
            {/* Linha 2: vendedor */}
            {contato?.vendedor_responsavel && (
              <div className="flex items-center gap-1 text-[11px] text-slate-600 mb-1">
                <User className="w-3 h-3 text-slate-400" />
                <span className="truncate">{contato.vendedor_responsavel.split(' ')[0]}</span>
              </div>
            )}
            {/* Linha 3: data e hora */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1 text-[11px] text-slate-600">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{mensagem?.sent_at || mensagem?.created_date
                  ? new Date(mensagem.sent_at || mensagem.created_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                }</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-600">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{mensagem?.sent_at || mensagem?.created_date
                  ? new Date(mensagem.sent_at || mensagem.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                }</span>
              </div>
            </div>
            {/* Etiqueta */}
            {etiqueta && (
              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${etiqueta.cor || 'bg-yellow-100 text-yellow-800 border-yellow-300'}`}>
                {etiqueta.emoji} {etiqueta.label}
              </span>
            )}
            {/* Prévia do conteúdo */}
            {mensagem?.content && (
              <div className="mt-2 pt-2 border-t border-amber-200">
                <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                  "{mensagem.content.substring(0, 80)}{mensagem.content.length > 80 ? '…' : ''}"
                </p>
              </div>
            )}
            {/* Botão Msg estilo card */}
            <div className="mt-2">
              <div className="flex items-center justify-center gap-1.5 bg-green-500 text-white text-[11px] font-semibold rounded-lg py-1.5 opacity-60 cursor-default">
                <MessageSquare className="w-3 h-3" />
                Msg
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* PASSO 1: Destino */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <KanbanSquare className="w-3 h-3" />
              Qual Kanban?
            </p>
            <div className="flex flex-col gap-2">
              {DESTINOS_KANBAN.map(d => {
                const Icon = d.icon;
                const sel = destino === d.value;
                return (
                  <button
                    key={d.value}
                    onClick={() => {
                      setDestino(d.value);
                      if (d.value !== 'orcamentos') {
                        setFaseSelecionada(null);
                        setCriarOportunidade(true);
                      }
                    }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all text-left ${
                      sel ? d.bgSel + ' ring-1 ring-offset-1' : d.bgNormal
                    }`}
                  >
                    <div className={`w-7 h-7 ${d.color} rounded-md flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{d.label}</p>
                      <p className="text-[10px] text-slate-400 leading-tight">{d.descricao}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PASSO 2: Fase (só para Orçamentos) */}
          {destinoAtual?.mostrarFase && (
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-2">Em qual fase do pipeline?</p>

              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Etapa Interna</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {fasesInternas.map(fase => (
                  <button
                    key={fase.value}
                    onClick={() => toggleFase(fase.value)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                      faseSelecionada === fase.value && criarOportunidade
                        ? fase.color + ' ring-2 ring-offset-1 ring-slate-400 shadow-sm scale-105'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {fase.label}
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Negociação</p>
              <div className="flex flex-wrap gap-1.5">
                {fasesNegociacao.map(fase => (
                  <button
                    key={fase.value}
                    onClick={() => toggleFase(fase.value)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                      faseSelecionada === fase.value && criarOportunidade
                        ? fase.color + ' ring-2 ring-offset-1 ring-slate-400 shadow-sm scale-105'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {fase.label}
                  </button>
                ))}
              </div>

              {criarOportunidade && faseAtiva && (
                <div className={`${faseAtiva.color} border rounded-lg px-3 py-2 text-xs flex items-center gap-2 mt-2`}>
                  <span>✅</span>
                  <span>Criará orçamento em <strong>{faseAtiva.label}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Preview destino não-orçamento */}
          {!destinoAtual?.mostrarFase && destino && (
            <div className={`${destinoAtual?.bgSel} border rounded-lg px-3 py-2 text-xs flex items-center gap-2`}>
              <span>✅</span>
              <span>Criará registro em <strong>{destinoAtual?.label}</strong></span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" size="sm" onClick={() => onConfirmar(null, false, null)}>
            Só etiquetar
          </Button>
          <Button
            size="sm"
            disabled={!podeConfirmar}
            className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-40"
            onClick={handleConfirmar}
          >
            + Kanban
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}