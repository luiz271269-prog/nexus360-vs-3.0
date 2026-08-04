import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CATEGORIAS, categoriaDoItem, etapaDoItem, etapasDaCategoria, etapasFinais, ESPERA } from './agendaFluxos';
import { ordenar, rotuloQuando } from './agendaModel';

const BARRA = { critica: 'bg-rose-500', alta: 'bg-amber-500', media: 'bg-sky-500', baixa: 'bg-slate-300' };

export default function AgendaFluxoKanban({ itens, onAbrir, onAtualizado }) {
  const [categoria, setCategoria] = useState('tarefa');
  const [movendo, setMovendo] = useState(null);
  const colunas = etapasDaCategoria(categoria);
  const finais = etapasFinais(categoria).map(([v]) => v);
  const doFluxo = itens.filter(i => categoriaDoItem(i) === categoria);

  const mover = async ({ draggableId, destination }) => {
    if (!destination) return;
    const item = doFluxo.find(i => `${i.tipo}-${i.id}` === draggableId);
    if (!item || etapaDoItem(item) === destination.droppableId) return;
    setMovendo(draggableId);
    try {
      const entidade = item.entidade === 'ScheduleEvent' ? 'ScheduleEvent' : 'ScheduleTask';
      await base44.entities[entidade].update(item.id, { categoria, etapa: destination.droppableId });
      onAtualizado?.();
    } catch (e) { console.error('[AGENDA FLUXO]', e); toast.error('Não foi possível mover o item'); }
    finally { setMovendo(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIAS.map(([valor, rotulo]) => (
          <button key={valor} onClick={() => setCategoria(valor)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${categoria === valor ? 'border-agenda-accent bg-agenda-accent text-agenda-text' : 'border-agenda-border bg-agenda-panel/40 text-agenda-muted hover:text-agenda-text'}`}>
            {rotulo}
          </button>
        ))}
      </div>

      <DragDropContext onDragEnd={mover}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {colunas.map(([etapa, rotuloCol]) => {
            const lista = ordenar(doFluxo.filter(i => etapaDoItem(i) === etapa));
            return (
              <Droppable droppableId={etapa} key={etapa}>
                {(prov, snap) => (
                  <div ref={prov.innerRef} {...prov.droppableProps}
                    className={`flex w-64 flex-shrink-0 flex-col rounded-2xl border border-agenda-border bg-agenda-panel/50 backdrop-blur-2xl ${snap.isDraggingOver ? 'ring-2 ring-agenda-accent' : ''}`}>
                    <div className="flex items-center gap-2 border-b border-agenda-border px-3 py-3">
                      <h3 className={`flex-1 truncate text-xs font-semibold ${finais.includes(etapa) ? 'text-emerald-300' : ESPERA.includes(etapa) ? 'text-amber-300' : 'text-agenda-text'}`}>{rotuloCol}</h3>
                      <span className="rounded-full border border-agenda-border px-2 py-0.5 text-[11px] font-semibold text-agenda-muted">{lista.length}</span>
                    </div>
                    <div className="min-h-[80px] space-y-2 p-2">
                      {lista.map((item, index) => (
                        <Draggable draggableId={`${item.tipo}-${item.id}`} index={index} key={`${item.tipo}-${item.id}`}>
                          {(p) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                              onClick={() => onAbrir?.(item)}
                              className={`flex cursor-pointer items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:border-violet-300 ${movendo === `${item.tipo}-${item.id}` ? 'opacity-50' : ''}`}>
                              <div className={`w-1.5 flex-shrink-0 ${BARRA[item.prioridade] || BARRA.media}`} />
                              <div className="min-w-0 px-2.5 py-2">
                                <p className="truncate text-sm font-semibold text-slate-900">{item.titulo}</p>
                                {item.contexto && <p className="truncate text-xs text-slate-500">{item.contexto}</p>}
                                <p className="mt-0.5 text-[11px] text-slate-400">{rotuloQuando(item)}</p>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}