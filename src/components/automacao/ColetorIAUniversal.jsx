import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Save, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Coletor IA Universal
 * Permite colar texto livre e a IA classificar/criar templates de:
 * - Playbooks (FlowTemplate)
 * - Respostas Rápidas (QuickReply)
 * - Regras de Pré-Atendimento (PreAtendimentoRule)
 */
export default function ColetorIAUniversal({ isOpen, onClose, tipoTemplate, onSalvar }) {
  const [textoColado, setTextoColado] = useState('');
  const [processando, setProcessando] = useState(false);
  const [templatesProcessados, setTemplatesProcessados] = useState([]);

  const tiposConfig = {
    playbook: {
      titulo: 'Playbooks',
      icone: '⚡',
      cor: 'purple',
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            descricao: { type: "string" },
            categoria: { type: "string" },
            gatilhos: { type: "array", items: { type: "string" } },
            steps: { type: "array" },
            prioridade: { type: "number" }
          }
        }
      },
      promptBase: `Você é um especialista em criar Playbooks (Fluxos Conversacionais) para WhatsApp.

Analise o texto fornecido e identifique TODOS os possíveis playbooks/fluxos conversacionais mencionados.

Para cada playbook, retorne:
- nome: Nome descritivo do playbook
- descricao: Descrição do que o playbook faz
- categoria: uma de ["vendas", "suporte", "logistica", "financeiro", "pos_venda", "geral"]
- gatilhos: array de palavras-chave que ativam este playbook
- steps: array de passos do fluxo (mínimo 2 steps)
- prioridade: número de 1 a 100

Formato de cada step:
{
  "type": "message" | "input" | "action" | "route",
  "texto": "Texto da mensagem (se type=message)",
  "campo": "nome_do_campo (se type=input)",
  "opcoes": ["opcao1", "opcao2"] (se aplicável)
}`
    },
    quick_reply: {
      titulo: 'Respostas Rápidas',
      icone: '💬',
      cor: 'blue',
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            comando: { type: "string" },
            conteudo: { type: "string" },
            categoria: { type: "string" }
          }
        }
      },
      promptBase: `Você é um especialista em criar Respostas Rápidas para atendimento via WhatsApp.

Analise o texto fornecido e identifique TODAS as possíveis respostas rápidas mencionadas.

Para cada resposta rápida, retorne:
- titulo: Título descritivo da resposta
- comando: Comando de ativação (formato: /comando_sem_espacos)
- conteudo: Texto completo da resposta (mantenha cordial e profissional)
- categoria: uma de ["vendas", "suporte", "informacoes", "saudacao", "despedida", "agendamento"]

Exemplo:
Input: "Quando o cliente pergunta o horário, respondo: Atendemos de segunda a sexta, das 8h às 18h"
Output: {
  "titulo": "Horário de Atendimento",
  "comando": "/horario",
  "conteudo": "Atendemos de segunda a sexta-feira, das 8h às 18h. Aos sábados, das 9h às 13h. Posso ajudar em algo mais?",
  "categoria": "informacoes"
}`
    },
    pre_atendimento: {
      titulo: 'Regras de Pré-Atendimento',
      icone: '🛡️',
      cor: 'green',
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            descricao: { type: "string" },
            categoria: { type: "string" },
            tipo_acao: { type: "string" },
            prioridade: { type: "number" },
            condicoes: { type: "object" },
            acao_configuracao: { type: "object" }
          }
        }
      },
      promptBase: `Você é um especialista em análise de regras de pré-atendimento para sistemas de WhatsApp.

Analise o texto e identifique TODAS as regras/exceções de pré-atendimento mencionadas.

Para cada regra, retorne:
- nome: Nome descritivo (ex: "Cliente Bloqueado")
- descricao: Descrição detalhada do que a regra faz
- categoria: uma de ["bloqueio", "atribuicao", "horario", "fidelizacao", "gatilho_direto", "ia_alta_confianca", "sistema"]
- tipo_acao: uma de ["nao_ativar_pre_atendimento", "rotear_direto", "enviar_mensagem", "bloquear", "executar_playbook"]
- prioridade: número de 1 a 100 (menor = maior prioridade)
- condicoes: objeto com as condições relevantes
- acao_configuracao: objeto com a configuração da ação`
    }
  };

  const config = tiposConfig[tipoTemplate];

  const processarComIA = async () => {
    if (!textoColado.trim()) {
      toast.error('Cole o texto para processar');
      return;
    }

    setProcessando(true);
    try {
      const prompt = `${config.promptBase}

TEXTO PARA ANÁLISE:
"${textoColado}"

Retorne uma ARRAY de objetos com as ${config.titulo.toLowerCase()} identificadas.`;

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: config.schema
      });

      if (!resultado || resultado.length === 0) {
        toast.warning('Nenhum template identificado. Tente reformular o texto.');
        return;
      }

      setTemplatesProcessados(resultado.map(r => ({ ...r, ativa: true })));
      toast.success(`${resultado.length} ${config.titulo.toLowerCase()} identificados!`);
    } catch (error) {
      console.error('[ColetorIA] Erro:', error);
      toast.error('Erro ao processar com IA: ' + error.message);
    } finally {
      setProcessando(false);
    }
  };

  const handleSalvarTodos = () => {
    const selecionados = templatesProcessados.filter(t => t.ativa);
    if (selecionados.length === 0) {
      toast.error('Selecione pelo menos um template para salvar');
      return;
    }
    onSalvar(selecionados);
    setTextoColado('');
    setTemplatesProcessados([]);
    onClose();
  };

  const handleToggle = (index) => {
    const novos = [...templatesProcessados];
    novos[index].ativa = !novos[index].ativa;
    setTemplatesProcessados(novos);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className={`w-5 h-5 text-${config.cor}-600`} />
            Coletor Inteligente de {config.titulo}
          </DialogTitle>
          <DialogDescription>
            Cole uma lista, descrição ou cenários e a IA irá identificar e classificar automaticamente os {config.titulo.toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {templatesProcessados.length === 0 ? (
            <>
              <div>
                <Textarea
                  value={textoColado}
                  onChange={(e) => setTextoColado(e.target.value)}
                  placeholder={`Cole aqui sua lista de ${config.titulo.toLowerCase()}...

Exemplo:
${tipoTemplate === 'playbook' ? '- Fluxo de boas-vindas para novos clientes\n- Atendimento de pós-venda\n- Qualificação de leads' : ''}${tipoTemplate === 'quick_reply' ? '- Horário: Atendemos seg-sex 8h-18h\n- Preço: Consulte nosso site\n- Entrega: 5-7 dias úteis' : ''}${tipoTemplate === 'pre_atendimento' ? '- Cliente bloqueado não deve entrar no pré-atendimento\n- Conversa já atribuída pula o menu\n- Fora de horário envia mensagem automática' : ''}`}
                  rows={14}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button 
                  onClick={processarComIA}
                  disabled={processando || !textoColado.trim()}
                  className={`bg-gradient-to-r from-${config.cor}-600 to-${config.cor}-700`}
                >
                  {processando ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando com IA...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Processar com IA
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium">
                  ✅ {templatesProcessados.length} {config.titulo.toLowerCase()} identificados! Revise e selecione quais deseja salvar:
                </p>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {templatesProcessados.map((template, idx) => (
                  <Card key={idx} className={!template.ativa && 'opacity-60'}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={template.ativa}
                          onCheckedChange={() => handleToggle(idx)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{config.icone}</span>
                            <h4 className="font-semibold text-slate-900">
                              {template.nome || template.titulo}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {template.categoria}
                            </Badge>
                            {template.prioridade && (
                              <Badge variant="outline" className="text-xs">
                                Prioridade {template.prioridade}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            {template.descricao || template.conteudo?.substring(0, 150)}
                          </p>
                          {template.comando && (
                            <Badge className="text-xs bg-blue-100 text-blue-800">
                              {template.comando}
                            </Badge>
                          )}
                          {template.gatilhos && template.gatilhos.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {template.gatilhos.slice(0, 3).map((g, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {g}
                                </Badge>
                              ))}
                              {template.gatilhos.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{template.gatilhos.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setTemplatesProcessados([]);
                    setTextoColado('');
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Descartar
                </Button>
                <Button 
                  onClick={handleSalvarTodos}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Selecionados ({templatesProcessados.filter(t => t.ativa).length})
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}