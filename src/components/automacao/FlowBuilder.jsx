import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  HelpCircle,
  Zap,
  GitBranch,
  Clock,
  UserCheck,
  FileText,
  Plus,
  Trash2,
  Settings,
  Play,
  Save,
  ChevronRight,
  Bot
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';

/**
 * Flow Builder - Editor Visual de Automações
 * Permite criar fluxos conversacionais complexos sem código
 */
export default function FlowBuilder({ flowData, onSave, onClose }) {
  const [flow, setFlow] = useState(flowData || {
    nome: '',
    categoria: 'vendas',
    trigger_type: 'manual',
    trigger_config: {},
    steps: [],
    ativo: false
  });

  const [selectedStep, setSelectedStep] = useState(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [showBlockPalette, setShowBlockPalette] = useState(false);

  // Tipos de blocos disponíveis
  const blockTypes = [
    {
      type: 'send_message',
      icon: MessageSquare,
      label: 'Enviar Mensagem',
      description: 'Envia uma mensagem de texto, imagem ou botões',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      type: 'ask_question',
      icon: HelpCircle,
      label: 'Fazer Pergunta',
      description: 'Coleta informação do usuário',
      color: 'from-purple-500 to-pink-500'
    },
    {
      type: 'condition',
      icon: GitBranch,
      label: 'Condição',
      description: 'Ramifica o fluxo baseado em condições',
      color: 'from-orange-500 to-red-500'
    },
    {
      type: 'delay',
      icon: Clock,
      label: 'Aguardar',
      description: 'Adiciona um atraso antes da próxima ação',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      type: 'handoff',
      icon: UserCheck,
      label: 'Transferir para Agente',
      description: 'Encaminha a conversa para um humano',
      color: 'from-green-500 to-emerald-500'
    },
    {
      type: 'crm_action',
      icon: FileText,
      label: 'Ação no CRM',
      description: 'Cria/atualiza Cliente, Orçamento, etc.',
      color: 'from-indigo-500 to-purple-500'
    },
    {
      type: 'ai_response',
      icon: Bot,
      label: 'Resposta IA',
      description: 'Usa IA para gerar resposta contextualizada',
      color: 'from-violet-500 to-purple-600'
    }
  ];

  const handleAddStep = (blockType) => {
    const newStep = {
      id: `step_${Date.now()}`,
      tipo: blockType.type,
      config: getDefaultConfig(blockType.type),
      descricao: blockType.label
    };

    setFlow({
      ...flow,
      steps: [...flow.steps, newStep]
    });
    
    setShowBlockPalette(false);
    toast.success(`Bloco "${blockType.label}" adicionado!`);
  };

  const handleEditStep = (step) => {
    setSelectedStep(step);
    setShowStepEditor(true);
  };

  const handleUpdateStep = (updatedStep) => {
    setFlow({
      ...flow,
      steps: flow.steps.map(s => s.id === updatedStep.id ? updatedStep : s)
    });
    setShowStepEditor(false);
    setSelectedStep(null);
    toast.success('Bloco atualizado!');
  };

  const handleDeleteStep = (stepId) => {
    setFlow({
      ...flow,
      steps: flow.steps.filter(s => s.id !== stepId)
    });
    toast.success('Bloco removido!');
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(flow.steps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setFlow({ ...flow, steps: items });
  };

  const handleSave = () => {
    if (!flow.nome) {
      toast.error('Por favor, dê um nome ao fluxo');
      return;
    }

    if (flow.steps.length === 0) {
      toast.error('Adicione pelo menos um bloco ao fluxo');
      return;
    }

    onSave(flow);
  };

  const getDefaultConfig = (type) => {
    switch (type) {
      case 'send_message':
        return { 
          mensagem: '', 
          tipo_midia: 'text',
          botoes: []
        };
      case 'ask_question':
        return { 
          pergunta: '', 
          salvar_em: 'variavel',
          tipo_resposta: 'text'
        };
      case 'condition':
        return { 
          campo: '', 
          operador: '==', 
          valor: '',
          acao_verdadeiro: 'continuar',
          acao_falso: 'pular'
        };
      case 'delay':
        return { 
          tempo: 60, 
          unidade: 'segundos' 
        };
      case 'handoff':
        return { 
          motivo: 'Usuario solicitou atendimento humano',
          prioridade: 'media'
        };
      case 'crm_action':
        return { 
          entidade: 'Cliente', 
          acao: 'atualizar',
          campos: {}
        };
      case 'ai_response':
        return {
          usar_contexto: true,
          temperatura: 0.7,
          instrucoes_adicionais: ''
        };
      default:
        return {};
    }
  };

  const getBlockIcon = (type) => {
    const block = blockTypes.find(b => b.type === type);
    return block ? block.icon : Zap;
  };

  const getBlockColor = (type) => {
    const block = blockTypes.find(b => b.type === type);
    return block ? block.color : 'from-gray-500 to-gray-600';
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex-1 mr-4">
            <Input
              value={flow.nome}
              onChange={(e) => setFlow({ ...flow, nome: e.target.value })}
              placeholder="Nome do Fluxo (ex: Boas-vindas WhatsApp, Follow-up Orçamento)"
              className="text-lg font-semibold"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={flow.categoria}
              onValueChange={(value) => setFlow({ ...flow, categoria: value })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vendas">Vendas</SelectItem>
                <SelectItem value="suporte">Suporte</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setFlow({ ...flow, ativo: !flow.ativo })}
              className={flow.ativo ? 'border-green-500 text-green-700' : ''}
            >
              {flow.ativo ? 'Ativo' : 'Inativo'}
            </Button>

            <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-cyan-600">
              <Save className="w-4 h-4 mr-2" />
              Salvar Fluxo
            </Button>

            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                Fechar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Canvas de Fluxo */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Trigger Config */}
            <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Zap className="w-5 h-5" />
                  Gatilho do Fluxo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={flow.trigger_type}
                  onValueChange={(value) => setFlow({ ...flow, trigger_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (iniciado por agente)</SelectItem>
                    <SelectItem value="keyword">Palavra-chave (ex: "oi", "menu")</SelectItem>
                    <SelectItem value="new_contact">Novo contato</SelectItem>
                    <SelectItem value="time">Tempo (após X horas/dias)</SelectItem>
                    <SelectItem value="event">Evento do sistema</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Steps List */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="steps">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {flow.steps.map((step, index) => {
                      const Icon = getBlockIcon(step.tipo);
                      const colorClass = getBlockColor(step.tipo);

                      return (
                        <Draggable key={step.id} draggableId={step.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <Card
                                className={`transition-all cursor-move ${
                                  snapshot.isDragging ? 'shadow-2xl scale-105' : 'hover:shadow-lg'
                                }`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-lg`}>
                                        <Icon className="w-5 h-5 text-white" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-semibold text-slate-900">
                                          {step.descricao || 'Sem descrição'}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                          {step.tipo === 'send_message' && step.config.mensagem && (
                                            <span className="line-clamp-1">{step.config.mensagem}</span>
                                          )}
                                          {step.tipo === 'ask_question' && step.config.pergunta && (
                                            <span className="line-clamp-1">{step.config.pergunta}</span>
                                          )}
                                          {step.tipo === 'delay' && (
                                            <span>Aguardar {step.config.tempo} {step.config.unidade}</span>
                                          )}
                                        </div>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        Passo {index + 1}
                                      </Badge>
                                    </div>

                                    <div className="flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleEditStep(step)}
                                        className="h-8 w-8"
                                      >
                                        <Settings className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleDeleteStep(step.id)}
                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {index < flow.steps.length - 1 && (
                                <div className="flex justify-center py-2">
                                  <ChevronRight className="w-5 h-5 text-slate-400 rotate-90" />
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {/* Add Block Button */}
            <div className="mt-6 flex justify-center">
              <Button
                onClick={() => setShowBlockPalette(true)}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5 mr-2" />
                Adicionar Bloco
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Block Palette Dialog */}
      <Dialog open={showBlockPalette} onOpenChange={setShowBlockPalette}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Escolha um Bloco</DialogTitle>
            <DialogDescription>
              Selecione o tipo de ação que deseja adicionar ao fluxo
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-4">
            {blockTypes.map((block) => {
              const Icon = block.icon;
              return (
                <Card
                  key={block.type}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-blue-400"
                  onClick={() => handleAddStep(block)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${block.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900">{block.label}</h4>
                        <p className="text-xs text-slate-600 mt-1">{block.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Step Editor Dialog */}
      {selectedStep && (
        <StepEditor
          step={selectedStep}
          onSave={handleUpdateStep}
          onClose={() => {
            setShowStepEditor(false);
            setSelectedStep(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Editor de Configuração de Bloco
 */
function StepEditor({ step, onSave, onClose }) {
  const [config, setConfig] = useState(step.config);
  const [descricao, setDescricao] = useState(step.descricao);

  const handleSave = () => {
    onSave({
      ...step,
      config,
      descricao
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Configurar Bloco: {step.descricao}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label>Descrição do Bloco</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Enviar mensagem de boas-vindas"
            />
          </div>

          {/* Configurações específicas por tipo */}
          {step.tipo === 'send_message' && (
            <>
              <div>
                <Label>Mensagem</Label>
                <Textarea
                  value={config.mensagem || ''}
                  onChange={(e) => setConfig({ ...config, mensagem: e.target.value })}
                  placeholder="Digite a mensagem..."
                  rows={4}
                />
              </div>
              <div>
                <Label>Tipo de Mídia</Label>
                <Select
                  value={config.tipo_midia}
                  onValueChange={(value) => setConfig({ ...config, tipo_midia: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Apenas Texto</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                    <SelectItem value="buttons">Texto com Botões</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step.tipo === 'ask_question' && (
            <>
              <div>
                <Label>Pergunta</Label>
                <Input
                  value={config.pergunta || ''}
                  onChange={(e) => setConfig({ ...config, pergunta: e.target.value })}
                  placeholder="Ex: Qual é o seu nome?"
                />
              </div>
              <div>
                <Label>Salvar Resposta em</Label>
                <Input
                  value={config.salvar_em || ''}
                  onChange={(e) => setConfig({ ...config, salvar_em: e.target.value })}
                  placeholder="Ex: nome_cliente"
                />
              </div>
            </>
          )}

          {step.tipo === 'delay' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tempo</Label>
                <Input
                  type="number"
                  value={config.tempo || 60}
                  onChange={(e) => setConfig({ ...config, tempo: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <Select
                  value={config.unidade}
                  onValueChange={(value) => setConfig({ ...config, unidade: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="segundos">Segundos</SelectItem>
                    <SelectItem value="minutos">Minutos</SelectItem>
                    <SelectItem value="horas">Horas</SelectItem>
                    <SelectItem value="dias">Dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step.tipo === 'handoff' && (
            <>
              <div>
                <Label>Motivo do Handoff</Label>
                <Textarea
                  value={config.motivo || ''}
                  onChange={(e) => setConfig({ ...config, motivo: e.target.value })}
                  placeholder="Ex: Cliente solicitou falar com vendedor"
                  rows={3}
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select
                  value={config.prioridade}
                  onValueChange={(value) => setConfig({ ...config, prioridade: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step.tipo === 'crm_action' && (
            <>
              <div>
                <Label>Entidade</Label>
                <Select
                  value={config.entidade}
                  onValueChange={(value) => setConfig({ ...config, entidade: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cliente">Cliente</SelectItem>
                    <SelectItem value="Contact">Contact</SelectItem>
                    <SelectItem value="Orcamento">Orçamento</SelectItem>
                    <SelectItem value="Interacao">Interação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ação</Label>
                <Select
                  value={config.acao}
                  onValueChange={(value) => setConfig({ ...config, acao: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="criar">Criar Novo</SelectItem>
                    <SelectItem value="atualizar">Atualizar Existente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step.tipo === 'ai_response' && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.usar_contexto}
                  onChange={(e) => setConfig({ ...config, usar_contexto: e.target.checked })}
                  className="rounded"
                />
                <Label>Usar contexto do cliente e histórico</Label>
              </div>
              <div>
                <Label>Instruções Adicionais para a IA</Label>
                <Textarea
                  value={config.instrucoes_adicionais || ''}
                  onChange={(e) => setConfig({ ...config, instrucoes_adicionais: e.target.value })}
                  placeholder="Ex: Seja breve e direto. Sempre mencione produtos relevantes."
                  rows={3}
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-cyan-600">
              Salvar Configurações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}