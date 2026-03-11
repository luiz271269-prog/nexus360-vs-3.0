import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, TrendingUp } from 'lucide-react';

export default function KanbanClientesColumn({ status, items }) {
  return (
    <Card className="border-t-4 border-slate-300 flex flex-col h-[600px]">
      <CardHeader className="pb-3 bg-green-50">
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
              snapshot.isDraggingOver ? 'bg-green-50' : ''
            }`}
          >
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-slate-400 text-xs text-center p-2">
                Nenhum cliente
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
                      <h4 className="font-semibold text-slate-900 truncate">
                        {item.nome_fantasia || item.razao_social || 'Cliente'}
                      </h4>
                      
                      {item.classificacao && (
                        <Badge className="text-xs mt-1 bg-blue-100 text-blue-700 px-1.5">
                          {item.classificacao}
                        </Badge>
                      )}

                      {item.numero_maquinas && (
                        <p className="text-slate-600 text-[11px] mt-1">
                          {item.numero_maquinas} máquina(s)
                        </p>
                      )}

                      {item.telefone && (
                        <div className="flex items-center gap-1 mt-1 text-slate-600">
                          <Phone className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate text-[10px]">{item.telefone}</span>
                        </div>
                      )}

                      {item.valor_recorrente_mensal && (
                        <div className="mt-2 pt-1 border-t border-slate-200">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-green-600" />
                            <span className="text-green-600 font-bold text-[10px]">
                              R$ {item.valor_recorrente_mensal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      )}

                      {item.ultimo_contato && (
                        <div className="text-slate-500 text-[10px] mt-1">
                          Último: {new Date(item.ultimo_contato).toLocaleDateString('pt-BR')}
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