import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, User, DollarSign, Calendar } from 'lucide-react';

export default function LeadsQualificados() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colunas, setColunas] = useState({
    leads: { title: 'Leads', items: [] },
    qualificados: { title: 'Qualificados', items: [] },
    negociacao: { title: 'Em Negociação', items: [] },
    fechados: { title: 'Fechados', items: [] }
  });

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    try {
      setLoading(true);
      const clientesList = await base44.entities.Cliente.list();
      setClientes(clientesList);
      organizarPorStatus(clientesList);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const organizarPorStatus = (clientes) => {
    const novasColunas = {
      leads: { title: 'Leads', items: [] },
      qualificados: { title: 'Qualificados', items: [] },
      negociacao: { title: 'Em Negociação', items: [] },
      fechados: { title: 'Fechados', items: [] }
    };

    clientes.forEach(cliente => {
      let coluna = 'leads';
      if (cliente.status === 'lead_qualificado') coluna = 'qualificados';
      if (cliente.status === 'em_aquecimento' || cliente.status === 'em_conversa') coluna = 'negociacao';
      if (cliente.status === 'Ativo') coluna = 'fechados';

      novasColunas[coluna].items.push(cliente);
    });

    setColunas(novasColunas);
  };

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Copiar colunas
    const novasColunas = { ...colunas };
    const item = novasColunas[source.droppableId].items[source.index];
    
    // Remover de origem
    novasColunas[source.droppableId].items.splice(source.index, 1);
    
    // Adicionar em destino
    novasColunas[destination.droppableId].items.splice(destination.index, 0, item);
    
    setColunas(novasColunas);
  };

  const getStatusColor = (status) => {
    const colors = {
      'novo_lead': 'bg-blue-100 text-blue-800',
      'lead_qualificado': 'bg-green-100 text-green-800',
      'em_negociacao': 'bg-yellow-100 text-yellow-800',
      'Ativo': 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">CRM Kanban</h1>
        <p className="text-gray-600">Gerencie seus leads e clientes com arrastar e soltar</p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-180px)]">
          {Object.entries(colunas).map(([key, coluna]) => (
            <Droppable key={key} droppableId={key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`bg-gray-50 rounded-lg p-4 flex flex-col ${
                    snapshot.isDraggingOver ? 'bg-blue-50' : ''
                  }`}
                >
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    {coluna.title} ({coluna.items.length})
                  </h2>
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {coluna.items.map((cliente, index) => (
                      <Draggable key={cliente.id} draggableId={cliente.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white rounded-lg p-4 shadow-sm border-l-4 border-orange-500 cursor-move ${
                              snapshot.isDragging ? 'shadow-lg bg-blue-50' : ''
                            }`}
                          >
                            <h3 className="font-semibold text-gray-900 truncate">
                              {cliente.nome_fantasia || cliente.razao_social}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">{cliente.ramo_atividade}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={getStatusColor(cliente.status)}>
                                {cliente.status}
                              </Badge>
                            </div>
                            {cliente.valor_recorrente_mensal && (
                              <div className="flex items-center gap-1 mt-2 text-sm text-gray-700">
                                <DollarSign className="w-4 h-4" />
                                R$ {cliente.valor_recorrente_mensal.toLocaleString('pt-BR')}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}