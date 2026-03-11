import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Building2 } from 'lucide-react';

export default function ClienteKanbanColumn({ coluna, clientes }) {
  return (
    <Card className={`${coluna.cor} border-t-4 border-slate-300 flex flex-col h-[600px]`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{coluna.label}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {clientes.length}
          </Badge>
        </div>
      </CardHeader>

      <Droppable droppableId={coluna.id}>
        {(provided, snapshot) => (
          <CardContent
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 space-y-3 overflow-y-auto scrollbar-custom pb-3 ${
              snapshot.isDraggingOver ? 'bg-opacity-50 bg-slate-300' : ''
            }`}
          >
            {clientes.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
                Nenhum cliente
              </div>
            ) : (
              clientes.map((cliente, index) => (
                <Draggable key={cliente.id} draggableId={cliente.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-move ${
                        snapshot.isDragging ? 'shadow-lg opacity-95 rotate-2' : ''
                      }`}
                    >
                      {/* Nome Cliente */}
                      <h4 className="font-semibold text-slate-900 text-sm truncate">
                        {cliente.nome_fantasia || cliente.razao_social || 'Cliente'}
                      </h4>

                      {/* Classificação */}
                      {cliente.classificacao && (
                        <Badge 
                          className="text-xs mt-1 bg-blue-100 text-blue-700"
                        >
                          {cliente.classificacao}
                        </Badge>
                      )}

                      {/* Informações de Contato */}
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {cliente.telefone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{cliente.telefone}</span>
                          </div>
                        )}
                        {cliente.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{cliente.email}</span>
                          </div>
                        )}
                        {cliente.ramo_atividade && (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate text-slate-500">{cliente.ramo_atividade}</span>
                          </div>
                        )}
                      </div>

                      {/* Score Qualificação */}
                      {cliente.score_qualificacao_lead !== undefined && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Score</span>
                            <span className="font-bold text-slate-900">
                              {Math.round(cliente.score_qualificacao_lead)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-500 to-green-500 transition-all"
                              style={{ width: `${cliente.score_qualificacao_lead}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Último Contato */}
                      {cliente.ultimo_contato && (
                        <div className="mt-2 text-xs text-slate-500">
                          <span>
                            Último: {new Date(cliente.ultimo_contato).toLocaleDateString('pt-BR')}
                          </span>
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