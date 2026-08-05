import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { rotuloQuando, nivelUrgencia } from './agendaModel';
import AgendaCategoriaBadge from './AgendaCategoriaBadge';
import AgendaOrigemBadge from './AgendaOrigemBadge';

const chaveDoDia = usuarioId => `nexus:agenda-revisao:${usuarioId}:${new Date().toISOString().slice(0, 10)}`;

export function revisaoJaFeitaHoje(usuarioId) {
  if (!usuarioId) return true;
  try { return localStorage.getItem(chaveDoDia(usuarioId)) === '1'; } catch { return true; }
}

export function marcarRevisaoFeita(usuarioId) {
  try { localStorage.setItem(chaveDoDia(usuarioId), '1'); } catch { /* ignora */ }
}

/**
 * Painel obrigatório de revisão diária: lista todos os itens da agenda
 * (qualquer tipo) vencidos ou que vencem hoje e exige prorrogar ou concluir.
 */
export default function RevisaoDiariaObrigatoria({ itens, usuario, ocupadoId, onConcluir, onAdiar, onFechar }) {
  const [resolvidos, setResolvidos] = useState([]);

  const pendentes = useMemo(
    () => itens.filter(i => nivelUrgencia(i) && !resolvidos.includes(`${i.tipo}-${i.id}`)),
    [itens, resolvidos]
  );

  const resolver = (item, acao) => {
    setResolvidos(prev => [...prev, `${item.tipo}-${item.id}`]);
    acao();
  };

  const finalizar = () => {
    marcarRevisaoFeita(usuario?.id);
    onFechar();
  };

  if (pendentes.length === 0) {
    return (
      <Dialog open onOpenChange={finalizar}>
        <DialogContent className="max-w-md border-agenda-border bg-agenda-backdrop text-agenda-text">
          <DialogHeader><DialogTitle>Revisão do dia concluída</DialogTitle></DialogHeader>
          <p className="text-sm text-agenda-muted">Nenhum item vencido em aberto. Bom trabalho!</p>
          <Button className="bg-agenda-accent text-agenda-text hover:bg-agenda-accent-strong" onClick={finalizar}>Ir para a agenda</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-agenda-border bg-agenda-backdrop text-agenda-text [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="h-5 w-5" />
            Revisão obrigatória do dia ({pendentes.length})
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-agenda-muted">
          Estes itens venceram ou vencem hoje. Prorrogue ou conclua cada um para liberar a agenda.
        </p>

        <div className="space-y-3">
          {pendentes.map(item => {
            const ocupado = ocupadoId === item.id;
            return (
              <div key={`${item.tipo}-${item.id}`} className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3">
                <p className="truncate text-sm font-semibold text-agenda-text">{item.titulo}</p>
                {item.contexto && <p className="truncate text-xs text-agenda-muted">{item.contexto}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <AgendaCategoriaBadge item={item} />
                  <AgendaOrigemBadge item={item} />
                  <span className="text-[11px] font-semibold text-rose-300">{rotuloQuando(item)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {ocupado ? <Loader2 className="h-4 w-4 animate-spin text-agenda-muted" /> : <>
                    <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => resolver(item, () => onConcluir(item))}>
                      <Check className="mr-1 h-4 w-4" />Concluir
                    </Button>
                    {[[1, 'Amanhã'], [3, '3 dias'], [7, '1 semana']].map(([dias, rotulo]) => (
                      <Button key={dias} size="sm" variant="ghost" className="border border-agenda-border bg-agenda-panel/40 text-agenda-text hover:bg-agenda-panel"
                        onClick={() => resolver(item, () => onAdiar(item, dias))}>
                        {rotulo}
                      </Button>
                    ))}
                  </>}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}