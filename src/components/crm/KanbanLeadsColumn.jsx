import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Building2 } from 'lucide-react';

export default function KanbanLeadsColumn({ status, items }) {
  return (
    <Card className="border-t-4 border-slate-300 flex flex-col h-[600px]">
      <CardHeader className="pb-3 bg-slate-50">
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
              snapshot.isDraggingOver ? 'bg-blue-50' : ''
            }`}
          >
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-slate-400 text-xs text-center p-2">
                Nenhum lead
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
                        {item.nome_fantasia || item.razao_social || 'Lead'}
                      </h4>
                      
                      {item.ramo_atividade && (
                        <p className="text-slate-600 text-[11px] mt-1 truncate">{item.ramo_atividade}</p>
                      )}

                      {item.telefone && (
                        <div className="flex items-center gap-1 mt-1 text-slate-600">
                          <Phone className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate text-[10px]">{item.telefone}</span>
                        </div>
                      )}

                      {item.score_qualificacao_lead && (
                        <div className="mt-2 pt-1 border-t border-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 text-[10px]">Score</span>
                            <span className="font-bold text-slate-900 text-[10px]">
                              {Math.round(item.score_qualificacao_lead)}%
                            </span>
                          </div>
                          <div className="w-full h-1 bg-slate-200 rounded-full mt-0.5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-500 to-green-500"
                              style={{ width: `${item.score_qualificacao_lead}%` }}
                            />
                          </div>
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