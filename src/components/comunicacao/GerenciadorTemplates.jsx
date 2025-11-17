
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppTemplate } from "@/entities/WhatsAppTemplate";
import { WhatsAppIntegration } from "@/entities/WhatsAppIntegration";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Send, 
  CheckCircle, 
  Clock, 
  X, 
  AlertCircle,
  Eye,
  Copy,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function GerenciadorTemplates() {
  const [templates, setTemplates] = useState([]);
  const [integracoes, setIntegracoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [novoTemplate, setNovoTemplate] = useState({
    nome: "",
    nome_exibicao: "",
    categoria: "UTILITY",
    idioma: "pt_BR",
    conteudo: {
      body: "",
      footer: "",
      header: null,
      buttons: []
    },
    variaveis: [],
    whatsapp_integration_id: ""
  });

  const categorias = [
    { value: "MARKETING", label: "Marketing", description: "Promoções e campanhas", color: "bg-purple-100 text-purple-700" },
    { value: "UTILITY", label: "Utilitário", description: "Confirmações e atualizações", color: "bg-blue-100 text-blue-700" },
    { value: "AUTHENTICATION", label: "Autenticação", description: "Códigos de verificação", color: "bg-green-100 text-green-700" }
  ];

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [templatesData, integracoesData] = await Promise.all([
        WhatsAppTemplate.list('-created_date'),
        WhatsAppIntegration.list()
      ]);
      setTemplates(templatesData);
      setIntegracoes(integracoesData);
    } catch (error) {
      console.error("Erro ao carregar templates:", error);
      toast.error("Erro ao carregar templates");
    }
    setLoading(false);
  };

  const statusBadge = (status) => {
    const config = {
      rascunho: { icon: Edit, label: "Rascunho", color: "bg-gray-100 text-gray-700" },
      enviado_aprovacao: { icon: Clock, label: "Em Análise", color: "bg-yellow-100 text-yellow-700" },
      aprovado: { icon: CheckCircle, label: "Aprovado", color: "bg-green-100 text-green-700" },
      rejeitado: { icon: X, label: "Rejeitado", color: "bg-red-100 text-red-700" },
      pausado: { icon: AlertCircle, label: "Pausado", color: "bg-orange-100 text-orange-700" }
    };
    
    const statusConfig = config[status] || config.rascunho;
    const Icon = statusConfig.icon;
    
    return (
      <Badge className={statusConfig.color}>
        <Icon className="w-3 h-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  const extrairVariaveis = (texto) => {
    const regex = /\{\{(\d+)\}\}/g;
    const variaveis = [];
    let match;
    while ((match = regex.exec(texto)) !== null) {
      const posicao = parseInt(match[1]);
      if (!variaveis.find(v => v.posicao === posicao)) {
        variaveis.push({
          posicao,
          nome: `variavel_${posicao}`,
          exemplo: `exemplo_${posicao}`
        });
      }
    }
    return variaveis.sort((a, b) => a.posicao - b.posicao);
  };

  const handleSubmeterParaAprovacao = async (template) => {
    setSubmitting(true);
    try {
      toast.info("Submetendo template para aprovação da Meta...");
      
      if (!template.conteudo.body) {
        throw new Error("O corpo do template é obrigatório");
      }
      
      if (!template.whatsapp_integration_id) {
        throw new Error("Selecione uma integração WhatsApp");
      }

      const integracao = integracoes.find(i => i.id === template.whatsapp_integration_id);
      if (!integracao || integracao.status !== 'conectado') {
        throw new Error("A integração WhatsApp deve estar conectada");
      }

      const templatePayload = {
        name: template.nome,
        language: template.idioma,
        category: template.categoria,
        components: [
          {
            type: "BODY",
            text: template.conteudo.body,
            example: template.variaveis.length > 0 ? {
              body_text: [template.variaveis.map(v => v.exemplo)]
            } : undefined
          }
        ]
      };

      if (template.conteudo.header) {
        templatePayload.components.unshift({
          type: "HEADER",
          format: template.conteudo.header.type,
          text: template.conteudo.header.type === "TEXT" ? template.conteudo.header.text : undefined
        });
      }

      if (template.conteudo.footer) {
        templatePayload.components.push({
          type: "FOOTER",
          text: template.conteudo.footer
        });
      }

      if (template.conteudo.buttons && template.conteudo.buttons.length > 0) {
        templatePayload.components.push({
          type: "BUTTONS",
          buttons: template.conteudo.buttons.map(b => ({
            type: b.type,
            text: b.text,
            url: b.url,
            phone_number: b.phone_number
          }))
        });
      }

      const { evolutionAPI } = await import("@/functions/evolutionAPI");
      const resultado = await evolutionAPI({
        action: 'submitTemplateToMeta',
        data: {
          instanceName: integracao.nome_instancia,
          template: templatePayload
        }
      });

      if (resultado.data.success) {
        await WhatsAppTemplate.update(template.id, {
          status_meta: 'enviado_aprovacao',
          template_id_meta: resultado.data.templateId
        });
        
        toast.success("Template submetido para aprovação! Aguarde análise da Meta (até 24h).");
        await carregarDados();
      } else {
        throw new Error(resultado.data.error || "Falha ao submeter template");
      }

    } catch (error) {
      console.error("Erro ao submeter template:", error);
      toast.error(`Erro: ${error.message}`);
    }
    setSubmitting(false);
  };

  const handleVerificarStatusMeta = async (template) => {
    try {
      if (!template.template_id_meta) {
        toast.error("Template ainda não foi submetido para aprovação");
        return;
      }

      toast.info("Verificando status na Meta...");

      const integracao = integracoes.find(i => i.id === template.whatsapp_integration_id);
      
      const { evolutionAPI } = await import("@/functions/evolutionAPI");
      const resultado = await evolutionAPI({
        action: 'getTemplateStatus',
        data: {
          instanceName: integracao.nome_instancia,
          templateName: template.nome
        }
      });

      if (resultado.data.success) {
        const novoStatus = resultado.data.status;
        
        await WhatsAppTemplate.update(template.id, {
          status_meta: novoStatus,
          data_aprovacao: novoStatus === 'aprovado' ? new Date().toISOString() : null,
          motivo_rejeicao: resultado.data.rejection_reason || null
        });

        if (novoStatus === 'aprovado') {
          toast.success("✅ Template aprovado pela Meta!");
        } else if (novoStatus === 'rejeitado') {
          toast.error(`❌ Template rejeitado: ${resultado.data.rejection_reason}`);
        } else {
          toast.info(`Status: ${novoStatus}`);
        }

        await carregarDados();
      }

    } catch (error) {
      console.error("Erro ao verificar status:", error);
      toast.error("Erro ao verificar status na Meta");
    }
  };

  const handleSalvar = async () => {
    try {
      if (!novoTemplate.nome || !novoTemplate.nome_exibicao || !novoTemplate.conteudo.body) {
        toast.error("Preencha os campos obrigatórios");
        return;
      }

      const nomeFormatado = novoTemplate.nome.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const variaveis = extrairVariaveis(novoTemplate.conteudo.body);

      const templateData = {
        ...novoTemplate,
        nome: nomeFormatado,
        variaveis,
        status_meta: editingTemplate ? editingTemplate.status_meta : 'rascunho',
        ativo: true
      };

      if (editingTemplate) {
        await WhatsAppTemplate.update(editingTemplate.id, templateData);
        toast.success("Template atualizado!");
      } else {
        await WhatsAppTemplate.create(templateData);
        toast.success("Template criado! Agora submeta para aprovação da Meta.");
      }

      setShowForm(false);
      setEditingTemplate(null);
      resetForm();
      await carregarDados();

    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template");
    }
  };

  const handleEditar = (template) => {
    setEditingTemplate(template);
    setNovoTemplate({
      nome: template.nome,
      nome_exibicao: template.nome_exibicao,
      categoria: template.categoria,
      idioma: template.idioma,
      conteudo: template.conteudo,
      variaveis: template.variaveis,
      whatsapp_integration_id: template.whatsapp_integration_id
    });
    setShowForm(true);
  };

  const handleExcluir = async (template) => {
    if (!confirm(`Tem certeza que deseja excluir o template "${template.nome_exibicao}"?`)) return;

    try {
      await WhatsAppTemplate.delete(template.id);
      toast.success("Template excluído!");
      await carregarDados();
    } catch (error) {
      console.error("Erro ao excluir template:", error);
      toast.error("Erro ao excluir template");
    }
  };

  const resetForm = () => {
    setNovoTemplate({
      nome: "",
      nome_exibicao: "",
      categoria: "UTILITY",
      idioma: "pt_BR",
      conteudo: {
        body: "",
        footer: "",
        header: null,
        buttons: []
      },
      variaveis: [],
      whatsapp_integration_id: ""
    });
  };

  const adicionarBotao = () => {
    setNovoTemplate({
      ...novoTemplate,
      conteudo: {
        ...novoTemplate.conteudo,
        buttons: [
          ...(novoTemplate.conteudo.buttons || []),
          { type: "QUICK_REPLY", text: "" }
        ]
      }
    });
  };

  const removerBotao = (index) => {
    const buttons = [...novoTemplate.conteudo.buttons];
    buttons.splice(index, 1);
    setNovoTemplate({
      ...novoTemplate,
      conteudo: {
        ...novoTemplate.conteudo,
        buttons
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Info de Conformidade */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg text-green-900 mb-2">Templates Aprovados pela Meta</h3>
              <p className="text-sm text-green-800 mb-3">
                Os templates são necessários para iniciar conversas fora da janela de 24 horas e para envios em massa.
                Todos os templates devem ser aprovados pela Meta antes do uso.
              </p>
              <div className="flex gap-2 text-xs text-green-700">
                <Badge className="bg-green-100 text-green-800">✓ Conformidade LGPD</Badge>
                <Badge className="bg-blue-100 text-blue-800">✓ WhatsApp Business API</Badge>
                <Badge className="bg-purple-100 text-purple-800">✓ Escalável</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Novo Template */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Meus Templates</h2>
          <p className="text-slate-600 mt-1">Gerencie templates de mensagens aprovados pela Meta</p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingTemplate(null); }} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Editar Template" : "Criar Novo Template"}</DialogTitle>
              <DialogDescription>
                Preencha as informações do template. Use {"{{1}}"}, {"{{2}}"} para variáveis dinâmicas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Nome e Exibição */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome Técnico *</Label>
                  <Input
                    value={novoTemplate.nome}
                    onChange={(e) => setNovoTemplate({...novoTemplate, nome: e.target.value})}
                    placeholder="nome_do_template"
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Apenas letras minúsculas e underscores</p>
                </div>
                <div>
                  <Label>Nome para Exibição *</Label>
                  <Input
                    value={novoTemplate.nome_exibicao}
                    onChange={(e) => setNovoTemplate({...novoTemplate, nome_exibicao: e.target.value})}
                    placeholder="Template de Boas-Vindas"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Categoria e Integração WhatsApp */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria *</Label>
                  <Select value={novoTemplate.categoria} onValueChange={(value) => setNovoTemplate({...novoTemplate, categoria: value})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div>
                            <div className="font-medium">{cat.label}</div>
                            <div className="text-xs text-slate-500">{cat.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Integração WhatsApp *</Label>
                  <Select value={novoTemplate.whatsapp_integration_id} onValueChange={(value) => setNovoTemplate({...novoTemplate, whatsapp_integration_id: value})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {integracoes.map(int => (
                        <SelectItem key={int.id} value={int.id}>
                          {int.nome_instancia} ({int.numero_telefone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Corpo da Mensagem */}
              <div>
                <Label>Corpo da Mensagem *</Label>
                <Textarea
                  value={novoTemplate.conteudo.body}
                  onChange={(e) => setNovoTemplate({
                    ...novoTemplate,
                    conteudo: {...novoTemplate.conteudo, body: e.target.value}
                  })}
                  placeholder="Olá {{1}}, sua compra de R$ {{2}} foi confirmada!"
                  className="mt-1 h-32"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use {"{{1}}"}, {"{{2}}"}, {"{{3}}"} para variáveis. Exemplo: Olá {"{{1}}"} = Olá João
                </p>
                {extrairVariaveis(novoTemplate.conteudo.body).length > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs font-medium text-blue-900 mb-1">Variáveis detectadas:</p>
                    <div className="flex gap-2 flex-wrap">
                      {extrairVariaveis(novoTemplate.conteudo.body).map(v => (
                        <Badge key={v.posicao} variant="outline" className="text-xs">
                          {`{{${v.posicao}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé */}
              <div>
                <Label>Rodapé (Opcional)</Label>
                <Input
                  value={novoTemplate.conteudo.footer}
                  onChange={(e) => setNovoTemplate({
                    ...novoTemplate,
                    conteudo: {...novoTemplate.conteudo, footer: e.target.value}
                  })}
                  placeholder="VendaPro - Seu parceiro de vendas"
                  className="mt-1"
                  maxLength={60}
                />
                <p className="text-xs text-slate-500 mt-1">Máximo 60 caracteres</p>
              </div>

              {/* Botões */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Botões de Ação (Opcional)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={adicionarBotao}>
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Botão
                  </Button>
                </div>
                {novoTemplate.conteudo.buttons && novoTemplate.conteudo.buttons.map((botao, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      value={botao.text}
                      onChange={(e) => {
                        const buttons = [...novoTemplate.conteudo.buttons];
                        buttons[index].text = e.target.value;
                        setNovoTemplate({
                          ...novoTemplate,
                          conteudo: {...novoTemplate.conteudo, buttons}
                        });
                      }}
                      placeholder="Texto do botão"
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removerBotao(index)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </h4>
                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 max-w-sm">
                  <p className="text-sm whitespace-pre-wrap">{novoTemplate.conteudo.body || "Seu texto aparecerá aqui..."}</p>
                  {novoTemplate.conteudo.footer && (
                    <p className="text-xs text-slate-500 mt-2 border-t pt-2">{novoTemplate.conteudo.footer}</p>
                  )}
                  {novoTemplate.conteudo.buttons && novoTemplate.conteudo.buttons.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {novoTemplate.conteudo.buttons.map((b, i) => (
                        <div key={i} className="text-center py-2 bg-blue-50 text-blue-700 rounded text-sm font-medium">
                          {b.text || "Botão"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSalvar} className="bg-green-600 hover:bg-green-700">
                  {editingTemplate ? "Atualizar" : "Criar"} Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {templates.map(template => {
          const categoria = categorias.find(c => c.value === template.categoria);
          
          return (
            <Card key={template.id} className="hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.nome_exibicao}</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">/{template.nome}</p>
                    <div className="flex gap-2 mt-3">
                      {statusBadge(template.status_meta)}
                      <Badge className={categoria?.color}>{categoria?.label}</Badge>
                      {template.ativo && <Badge className="bg-green-100 text-green-700">Ativo</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {template.status_meta === 'rascunho' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditar(template)}
                        className="h-8 w-8"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExcluir(template)}
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-50 p-3 rounded-lg mb-3">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{template.conteudo.body}</p>
                  {template.conteudo.footer && (
                    <p className="text-xs text-slate-500 mt-2 border-t pt-2">{template.conteudo.footer}</p>
                  )}
                </div>

                {template.variaveis && template.variaveis.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-slate-600 mb-1">Variáveis:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variaveis.map(v => (
                        <Badge key={v.posicao} variant="outline" className="text-xs">
                          {`{{${v.posicao}}}`} = {v.exemplo}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {template.estatisticas && (
                  <div className="flex gap-4 text-xs text-slate-600 mb-3">
                    <span>Enviados: {template.estatisticas.total_envios || 0}</span>
                    <span>Taxa Entrega: {template.estatisticas.taxa_entrega || 0}%</span>
                    <span>Taxa Leitura: {template.estatisticas.taxa_leitura || 0}%</span>
                  </div>
                )}

                <div className="flex gap-2">
                  {template.status_meta === 'rascunho' && (
                    <Button
                      onClick={() => handleSubmeterParaAprovacao(template)}
                      disabled={submitting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      {submitting ? "Submetendo..." : "Submeter para Aprovação"}
                    </Button>
                  )}
                  
                  {template.status_meta === 'enviado_aprovacao' && (
                    <Button
                      onClick={() => handleVerificarStatusMeta(template)}
                      variant="outline"
                      className="flex-1"
                      size="sm"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Verificar Status
                    </Button>
                  )}

                  {template.status_meta === 'aprovado' && (
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(template.nome);
                        toast.success("Nome do template copiado!");
                      }}
                      variant="outline"
                      className="flex-1"
                      size="sm"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar Nome
                    </Button>
                  )}

                  {template.status_meta === 'rejeitado' && template.motivo_rejeicao && (
                    <div className="flex-1 p-2 bg-red-50 rounded border border-red-200 text-xs text-red-700">
                      <strong>Motivo:</strong> {template.motivo_rejeicao}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <Send className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-xl font-bold text-slate-700">Nenhum template cadastrado</p>
          <p className="text-slate-500 mt-2">Crie seu primeiro template para começar a automatizar comunicações</p>
        </div>
      )}
    </div>
  );
}
