import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Calendar } from 'lucide-react';

export default function KanbanOrcamentosColumn({ status, items }) {
  return (
    <Card className="border-t-4 border-slate-300 flex flex-col h-[600px]">
      <CardHeader className="pb-3 bg-orange-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{status.label}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        </div>
      </CardHeader>

      <Droppable droppableId={status.status}>
        {(provided, snapshot) => (
          <CardContent
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 space-y-2 overflow-y-auto scrollbar-custom pb-3 transition-all ${
              snapshot.isDraggingOver ? 'bg-orange-50' : ''
            }`}
          >
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-slate-400 text-xs text-center p-2">
                Nenhum orçamento
              </div>
            ) : (
              items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`p-2 bg-white rounded border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-move text-xs ${
                        snapshot.isDragging ? 'shadow-lg opacity-90' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-semibold text-slate-900 flex-1 truncate text-[12px]">
                          Orcamento #{item.numero_orcamento || item.id.slice(-6)}
                        </h4>
                      </div>

                      <p className="text-slate-600 text-[11px] mt-1 truncate">
                        {item.cliente_nome || 'Cliente'}
                      </p>

                      {item.probabilidade && (
                        <Badge className="text-xs mt-1 bg-purple-100 text-purple-700 px-1.5">
                          {item.probabilidade}
                        </Badge>
                      )}

                      <div className="mt-2 pt-1 border-t border-slate-200 space-y-1">
                        {item.valor_total && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-green-600 flex-shrink-0" />
                            <span className="text-green-600 font-bold text-[10px]">
                              R$ {item.valor_total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        )}

                        {item.data_vencimento && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-600 flex-shrink-0" />
                            <span className="text-slate-600 text-[10px]">
                              {new Date(item.data_vencimento).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>

                      {item.produtos && item.produtos.length > 0 && (
                        <div className="text-slate-500 text-[10px] mt-1">
                          {item.produtos.length} produto{item.produtos.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}
          </CardContent>
        )}
      </Droppable>
    </Card>
  );
}