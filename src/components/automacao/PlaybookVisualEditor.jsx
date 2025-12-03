import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  X,
  MessageSquare,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";

export default function PlaybookVisualEditor({ playbook, onSave, onCancel }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [tipoFluxo, setTipoFluxo] = useState("geral");
  const [gatilhos, setGatilhos] = useState([]);
  const [novoGatilho, setNovoGatilho] = useState("");
  const [prioridade, setPrioridade] = useState(10);
  const [steps, setSteps] = useState([]);
  const [ativo, setAtivo] = useState(true);
  const [requiresIA, setRequiresIA] = useState(false);
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [maxTentativas, setMaxTentativas] = useState(3);
  const [timeoutMinutos, setTimeoutMinutos] = useState(30);

  useEffect(() => {
    if (playbook) {
      setNome(playbook.nome || "");
      setDescricao(playbook.descricao || "");
      setCategoria(playbook.categoria || "geral");
      setTipoFluxo(playbook.tipo_fluxo || "geral");
      setGatilhos(playbook.gatilhos || []);
      setPrioridade(playbook.prioridade || 10);
      setSteps(playbook.steps || []);
      setAtivo(playbook.ativo !== false);
      setRequiresIA(playbook.requires_ia || false);
      setAutoEscalate(playbook.auto_escalate_to_human || false);
      setMaxTentativas(playbook.max_tentativas || 3);
      setTimeoutMinutos(playbook.timeout_minutos || 30);
    }
  }, [playbook]);

  const adicionarGatilho = () => {
    if (novoGatilho.trim()) {
      setGatilhos([...gatilhos, novoGatilho.trim()]);
      setNovoGatilho("");
    }
  };

  const removerGatilho = (index) => {
    setGatilhos(gatilhos.filter((_, i) => i !== index));
  };

  const adicionarStep = (tipo) => {
    const novoStep = {
      type: tipo,
      texto: "",
      campo: "",
      opcoes: [],
      delay_days: 0,
      message_template_name: "",
      require_human_on_fail: false
    };

    setSteps([...steps, novoStep]);
  };

  const atualizarStep = (index, campo, valor) => {
    const novosSteps = [...steps];
    novosSteps[index] = { ...novosSteps[index], [campo]: valor };
    setSteps(novosSteps);
  };

  const removerStep = (index) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const moverStep = (index, direcao) => {
    if (
      (direcao === "up" && index === 0) ||
      (direcao === "down" && index === steps.length - 1)
    ) {
      return;
    }

    const novosSteps = [...steps];
    const novoIndex = direcao === "up" ? index - 1 : index + 1;
    [novosSteps[index], novosSteps[novoIndex]] = [novosSteps[novoIndex], novosSteps[index]];
    setSteps(novosSteps);
  };

  const handleSave = () => {
    if (!nome.trim()) {
      toast.error("Nome do playbook é obrigatório");
      return;
    }

    if (gatilhos.length === 0) {
      toast.error("Adicione pelo menos um gatilho");
      return;
    }

    if (steps.length === 0) {
      toast.error("Adicione pelo menos um step");
      return;
    }

    const playbookData = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      categoria,
      tipo_fluxo: tipoFluxo,
      gatilhos,
      prioridade,
      steps,
      ativo,
      requires_ia: requiresIA,
      auto_escalate_to_human: autoEscalate,
      max_tentativas: maxTentativas,
      timeout_minutos: timeoutMinutos
    };

    onSave(playbookData);
  };

  const tiposStep = [
    { value: "message", label: "Mensagem", icon: MessageSquare },
    { value: "input", label: "Aguardar Resposta", icon: MessageSquare },
    { value: "ia_classify", label: "Análise IA", icon: Zap },
    { value: "action", label: "Ação", icon: Zap },
    { value: "delay", label: "Aguardar Tempo", icon: Clock },
    { value: "end", label: "Finalizar", icon: CheckCircle }
  ];

  return (
    <div className="space-y-6">
      {/* Configurações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Configurações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Playbook *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Boas-vindas e Qualificação"
              />
            </div>

            <div>
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendas">💰 Vendas</SelectItem>
                  <SelectItem value="suporte">🛠️ Suporte</SelectItem>
                  <SelectItem value="logistica">🚚 Logística</SelectItem>
                  <SelectItem value="financeiro">💳 Financeiro</SelectItem>
                  <SelectItem value="pos_venda">⭐ Pós-venda</SelectItem>
                  <SelectItem value="geral">🔧 Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Fluxo *</Label>
              <Select value={tipoFluxo} onValueChange={setTipoFluxo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">🔧 Geral</SelectItem>
                  <SelectItem value="follow_up_vendas">🎯 Follow-up de Vendas</SelectItem>
                  <SelectItem value="nurturing_leads">🌱 Nutrição de Leads</SelectItem>
                  <SelectItem value="ativacao_cliente">✨ Ativação de Cliente</SelectItem>
                  <SelectItem value="reativacao">🔄 Reativação</SelectItem>
                  <SelectItem value="qualificacao">📋 Qualificação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioridade (1-10, menor = mais importante)</Label>
              <Input
                type="number"
                value={prioridade}
                onChange={(e) => setPrioridade(parseInt(e.target.value) || 10)}
                min="1"
                max="10"
              />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o objetivo deste playbook..."
              rows={3}
            />
          </div>

          {/* Gatilhos */}
          <div>
            <Label>Gatilhos (palavras-chave) *</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={novoGatilho}
                onChange={(e) => setNovoGatilho(e.target.value)}
                placeholder="Ex: oi, olá, bom dia"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), adicionarGatilho())}
              />
              <Button onClick={adicionarGatilho} type="button">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {gatilhos.map((gatilho, index) => (
                <Badge key={index} className="flex items-center gap-1">
                  {gatilho}
                  <button
                    onClick={() => removerGatilho(index)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Configurações Avançadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label>Playbook Ativo</Label>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Requer IA</Label>
              <Switch checked={requiresIA} onCheckedChange={setRequiresIA} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-escalar para humano</Label>
              <Switch checked={autoEscalate} onCheckedChange={setAutoEscalate} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Máx. Tentativas (inputs inválidos)</Label>
              <Input
                type="number"
                value={maxTentativas}
                onChange={(e) => setMaxTentativas(parseInt(e.target.value) || 3)}
                min="1"
                max="10"
              />
            </div>
            <div>
              <Label>Timeout (minutos sem resposta)</Label>
              <Input
                type="number"
                value={timeoutMinutos}
                onChange={(e) => setTimeoutMinutos(parseInt(e.target.value) || 30)}
                min="5"
                max="1440"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps do Fluxo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Steps do Fluxo
            </span>
            <div className="flex gap-2">
              {tiposStep.map((tipo) => (
                <Button
                  key={tipo.value}
                  onClick={() => adicionarStep(tipo.value)}
                  size="sm"
                  variant="outline"
                  type="button"
                >
                  <tipo.icon className="w-4 h-4 mr-1" />
                  {tipo.label}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum step adicionado. Clique em um dos botões acima para começar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <StepEditor
                  key={index}
                  step={step}
                  index={index}
                  onUpdate={atualizarStep}
                  onRemove={removerStep}
                  onMove={moverStep}
                  isFirst={index === 0}
                  isLast={index === steps.length - 1}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} type="button">
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700" type="button">
          <Save className="w-4 h-4 mr-2" />
          Salvar Playbook
        </Button>
      </div>
    </div>
  );
}

function StepEditor({ step, index, onUpdate, onRemove, onMove, isFirst, isLast }) {
  const stepIcons = {
    message: MessageSquare,
    input: MessageSquare,
    ia_classify: Zap,
    action: Zap,
    delay: Clock,
    end: CheckCircle
  };

  const StepIcon = stepIcons[step.type] || MessageSquare;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StepIcon className="w-5 h-5 text-blue-600" />
            <Badge variant="outline">Step {index + 1}</Badge>
            <span className="font-semibold capitalize">{step.type.replace('_', ' ')}</span>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onMove(index, "up")}
              disabled={isFirst}
              type="button"
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onMove(index, "down")}
              disabled={isLast}
              type="button"
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onRemove(index)}
              className="text-red-500 hover:text-red-700"
              type="button"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* MESSAGE */}
        {step.type === "message" && (
          <>
            <div>
              <Label>Texto da Mensagem *</Label>
              <Textarea
                value={step.texto || ""}
                onChange={(e) => onUpdate(index, "texto", e.target.value)}
                placeholder="Use {{variavel}} para interpolar valores"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Aguardar (dias) - para Follow-up</Label>
                <Input
                  type="number"
                  value={step.delay_days || 0}
                  onChange={(e) => onUpdate(index, "delay_days", parseInt(e.target.value) || 0)}
                  min="0"
                  placeholder="Ex: 1, 3, 7, 15"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Se &gt; 0, aguarda X dias antes do próximo step
                </p>
              </div>
              <div>
                <Label>Nome do Template WhatsApp (opcional)</Label>
                <Input
                  value={step.message_template_name || ""}
                  onChange={(e) => onUpdate(index, "message_template_name", e.target.value)}
                  placeholder="Ex: boas_vindas_v1"
                />
              </div>
            </div>
          </>
        )}

        {/* INPUT */}
        {step.type === "input" && (
          <>
            <div>
              <Label>Pergunta *</Label>
              <Textarea
                value={step.texto || ""}
                onChange={(e) => onUpdate(index, "texto", e.target.value)}
                placeholder="Qual pergunta deseja fazer?"
                rows={2}
              />
            </div>
            <div>
              <Label>Nome do Campo (variável) *</Label>
              <Input
                value={step.campo || ""}
                onChange={(e) => onUpdate(index, "campo", e.target.value)}
                placeholder="Ex: nome_cliente, email, telefone"
              />
            </div>
            <div>
              <Label>Opções (opcional, uma por linha)</Label>
              <Textarea
                value={(step.opcoes || []).join("\n")}
                onChange={(e) =>
                  onUpdate(
                    index,
                    "opcoes",
                    e.target.value.split("\n").filter((o) => o.trim())
                  )
                }
                placeholder="Sim&#10;Não&#10;Talvez"
                rows={3}
              />
            </div>
          </>
        )}

        {/* IA_CLASSIFY */}
        {step.type === "ia_classify" && (
          <div className="bg-purple-50 p-3 rounded-lg">
            <p className="text-sm text-purple-800">
              <Zap className="w-4 h-4 inline mr-1" />
              A IA analisará a última mensagem do usuário e armazenará:
            </p>
            <ul className="text-xs text-purple-700 mt-2 ml-4 space-y-1">
              <li>• <code>ia_intent</code>: intenção detectada</li>
              <li>• <code>ia_sentiment</code>: sentimento (positivo, neutro, negativo)</li>
              <li>• <code>ia_confidence</code>: nível de confiança</li>
            </ul>
          </div>
        )}

        {/* ACTION */}
        {step.type === "action" && (
          <>
            <div>
              <Label>Ação *</Label>
              <Select
                value={step.acao || ""}
                onValueChange={(value) => onUpdate(index, "acao", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="criarLead">Criar Lead</SelectItem>
                  <SelectItem value="agendarFollowUp">Agendar Follow-up</SelectItem>
                  <SelectItem value="enviarOrcamento">Enviar Orçamento</SelectItem>
                  <SelectItem value="atribuirVendedor">Atribuir Vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parâmetros (opcional, um por linha)</Label>
              <Textarea
                value={(step.parametros || []).join("\n")}
                onChange={(e) =>
                  onUpdate(
                    index,
                    "parametros",
                    e.target.value.split("\n").filter((p) => p.trim())
                  )
                }
                placeholder="Ex: vendedor_nome&#10;3 (dias)"
                rows={2}
              />
            </div>
          </>
        )}

        {/* DELAY */}
        {step.type === "delay" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dias</Label>
              <Input
                type="number"
                value={step.delay_days || 0}
                onChange={(e) => onUpdate(index, "delay_days", parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>
            <div>
              <Label>Segundos</Label>
              <Input
                type="number"
                value={step.delay_seconds || 0}
                onChange={(e) => onUpdate(index, "delay_seconds", parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>
          </div>
        )}

        {/* END */}
        {step.type === "end" && (
          <div>
            <Label>Mensagem de Encerramento</Label>
            <Textarea
              value={step.texto || ""}
              onChange={(e) => onUpdate(index, "texto", e.target.value)}
              placeholder="Obrigado por entrar em contato!"
              rows={2}
            />
          </div>
        )}

        {/* Opção de Escalonamento */}
        {step.type !== "end" && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Switch
              checked={step.require_human_on_fail || false}
              onCheckedChange={(checked) => onUpdate(index, "require_human_on_fail", checked)}
            />
            <Label className="text-xs text-slate-600">
              Escalonar para humano se este step falhar
            </Label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}