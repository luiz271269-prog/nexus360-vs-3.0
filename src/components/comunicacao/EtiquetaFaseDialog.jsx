import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KanbanSquare, Tag } from "lucide-react";

export const FASES_KANBAN = [
  { value: 'rascunho',          label: 'Rascunho',         etapa: 'interna',    color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { value: 'aguardando_cotacao',label: 'Aguard. Cotação',  etapa: 'interna',    color: 'bg-sky-100 text-sky-800 border-sky-300' },
  { value: 'analisando',        label: 'Analisando',       etapa: 'interna',    color: 'bg-violet-100 text-violet-800 border-violet-300' },
  { value: 'liberado',          label: 'Liberado',         etapa: 'interna',    color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'enviado',           label: 'Enviado',          etapa: 'negociacao', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'negociando',        label: 'Negociando',       etapa: 'negociacao', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'aprovado',          label: 'Aprovado',         etapa: 'negociacao', color: 'bg-green-100 text-green-800 border-green-300' },
];

/**
 * Dialog que aparece ao etiquetar uma mensagem.
 * Permite escolher a fase do Kanban onde a oportunidade será criada.
 *
 * @param {boolean} aberto
 * @param {function} onFechar
 * @param {object}  etiqueta  - { nome, label, emoji, kanban_fase_padrao }
 * @param {function} onConfirmar - (fase: string|null, criarOportunidade: boolean) => void
 */
export default function EtiquetaFaseDialog({ aberto, onFechar, etiqueta, onConfirmar }) {
  const [faseSelecionada, setFaseSelecionada] = React.useState(null);
  const [criarOportunidade, setCriarOportunidade] = React.useState(false);

  React.useEffect(() => {
    if (aberto && etiqueta) {
      const fasePadrao = etiqueta.kanban_fase_padrao || null;
      setFaseSelecionada(fasePadrao);
      setCriarOportunidade(!!fasePadrao);
    }
  }, [aberto, etiqueta]);

  const toggleFase = (valor) => {
    if (faseSelecionada === valor && criarOportunidade) {
      // Desselecionar → sem oportunidade
      setFaseSelecionada(null);
      setCriarOportunidade(false);
    } else {
      setFaseSelecionada(valor);
      setCriarOportunidade(true);
    }
  };

  const fasesInternas   = FASES_KANBAN.filter(f => f.etapa === 'interna');
  const fasesNegociacao = FASES_KANBAN.filter(f => f.etapa === 'negociacao');

  const faseAtiva = FASES_KANBAN.find(f => f.value === faseSelecionada);

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Tag className="w-4 h-4 text-purple-600" />
            {etiqueta?.emoji} {etiqueta?.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <KanbanSquare className="w-3 h-3" />
              Criar no Kanban em qual fase?
            </p>

            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">Etapa Interna</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
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

            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">Negociação</p>
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
          </div>

          {criarOportunidade && faseAtiva && (
            <div className={`${faseAtiva.color} border rounded-lg px-3 py-2 text-xs flex items-center gap-2`}>
              <span>✅</span>
              <span>Criará oportunidade em <strong>{faseAtiva.label}</strong></span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" size="sm" onClick={() => onConfirmar(null, false)}>
            Só etiquetar
          </Button>
          <Button
            size="sm"
            disabled={!criarOportunidade || !faseSelecionada}
            className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-40"
            onClick={() => onConfirmar(faseSelecionada, true)}
          >
            + Kanban
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}