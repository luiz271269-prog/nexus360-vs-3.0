import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CATEGORIAS, categoriaDoItem, etapaDoItem, etapasDaCategoria, etapasFinais, etapaInicial, ESPERA } from './agendaFluxos';
import { ordenar, rotuloQuando } from './agendaModel';
import AgendaResponsavelAvatar from './AgendaResponsavelAvatar';
import AgendaOrigemBadge from './AgendaOrigemBadge';

const BARRA = { critica: 'bg-rose-500', alta: 'bg-amber-500', media: 'bg-sky-500', baixa: 'bg-slate-300' };
const responsavelDoItem = i => i.responsavelId || i.raw?.contexto_ia?.atendente_user_id || null;

export default function AgendaFluxoKanban({ itens, onAbrir, onAtualizado, usuario }) {
  const [categoria, setCategoria] = useState('todas');
  const [movendo, setMovendo] = useState(null);
  const [usuariosMap, setUsuariosMap] = useState({});

  useEffect(() => {
    base44.functions.invoke('listarUsuariosParaAtribuicao', {})
      .then(({ data }) => {
        const lista = data?.usuarios || data || [];
        setUsuariosMap(Object.fromEntries(lista.map(u => [u.id, u])));
      })
      .catch(() => {});
  }, []);

  const podeMover = item => {
    if (!usuario) return false;
    if (usuario.role === 'admin') return true;
    return responsavelDoItem(item) === usuario.id || item.raw?.created_by_id === usuario.id;
  };
  const porTipo = categoria === 'todas';
  const colunas = porTipo ? CATEGORIAS : etapasDaCategoria(categoria);
  const finais = porTipo ? [] : etapasFinais(categoria).map(([v]) => v);
  const doFluxo = porTipo ? itens : itens.filter(i => categoriaDoItem(i) === categoria);
  const colunaDoItem = i => (porTipo ? categoriaDoItem(i) : etapaDoItem(i));

  const mover = async ({ draggableId, destination }) => {
    if (!destination) return;
    const item = doFluxo.find(i => `${i.tipo}-${i.id}` === draggableId);
    if (!item || colunaDoItem(item) === destination.droppableId) return;
    if (!podeMover(item)) { toast.error('Apenas o responsável ou um administrador pode mover este item'); return; }
    setMovendo(draggableId);
    try {
      const entidade = item.entidade === 'ScheduleEvent' ? 'ScheduleEvent' : 'ScheduleTask';
      const dados = porTipo
        ? { categoria: destination.droppableId, etapa: etapaInicial(destination.droppableId) }
        : { categoria, etapa: destination.droppableId };
      await base44.entities[entidade].update(item.id, dados);
      onAtualizado?.();
    } catch (e) { console.error('[AGENDA FLUXO]', e); toast.error('Não foi possível mover o item'); }
    finally { setMovendo(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {[['todas', 'Todas'], ...CATEGORIAS].map(([valor, rotulo]) => (
          <button key={valor} onClick={() => setCategoria(valor)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${categoria === valor ? 'border-agenda-accent bg-agenda-accent text-agenda-text' : 'border-agenda-border bg-agenda-panel/40 text-agenda-muted hover:text-agenda-text'}`}>
            {rotulo}
          </button>
        ))}
      </div>

      <DragDropContext onDragEnd={mover}>
        <div className="flex min-h-[calc(100vh-19rem)] items-stretch gap-3 overflow-x-auto pb-3">
          {colunas.map(([etapa, rotuloCol]) => {
            const lista = ordenar(doFluxo.filter(i => colunaDoItem(i) === etapa));
            return (
              <Droppable droppableId={etapa} key={etapa}>
                {(prov, snap) => (
                  <div ref={prov.innerRef} {...prov.droppableProps}
                    className={`flex min-w-[15rem] flex-1 flex-col rounded-2xl border border-agenda-border bg-agenda-panel/50 backdrop-blur-2xl ${snap.isDraggingOver ? 'ring-2 ring-agenda-accent' : ''}`}>
                    <div className="flex items-center gap-2 border-b border-agenda-border px-3 py-3">
                      <h3 className={`flex-1 truncate text-xs font-semibold ${finais.includes(etapa) ? 'text-emerald-300' : ESPERA.includes(etapa) ? 'text-amber-300' : 'text-agenda-text'}`}>{rotuloCol}</h3>
                      <span className="rounded-full border border-agenda-border px-2 py-0.5 text-[11px] font-semibold text-agenda-muted">{lista.length}</span>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto p-2">
                      {lista.map((item, index) => (
                        <Draggable draggableId={`${item.tipo}-${item.id}`} index={index} key={`${item.tipo}-${item.id}`} isDragDisabled={!podeMover(item)}>
                          {(p) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                              onClick={() => onAbrir?.(item)}
                              className={`flex cursor-pointer items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:border-violet-300 ${movendo === `${item.tipo}-${item.id}` ? 'opacity-50' : ''}`}>
                              <div className={`w-1.5 flex-shrink-0 ${BARRA[item.prioridade] || BARRA.media}`} />
                              <div className="min-w-0 flex-1 px-2.5 py-2">
                                <p className="truncate text-sm font-semibold text-slate-900">{item.titulo}</p>
                                {item.contexto && <p className="truncate text-xs text-slate-500">{item.contexto}</p>}
                                <div className="mt-1"><AgendaOrigemBadge item={item} /></div>
                                <div className="mt-0.5 flex items-center justify-between gap-2">
                                  <p className="text-[11px] text-slate-400">{rotuloQuando(item)}</p>
                                  <AgendaResponsavelAvatar usuario={usuariosMap[responsavelDoItem(item)] || (responsavelDoItem(item) === usuario?.id ? usuario : null)} />
                                </div>
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