import { useState, useEffect } from "react";
import { FlowTemplate } from "@/entities/FlowTemplate";
import { FlowTemplateVersion } from "@/entities/FlowTemplateVersion";
import { SubFlowTemplate } from "@/entities/SubFlowTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Plus, 
  Trash2, 
  Save, 
  Settings,
  MessageSquare,
  Clock,
  GitBranch,
  Package,
  Zap,
  X
} from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function FlowBuilderV2({ flowId, onSave, onCancel }) {
  const [flow, setFlow] = useState({
    nome: '',
    categoria: 'vendas',
    trigger_type: 'manual',
    trigger_config: {},
    steps: [],
    ativo: false
  });
  
  const [subFlows, setSubFlows] = useState([]);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [showStepEditor, setShowStepEditor] = useState(false);

  useEffect(() => {
    carregarDados();
  }, [flowId]);

  const carregarDados = async () => {
    try {
      if (flowId) {
        const flowData = await FlowTemplate.get(flowId);
        setFlow(flowData);
      }
      
      const subFlowsData = await SubFlowTemplate.filter({ ativo: true });
      setSubFlows(subFlowsData);
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar fluxo");
    }
  };

  const BLOCOS = [
    {
      tipo: 'send_message',
      nome: 'Enviar Mensagem',
      icone: MessageSquare,
      cor: 'from-blue-500 to-cyan-500',
      configPadrao: { mensagem: '', tipo_midia: 'text' }
    },
    {
      tipo: 'delay',
      nome: 'Aguardar',
      icone: Clock,
      cor: 'from-yellow-500 to-orange-500',
      configPadrao: { tempo: 60, unidade: 'segundos' }
    },
    {
      tipo: 'condition',
      nome: 'Condição',
      icone: GitBranch,
      cor: 'from-orange-500 to-red-500',
      configPadrao: { campo: '', operador: '==', valor: '' }
    },
    {
      tipo: 'chamar_subfluxo',
      nome: 'Chamar Sub-Fluxo',
      icone: Package,
      cor: 'from-teal-500 to-cyan-500',
      configPadrao: { subfluxo_id: '', parametros: {} }
    },
    {
      tipo: 'ai_response',
      nome: 'Resposta IA',
      icone: Zap,
      cor: 'from-violet-500 to-purple-600',
      configPadrao: { usar_contexto: true, temperatura: 0.7 }
    }
  ];

  const adicionarBloco = (bloco) => {
    const novoStep = {
      id: `step_${Date.now()}`,
      tipo: bloco.tipo,
      config: JSON.parse(JSON.stringify(bloco.configPadrao)),
      descricao: bloco.nome
    };
    
    setFlow({
      ...flow,
      steps: [...flow.steps, novoStep]
    });
    
    setShowBlockPicker(false);
    toast.success(`Bloco "${bloco.nome}" adicionado`);
  };

  const removerBloco = (stepId) => {
    setFlow({
      ...flow,
      steps: flow.steps.filter(s => s.id !== stepId)
    });
    toast.info("Bloco removido");
  };

  const editarBloco = (step) => {
    setEditingStep(step);
    setShowStepEditor(true);
  };

  const salvarEdicaoBloco = (stepAtualizado) => {
    setFlow({
      ...flow,
      steps: flow.steps.map(s => s.id === stepAtualizado.id ? stepAtualizado : s)
    });
    setShowStepEditor(false);
    setEditingStep(null);
    toast.success("Bloco atualizado");
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(flow.steps);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    
    setFlow({ ...flow, steps: items });
  };

  const salvarFlow = async () => {
    try {
      if (!flow.nome) {
        toast.error("Por favor, dê um nome ao fluxo");
        return;
      }
      
      if (flow.steps.length === 0) {
        toast.error("Adicione pelo menos um bloco ao fluxo");
        return;
      }
      
      if (flowId) {
        await FlowTemplate.update(flowId, flow);
        
        // Criar nova versão
        const versoes = await FlowTemplateVersion.filter({ flow_template_id: flowId }, '-versao');
        const ultimaVersao = versoes[0]?.versao || '1.0';
        const [major, minor] = ultimaVersao.split('.').map(Number);
        const novaVersao = `${major}.${minor + 1}`;
        
        await FlowTemplateVersion.create({
          flow_template_id: flowId,
          versao: novaVersao,
          nome: flow.nome,
          descricao_mudancas: 'Edição via Flow Builder',
          steps: flow.steps,
          trigger_config: flow.trigger_config,
          status: 'rascunho'
        });
        
        toast.success(`Fluxo atualizado - Versão ${novaVersao} criada`);
      } else {
        const novoFlow = await FlowTemplate.create(flow);
        
        // Criar versão inicial
        await FlowTemplateVersion.create({
          flow_template_id: novoFlow.id,
          versao: '1.0',
          nome: flow.nome,
          descricao_mudancas: 'Versão inicial',
          steps: flow.steps,
          trigger_config: flow.trigger_config,
          status: 'rascunho'
        });
        
        toast.success("Fluxo criado com sucesso!");
      }
      
      if (onSave) onSave(flow);
      
    } catch (error) {
      console.error("Erro ao salvar flow:", error);
      toast.error("Erro ao salvar fluxo");
    }
  };

  const getIconeBloco = (tipo) => {
    const bloco = BLOCOS.find(b => b.tipo === tipo);
    return bloco ? bloco.icone : Settings;
  };

  const getCorBloco = (tipo) => {
    const bloco = BLOCOS.find(b => b.tipo === tipo);
    return bloco ? bloco.cor : 'from-gray-500 to-slate-500';
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 max-w-md">
            <Label>Nome do Fluxo</Label>
            <Input
              value={flow.nome}
              onChange={(e) => setFlow({ ...flow, nome: e.target.value })}
              placeholder="Ex: Follow-up Orçamentos"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={salvarFlow} className="bg-gradient-to-r from-blue-600 to-cyan-600">
              <Save className="w-4 h-4 mr-2" />
              Salvar Fluxo
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Categoria</Label>
            <Select value={flow.categoria} onValueChange={(v) => setFlow({ ...flow, categoria: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vendas">Vendas</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="atendimento">Atendimento</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Gatilho</Label>
            <Select value={flow.trigger_type} onValueChange={(v) => setFlow({ ...flow, trigger_type: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="novo_orcamento">Novo Orçamento</SelectItem>
                <SelectItem value="novo_cliente">Novo Cliente</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="steps">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {flow.steps.map((step, index) => {
                    const Icone = getIconeBloco(step.tipo);
                    return (
                      <Draggable key={step.id} draggableId={step.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <Card className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getCorBloco(step.tipo)} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                                    <Icone className="w-6 h-6 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-slate-900">{step.descricao}</h4>
                                    <p className="text-sm text-slate-600 truncate">
                                      {JSON.stringify(step.config).substring(0, 100)}...
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => editarBloco(step)}
                                    >
                                      <Settings className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removerBloco(step.id)}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
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

          {flow.steps.length === 0 && (
            <Card className="border-dashed border-2 border-slate-300">
              <CardContent className="p-12 text-center">
                <p className="text-slate-500 mb-4">Nenhum bloco adicionado ainda</p>
                <Button onClick={() => setShowBlockPicker(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Primeiro Bloco
                </Button>
              </CardContent>
            </Card>
          )}

          {flow.steps.length > 0 && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => setShowBlockPicker(true)}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-cyan-600"
              >
                <Plus className="w-5 h-5 mr-2" />
                Adicionar Bloco
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Block Picker Dialog */}
      <Dialog open={showBlockPicker} onOpenChange={setShowBlockPicker}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Escolha um Bloco</DialogTitle>
            <DialogDescription>
              Selecione o tipo de ação que deseja adicionar ao fluxo
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-4">
            {BLOCOS.map((bloco) => {
              const Icon = bloco.icone;
              return (
                <Card
                  key={bloco.tipo}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-blue-400"
                  onClick={() => adicionarBloco(bloco)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${bloco.cor} flex items-center justify-center shadow-lg flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900">{bloco.nome}</h4>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {subFlows.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 mb-3">Sub-Fluxos Reutilizáveis</h3>
              <div className="grid grid-cols-2 gap-3">
                {subFlows.map((subFlow) => (
                  <Card 
                    key={subFlow.id}
                    className="cursor-pointer hover:bg-teal-50 transition-colors border-2 border-teal-200"
                    onClick={() => {
                      const blocoSubFlow = {
                        tipo: 'chamar_subfluxo',
                        nome: `Sub-Fluxo: ${subFlow.nome}`,
                        icone: Package,
                        cor: 'from-teal-500 to-cyan-500',
                        configPadrao: {
                          subfluxo_id: subFlow.id,
                          parametros: {}
                        }
                      };
                      adicionarBloco(blocoSubFlow);
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-teal-600" />
                        <div>
                          <h4 className="font-semibold text-sm">{subFlow.nome}</h4>
                          <Badge variant="outline" className="text-xs mt-1">{subFlow.categoria}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Step Editor Dialog */}
      <Dialog open={showStepEditor} onOpenChange={setShowStepEditor}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Bloco</DialogTitle>
          </DialogHeader>
          {editingStep && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Descrição</Label>
                <Input
                  value={editingStep.descricao}
                  onChange={(e) => setEditingStep({ ...editingStep, descricao: e.target.value })}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Configuração (JSON)</Label>
                <textarea
                  value={JSON.stringify(editingStep.config, null, 2)}
                  onChange={(e) => {
                    try {
                      const config = JSON.parse(e.target.value);
                      setEditingStep({ ...editingStep, config });
                    } catch (error) {
                      // Ignora erro de parsing enquanto digita
                    }
                  }}
                  className="w-full h-64 p-3 border rounded-lg font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowStepEditor(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => salvarEdicaoBloco(editingStep)}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}