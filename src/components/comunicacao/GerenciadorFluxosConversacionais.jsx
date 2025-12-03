import React, { useState, useEffect } from "react";
import { WhatsAppTemplate } from "@/entities/WhatsAppTemplate";
import { FlowTemplate } from "@/entities/FlowTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Play, CheckCircle, Clock, X, Zap, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function GerenciadorFluxosConversacionais({ integracoes = [], onRecarregar }) {
  const [templates, setTemplates] = useState([]);
  const [fluxos, setFluxos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormTemplate, setShowFormTemplate] = useState(false);
  const [showFormFluxo, setShowFormFluxo] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingFluxo, setEditingFluxo] = useState(null);

  const [novoTemplate, setNovoTemplate] = useState({
    nome: "",
    conteudo: { body: "" },
    categoria: "UTILITY"
  });

  const [novoFluxo, setNovoFluxo] = useState({
    nome: "",
    categoria: "vendas",
    trigger_type: "manual",
    steps: []
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [templatesData, fluxosData] = await Promise.all([
        WhatsAppTemplate.list("-created_date"),
        FlowTemplate.list("-created_date")
      ]);
      setTemplates(templatesData);
      setFluxos(fluxosData);
    } catch (error) {
      console.error("Erro ao carregar fluxos:", error);
      toast.error("Erro ao carregar dados");
    }
    setLoading(false);
  };

  const handleSalvarTemplate = async () => {
    try {
      const integracaoAtiva = integracoes.find(i => i.status === 'conectado');
      
      const templateData = {
        ...novoTemplate,
        whatsapp_integration_id: integracaoAtiva?.id,
        status_meta: "rascunho",
        ativo: true
      };

      if (editingTemplate) {
        await WhatsAppTemplate.update(editingTemplate.id, templateData);
        toast.success("Template atualizado!");
      } else {
        await WhatsAppTemplate.create(templateData);
        toast.success("Template criado! Aguardando aprovação do WhatsApp.");
      }

      setShowFormTemplate(false);
      setEditingTemplate(null);
      setNovoTemplate({ nome: "", conteudo: { body: "" }, categoria: "UTILITY" });
      carregarDados();
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template");
    }
  };

  const handleSalvarFluxo = async () => {
    try {
      if (editingFluxo) {
        await FlowTemplate.update(editingFluxo.id, novoFluxo);
        toast.success("Fluxo atualizado!");
      } else {
        await FlowTemplate.create(novoFluxo);
        toast.success("Fluxo criado!");
      }

      setShowFormFluxo(false);
      setEditingFluxo(null);
      setNovoFluxo({ nome: "", categoria: "vendas", trigger_type: "manual", steps: [] });
      carregarDados();
    } catch (error) {
      console.error("Erro ao salvar fluxo:", error);
      toast.error("Erro ao salvar fluxo");
    }
  };

  const handleExcluirTemplate = async (id) => {
    if (confirm("Tem certeza que deseja excluir este template?")) {
      try {
        await WhatsAppTemplate.delete(id);
        toast.success("Template excluído!");
        carregarDados();
      } catch (error) {
        console.error("Erro ao excluir template:", error);
        toast.error("Erro ao excluir template");
      }
    }
  };

  const handleExcluirFluxo = async (id) => {
    if (confirm("Tem certeza que deseja excluir este fluxo?")) {
      try {
        await FlowTemplate.delete(id);
        toast.success("Fluxo excluído!");
        carregarDados();
      } catch (error) {
        console.error("Erro ao excluir fluxo:", error);
        toast.error("Erro ao excluir fluxo");
      }
    }
  };

  const statusBadge = (status) => {
    switch(status) {
      case "aprovado":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case "rascunho":
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Rascunho</Badge>;
      case "rejeitado":
        return <Badge className="bg-red-100 text-red-700"><X className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Fluxos Conversacionais Inteligentes</h2>
          <p className="text-slate-600 mt-1">Crie templates aprovados e fluxos de conversa automatizados</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditingTemplate(null); setNovoTemplate({ nome: "", conteudo: { body: "" }, categoria: "UTILITY" }); setShowFormTemplate(true); }} variant="outline">
            <MessageSquare className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
          <Button onClick={() => { setEditingFluxo(null); setNovoFluxo({ nome: "", categoria: "vendas", trigger_type: "manual", steps: [] }); setShowFormFluxo(true); }} className="bg-purple-600 hover:bg-purple-700">
            <Zap className="w-4 h-4 mr-2" />
            Novo Fluxo
          </Button>
        </div>
      </div>

      {/* Modal Formulário Template */}
      {showFormTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowFormTemplate(false)}>
          <Card className="w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <CardHeader className="border-b">
              <CardTitle>{editingTemplate ? "Editar Template" : "Novo Template WhatsApp"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Nome do Template</label>
                <Input value={novoTemplate.nome} onChange={(e) => setNovoTemplate({...novoTemplate, nome: e.target.value})} placeholder="Ex: boas_vindas" />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <select value={novoTemplate.categoria} onChange={(e) => setNovoTemplate({...novoTemplate, categoria: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="UTILITY">Utilitário</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="AUTHENTICATION">Autenticação</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Mensagem</label>
                <Textarea value={novoTemplate.conteudo.body} onChange={(e) => setNovoTemplate({...novoTemplate, conteudo: {...novoTemplate.conteudo, body: e.target.value}})} placeholder="Use {{1}}, {{2}} para variáveis" className="h-32" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowFormTemplate(false)}>Cancelar</Button>
                <Button onClick={handleSalvarTemplate} className="bg-purple-600">{editingTemplate ? "Atualizar" : "Criar"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Formulário Fluxo */}
      {showFormFluxo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowFormFluxo(false)}>
          <Card className="w-full max-w-3xl" onClick={e => e.stopPropagation()}>
            <CardHeader className="border-b">
              <CardTitle>{editingFluxo ? "Editar Fluxo" : "Novo Fluxo Conversacional"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Nome do Fluxo</label>
                <Input value={novoFluxo.nome} onChange={(e) => setNovoFluxo({...novoFluxo, nome: e.target.value})} placeholder="Ex: Qualificação de Lead" />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <select value={novoFluxo.categoria} onChange={(e) => setNovoFluxo({...novoFluxo, categoria: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="vendas">Vendas</option>
                  <option value="suporte">Suporte</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="follow_up">Follow-up</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Gatilho</label>
                <select value={novoFluxo.trigger_type} onChange={(e) => setNovoFluxo({...novoFluxo, trigger_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="manual">Manual</option>
                  <option value="tempo">Tempo (Agendado)</option>
                  <option value="evento">Evento do Sistema</option>
                  <option value="score">Score do Cliente</option>
                </select>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">💡 <strong>Editor Visual em Desenvolvimento:</strong> Em breve você poderá desenhar fluxos complexos com drag-and-drop. Por enquanto, os fluxos são criados via configuração básica.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowFormFluxo(false)}>Cancelar</Button>
                <Button onClick={handleSalvarFluxo} className="bg-purple-600">{editingFluxo ? "Atualizar" : "Criar"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs de Visualização */}
      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates">Templates WhatsApp ({templates.length})</TabsTrigger>
          <TabsTrigger value="fluxos">Fluxos Completos ({fluxos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <Card key={template.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.nome_exibicao || template.nome}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        {statusBadge(template.status_meta)}
                        <Badge variant="outline">{template.categoria}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingTemplate(template); setNovoTemplate(template); setShowFormTemplate(true); }} className="h-8 w-8">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleExcluirTemplate(template.id)} className="h-8 w-8 text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{template.conteudo?.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {templates.length === 0 && (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Nenhum template cadastrado</p>
              <Button onClick={() => setShowFormTemplate(true)} className="mt-4">Criar Primeiro Template</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="fluxos" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fluxos.map(fluxo => (
              <Card key={fluxo.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{fluxo.nome}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge className="capitalize">{fluxo.categoria}</Badge>
                        <Badge variant="outline">{fluxo.trigger_type}</Badge>
                        {fluxo.ativo && <Badge className="bg-green-100 text-green-700">Ativo</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingFluxo(fluxo); setNovoFluxo(fluxo); setShowFormFluxo(true); }} className="h-8 w-8">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleExcluirFluxo(fluxo.id)} className="h-8 w-8 text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{fluxo.steps?.length || 0} etapas configuradas</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {fluxos.length === 0 && (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <Zap className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Nenhum fluxo conversacional cadastrado</p>
              <Button onClick={() => setShowFormFluxo(true)} className="mt-4">Criar Primeiro Fluxo</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}