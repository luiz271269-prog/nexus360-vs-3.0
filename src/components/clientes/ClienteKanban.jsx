
import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import ClienteKanbanCard from './ClienteKanbanCard';
import {
  UserPlus,
  Phone,
  MessageSquare,
  FileText,
  CheckCircle,
  Lightbulb,
  Target,
  XCircle,
  Flame,
  Star } from
'lucide-react';

export default function ClienteKanban({
  clientes = [],
  scores = [],
  onStatusChange,
  onEdit,
  loading,
  verDetalhes,
  mode = 'leads'
}) {

  // 🔥 CORES SUAVES COM PROGRESSÃO MODERADA
  const statusConfigLeads = [
  {
    id: 'novo_lead',
    label: 'Novo Lead',
    gradient: 'from-slate-200 via-slate-100 to-slate-200',
    textColor: 'text-slate-700',
    borderGlow: 'border-slate-300',
    icon: UserPlus,
    temp: '❄️'
  },
  {
    id: 'primeiro_contato',
    label: 'Primeiro Contato',
    gradient: 'from-orange-100 via-amber-50 to-orange-100',
    textColor: 'text-orange-800',
    borderGlow: 'border-orange-200',
    icon: Phone,
    temp: '🌡️'
  },
  {
    id: 'em_conversa',
    label: 'Em Conversa',
    gradient: 'from-orange-200 via-amber-100 to-orange-200',
    textColor: 'text-orange-900',
    borderGlow: 'border-orange-300',
    icon: MessageSquare,
    temp: '🔥'
  },
  {
    id: 'levantamento_dados',
    label: 'Levantamento',
    gradient: 'from-orange-300 via-amber-200 to-orange-300',
    textColor: 'text-orange-900',
    borderGlow: 'border-orange-400',
    icon: FileText,
    temp: '🔥'
  },
  {
    id: 'pre_qualificado',
    label: 'Pré-Qualificado',
    gradient: 'from-orange-400 via-orange-300 to-amber-300',
    textColor: 'text-orange-900',
    borderGlow: 'border-orange-400',
    icon: CheckCircle,
    temp: '🔥🔥'
  },
  {
    id: 'qualificacao_tecnica',
    label: 'Qualif. Técnica',
    gradient: 'from-orange-400 via-orange-400 to-red-300',
    textColor: 'text-red-900',
    borderGlow: 'border-orange-500',
    icon: Lightbulb,
    temp: '🔥🔥'
  },
  {
    id: 'em_aquecimento',
    label: 'Aquecimento',
    gradient: 'from-orange-500 via-orange-400 to-red-400',
    textColor: 'text-white',
    borderGlow: 'border-orange-500',
    icon: Flame,
    temp: '🔥🔥🔥'
  },
  {
    id: 'lead_qualificado',
    label: 'Lead Qualificado',
    gradient: 'from-orange-500 via-orange-400 to-yellow-400',
    textColor: 'text-white',
    borderGlow: 'border-orange-400 shadow-lg shadow-orange-300/50',
    icon: Target,
    temp: '⚡💥'
  },
  {
    id: 'desqualificado',
    label: 'Desqualificado',
    gradient: 'from-gray-300 via-gray-200 to-gray-300',
    textColor: 'text-gray-700',
    borderGlow: 'border-gray-400',
    icon: XCircle,
    temp: '❌'
  }];


  // 🔥 CORES PARA KANBAN DE CLIENTES (pós-venda)
  const statusConfigClientes = [
  {
    id: 'Prospect',
    label: 'Prospect',
    gradient: 'from-yellow-300 via-amber-200 to-yellow-300',
    textColor: 'text-yellow-900',
    borderGlow: 'border-yellow-400',
    icon: UserPlus,
    temp: '🌟'
  },
  {
    id: 'Em Risco',
    label: 'Em Risco',
    gradient: 'from-red-400 via-red-300 to-orange-400',
    textColor: 'text-white',
    borderGlow: 'border-red-400',
    icon: XCircle,
    temp: '⚠️'
  },
  {
    id: 'Ativo',
    label: 'Cliente Ativo',
    gradient: 'from-green-400 via-emerald-300 to-green-400',
    textColor: 'text-white',
    borderGlow: 'border-green-500',
    icon: CheckCircle,
    temp: '✅'
  },
  {
    id: 'Promotor',
    label: 'Promotor',
    gradient: 'from-purple-400 via-purple-300 to-indigo-400',
    textColor: 'text-white',
    borderGlow: 'border-purple-500 shadow-lg shadow-purple-300/50',
    icon: Star,
    temp: '⭐'
  }];


  const statusConfig = mode === 'leads' ? statusConfigLeads : statusConfigClientes;

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const clienteId = draggableId;
    const novoStatus = destination.droppableId;

    if (onStatusChange) {
      await onStatusChange(clienteId, novoStatus);
    }
  };

  const getTotalPorEtapa = () => {
    const clientesArray = Array.isArray(clientes) ? clientes : [];
    return statusConfig.reduce((acc, status) => {
      acc[status.id] = clientesArray.filter((c) => c.status === status.id).length;
      return acc;
    }, {});
  };

  const totaisPorEtapa = getTotalPorEtapa();

  return (
    <div className="space-y-3">
      {/* 🔥 BARRA DE PROGRESSO VISUAL INDUTIVA (somente para leads) */}
      {mode === 'leads' &&
      <div className="bg-sky-800 p-4 opacity-95 rounded-2xl from-white via-orange-50/30 to-white border border-orange-200/50 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            {statusConfigLeads.slice(0, 8).map((status, index) => {
            const total = totaisPorEtapa[status.id] || 0;
            const IconComponent = status.icon;
            const isUltimaEtapa = index === 7; // lead_qualificado

            return (
              <React.Fragment key={status.id}>
                  {/* Etapa Circular */}
                  <div className="flex flex-col items-center gap-2 flex-1">
                    {/* Círculo com Gradiente */}
                    <div className={`relative group cursor-pointer transition-all duration-300 hover:scale-110`}>
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${status.gradient} border-3 ${status.borderGlow} flex flex-col items-center justify-center shadow-lg group-hover:shadow-xl`}>
                        <IconComponent className={`w-6 h-6 mb-0.5 ${status.textColor}`} />
                        <span className="text-[10px] font-black text-orange-600">{total}</span>
                      </div>
                      
                      {/* Badge de Temperatura */}
                      <div className="absolute -top-1 -right-1 text-lg">
                        {status.temp}
                      </div>
                    </div>
                    
                    {/* Label */}
                    <div className="text-center">
                      <p className="text-slate-50 text-xs font-thin text-center underline capitalize leading-tight max-w-[99px]">
                        {status.label}
                      </p>
                    </div>
                  </div>
                  
                  {/* Seta de Progressão (exceto na última etapa) */}
                  {!isUltimaEtapa &&
                <div className="flex items-center justify-center flex-shrink-0 -mx-2">
                      <div className={`text-2xl font-bold ${index >= 6 ? 'text-orange-500' : 'text-slate-400'}`}>
                        →
                      </div>
                    </div>
                }
                </React.Fragment>);

          })}
          </div>
        </div>
      }

      {/* 🔥 KANBAN BOARD */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statusConfig.map((status) => {
            const clientesArray = Array.isArray(clientes) ? clientes : [];
            const clientesDoStatus = clientesArray.filter((c) => c.status === status.id);
            const IconComponent = status.icon;

            return (
              <div
                key={status.id}
                className="flex-shrink-0 w-[240px] rounded-xl overflow-hidden shadow-lg border border-slate-200">

                {/* 🔥 HEADER DA COLUNA - GRADIENTE SUAVE */}
                <div className={`bg-gradient-to-br ${status.gradient} border-b-2 ${status.borderGlow} p-2`}>
                  <div className="px-8 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {IconComponent && <IconComponent className={`w-4 h-4 ${status.textColor}`} />}
                      <h3 className={`font-bold text-xs ${status.textColor} truncate`}>{status.label}</h3>
                      <span className="text-[10px]">{status.temp}</span>
                    </div>
                    <Badge className="bg-white/80 text-orange-600 text-[10px] h-4 px-1.5 font-bold border border-orange-300">
                      {clientesDoStatus.length}
                    </Badge>
                  </div>
                </div>

                {/* 🔥 ÁREA DE DROP - FUNDO BRANCO */}
                <Droppable droppableId={status.id}>
                  {(provided, snapshot) =>
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`bg-white p-2 space-y-2 min-h-[calc(100vh-320px)] max-h-[calc(100vh-320px)] overflow-y-auto ${
                    snapshot.isDraggingOver ? 'bg-orange-50 border-2 border-orange-300' : ''}`
                    }>

                      {clientesDoStatus.length === 0 ?
                    <div className="text-center py-12 text-slate-400 text-xs">
                          <IconComponent className="w-6 h-6 mx-auto mb-2 opacity-30" />
                          <p>Vazio</p>
                        </div> :

                    clientesDoStatus.map((cliente, index) => {
                      const scoresArray = Array.isArray(scores) ? scores : [];
                      const score = scoresArray.find((s) => s.cliente_id === cliente.id);

                      return (
                        <Draggable key={cliente.id} draggableId={cliente.id} index={index}>
                              {(provided, snapshot) =>
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}>

                                  <ClienteKanbanCard
                              cliente={cliente}
                              score={score}
                              isDragging={snapshot.isDragging}
                              onEdit={onEdit}
                              onViewDetails={verDetalhes}
                              statusGradient={status.gradient} />

                                </div>
                          }
                            </Draggable>);

                    })
                    }
                      {provided.placeholder}
                    </div>
                  }
                </Droppable>
              </div>);

          })}
        </div>
      </DragDropContext>
    </div>);

}