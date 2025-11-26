import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, Shield, MessageSquare, Clock, BarChart3, CheckCircle2, XCircle, 
  AlertCircle, Users, FileText, Phone, Home, Target, Building2, Package, 
  Calendar, Brain, Upload, UserCog, Bug, Search, Save, Loader2, 
  ChevronRight, Settings, Eye, Send, Plus, Trash2, UserCheck
} from "lucide-react";
import { toast } from "sonner";

// Páginas disponíveis
const PAGINAS_DISPONIVEIS = [
  { page: "Comunicacao", name: "💬 Central de Comunicação", icon: MessageSquare, categoria: "Comunicação" },
  { page: "Dashboard", name: "Dashboard", icon: Home, categoria: "Geral" },
  { page: "LeadsQualificados", name: "🎯 Leads Qualificados", icon: Target, categoria: "Vendas" },
  { page: "Clientes", name: "Clientes", icon: Building2, categoria: "CRM" },
  { page: "Vendedores", name: "Vendedores", icon: Users, categoria: "Vendas" },
  { page: "Produtos", name: "Produtos", icon: Package, categoria: "Catálogo" },
  { page: "Agenda", name: "Agenda Inteligente", icon: Calendar, categoria: "Geral" },
  { page: "AnalyticsAvancado", name: "Analytics Avançado", icon: BarChart3, categoria: "Relatórios" },
  { page: "NexusCommandCenter", name: "🤖 Nexus Command Center", icon: Brain, categoria: "IA" },
  { page: "Importacao", name: "Importação", icon: Upload, categoria: "Dados" },
  { page: "Usuarios", name: "Gerenciamento de Usuários", icon: UserCog, categoria: "Administração" },
  { page: "Auditoria", name: "Auditoria", icon: Shield, categoria: "Administração" },
  { page: "DiagnosticoCirurgico", name: "🔬 Diagnóstico Cirúrgico", icon: Bug, categoria: "Administração" }
];

// Perfis predefinidos
const PERFIS_ACESSO = {
  admin: { label: "👑 Administrador", paginas: PAGINAS_DISPONIVEIS.map(p => p.page) },
  gerencia_vendas: { label: "📊 Gerência - Vendas", paginas: ["Comunicacao", "Dashboard", "LeadsQualificados", "Vendedores", "Clientes", "AnalyticsAvancado", "Agenda", "Produtos"] },
  gerencia_compras: { label: "📦 Gerência - Compras", paginas: ["Comunicacao", "Produtos", "Importacao", "Dashboard", "Clientes", "Agenda", "AnalyticsAvancado"] },
  supervisor_vendas: { label: "👔 Supervisor - Vendas", paginas: ["Comunicacao", "LeadsQualificados", "Vendedores", "Clientes", "Agenda", "Dashboard", "Produtos"] },
  atendente_vendas: { label: "💼 Atendente - Vendas", paginas: ["Comunicacao", "LeadsQualificados", "Clientes", "Produtos", "Agenda", "Dashboard"] },
  atendente_assistencia: { label: "🎧 Atendente - Assistência", paginas: ["Comunicacao", "Clientes", "Produtos", "Agenda", "Dashboard"] },
  personalizado: { label: "⚙️ Personalizado", paginas: [] }
};

// Permissões granulares
const PERMISSOES_COMUNICACAO = [
  { key: "pode_criar_contatos", label: "Criar Contatos", grupo: "Contatos" },
  { key: "pode_editar_contatos", label: "Editar Contatos", grupo: "Contatos" },
  { key: "pode_bloquear_contatos", label: "Bloquear Contatos", grupo: "Contatos" },
  { key: "pode_deletar_contatos", label: "Deletar Contatos", grupo: "Contatos" },
  { key: "pode_enviar_mensagens", label: "Enviar Mensagens", grupo: "Mensagens" },
  { key: "pode_enviar_midias", label: "Enviar Mídias", grupo: "Mensagens" },
  { key: "pode_enviar_audios", label: "Enviar Áudios", grupo: "Mensagens" },
  { key: "pode_apagar_mensagens", label: "Apagar Mensagens", grupo: "Mensagens" },
  { key: "pode_transferir_conversas", label: "Transferir Conversas", grupo: "Conversas" },
  { key: "pode_ver_todas_conversas", label: "Ver Todas Conversas", grupo: "Conversas" },
  { key: "pode_atribuir_conversas", label: "Atribuir Conversas", grupo: "Conversas" },
  { key: "pode_usar_templates", label: "Usar Templates", grupo: "Templates" },
  { key: "pode_criar_templates", label: "Criar Templates", grupo: "Templates" },
  { key: "pode_acessar_relatorios", label: "Acessar Relatórios", grupo: "Dados" },
  { key: "pode_exportar_conversas", label: "Exportar Conversas", grupo: "Dados" },
  { key: "pode_configurar_integracao", label: "Configurar Integração", grupo: "Admin" }
];

export default function GerenciadorUsuariosUnificado({ onNovoUsuario }) {
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);
  const [alteracoesPendentes, setAlteracoesPendentes] = useState(false);
  const [tabAtiva, setTabAtiva] = useState("paginas");

  // Carregar usuários
  const { data: usuarios = [], isLoading, refetch } = useQuery({
    queryKey: ['usuarios-unificado'],
    queryFn: () => base44.entities.User.list(),
  });

  // Carregar integrações WhatsApp
  const { data: integracoes = [] } = useQuery({
    queryKey: ['whatsapp-integracoes'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
  });

  // Filtrar usuários
  const usuariosFiltrados = usuarios.filter(u => 
    u.full_name?.toLowerCase().includes(busca.toLowerCase()) ||
    u.email?.toLowerCase().includes(busca.toLowerCase())
  );

  // Selecionar usuário
  const selecionarUsuario = (usuario) => {
    setUsuarioSelecionado({
      ...usuario,
      paginas_acesso: usuario.paginas_acesso || [],
      perfil_acesso: usuario.perfil_acesso || "",
      permissoes_comunicacao: usuario.permissoes_comunicacao || {},
      whatsapp_permissions: usuario.whatsapp_permissions || [],
      horario_atendimento: usuario.horario_atendimento || { inicio: "08:00", fim: "18:00", dias_semana: [1,2,3,4,5] }
    });
    setAlteracoesPendentes(false);
    setTabAtiva("paginas");
  };

  // Alterar campo do usuário
  const alterarCampo = (campo, valor) => {
    setUsuarioSelecionado(prev => ({ ...prev, [campo]: valor }));
    setAlteracoesPendentes(true);
  };

  // Alterar perfil de acesso
  const alterarPerfil = (perfilKey) => {
    const perfil = PERFIS_ACESSO[perfilKey];
    if (perfil) {
      setUsuarioSelecionado(prev => ({
        ...prev,
        perfil_acesso: perfilKey,
        paginas_acesso: perfilKey === 'personalizado' ? prev.paginas_acesso : perfil.paginas
      }));
      setAlteracoesPendentes(true);
    }
  };

  // Toggle página
  const togglePagina = (pagina) => {
    if (usuarioSelecionado?.role === 'admin') return;
    setUsuarioSelecionado(prev => {
      const novasPaginas = prev.paginas_acesso.includes(pagina)
        ? prev.paginas_acesso.filter(p => p !== pagina)
        : [...prev.paginas_acesso, pagina];
      return { ...prev, paginas_acesso: novasPaginas, perfil_acesso: 'personalizado' };
    });
    setAlteracoesPendentes(true);
  };

  // Toggle permissão
  const togglePermissao = (key) => {
    setUsuarioSelecionado(prev => ({
      ...prev,
      permissoes_comunicacao: { ...prev.permissoes_comunicacao, [key]: !prev.permissoes_comunicacao[key] }
    }));
    setAlteracoesPendentes(true);
  };

  // Toggle WhatsApp permission
  const toggleWhatsAppPerm = (integracaoId, tipo) => {
    setUsuarioSelecionado(prev => {
      const perms = [...(prev.whatsapp_permissions || [])];
      const idx = perms.findIndex(p => p.integration_id === integracaoId);
      if (idx >= 0) {
        perms[idx] = { ...perms[idx], [tipo]: !perms[idx][tipo] };
      } else {
        perms.push({ integration_id: integracaoId, [tipo]: true });
      }
      return { ...prev, whatsapp_permissions: perms };
    });
    setAlteracoesPendentes(true);
  };

  // Salvar
  const salvarAlteracoes = async () => {
    if (!usuarioSelecionado) return;
    setSaving(true);
    try {
      await base44.entities.User.update(usuarioSelecionado.id, {
        full_name: usuarioSelecionado.full_name,
        role: usuarioSelecionado.role,
        is_whatsapp_attendant: usuarioSelecionado.is_whatsapp_attendant,
        attendant_sector: usuarioSelecionado.attendant_sector,
        attendant_role: usuarioSelecionado.attendant_role,
        availability_status: usuarioSelecionado.availability_status,
        max_concurrent_conversations: usuarioSelecionado.max_concurrent_conversations,
        paginas_acesso: usuarioSelecionado.paginas_acesso,
        perfil_acesso: usuarioSelecionado.perfil_acesso,
        permissoes_comunicacao: usuarioSelecionado.permissoes_comunicacao,
        whatsapp_permissions: usuarioSelecionado.whatsapp_permissions,
        horario_atendimento: usuarioSelecionado.horario_atendimento
      });
      toast.success("✅ Usuário atualizado!");
      setAlteracoesPendentes(false);
      refetch();
    } catch (error) {
      toast.error("❌ Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)]">
      {/* COLUNA 1: USUÁRIOS */}
      <Card className="w-72 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Usuários
            </CardTitle>
            <Button size="sm" onClick={onNovoUsuario} className="h-7 px-2 bg-gradient-to-r from-amber-500 to-orange-500">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-7 h-8 text-xs" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <div className="p-2 space-y-1">
                {usuariosFiltrados.map((usuario) => (
                  <div
                    key={usuario.id}
                    onClick={() => selecionarUsuario(usuario)}
                    className={`p-2 rounded-lg cursor-pointer transition-all ${
                      usuarioSelecionado?.id === usuario.id
                        ? 'bg-gradient-to-r from-amber-100 to-orange-100 border-l-3 border-orange-500'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        usuario.role === 'admin' ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-slate-400'
                      }`}>
                        {usuario.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{usuario.full_name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{usuario.email}</p>
                      </div>
                    </div>
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {usuario.role === 'admin' && <Badge className="bg-red-100 text-red-700 text-[9px] h-4">Admin</Badge>}
                      {usuario.is_whatsapp_attendant && <Badge className="bg-green-100 text-green-700 text-[9px] h-4">Atendente</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* COLUNA 2 e 3: CONFIGURAÇÕES */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {usuarioSelecionado ? usuarioSelecionado.full_name : 'Selecione um usuário'}
            </CardTitle>
            {alteracoesPendentes && usuarioSelecionado && (
              <Button onClick={salvarAlteracoes} disabled={saving} size="sm" className="h-7 bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                Salvar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          {!usuarioSelecionado ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <User className="w-12 h-12 mb-2" />
              <p className="text-sm">Selecione um usuário para configurar</p>
            </div>
          ) : (
            <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="h-full flex flex-col">
              <TabsList className="mx-4 mt-2 grid grid-cols-4 h-8">
                <TabsTrigger value="paginas" className="text-xs h-7">Páginas</TabsTrigger>
                <TabsTrigger value="permissoes" className="text-xs h-7">Permissões</TabsTrigger>
                <TabsTrigger value="whatsapp" className="text-xs h-7">WhatsApp</TabsTrigger>
                <TabsTrigger value="dados" className="text-xs h-7">Dados</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 p-4">
                {/* TAB PÁGINAS */}
                <TabsContent value="paginas" className="mt-0 space-y-3">
                  <div>
                    <Label className="text-xs">Perfil de Acesso</Label>
                    <Select value={usuarioSelecionado.perfil_acesso || ""} onValueChange={alterarPerfil} disabled={usuarioSelecionado.role === 'admin'}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PERFIS_ACESSO).map(([key, perfil]) => (
                          <SelectItem key={key} value={key} className="text-xs">{perfil.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {usuarioSelecionado.role === 'admin' && (
                    <div className="p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800">
                      ⚠️ Administradores têm acesso a todas as páginas
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {PAGINAS_DISPONIVEIS.map((pagina) => {
                      const IconComponent = pagina.icon;
                      const temAcesso = usuarioSelecionado.role === 'admin' || usuarioSelecionado.paginas_acesso?.includes(pagina.page);
                      return (
                        <div
                          key={pagina.page}
                          onClick={() => togglePagina(pagina.page)}
                          className={`p-2 rounded border cursor-pointer transition-all flex items-center gap-2 ${
                            temAcesso ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'
                          } ${usuarioSelecionado.role === 'admin' ? 'cursor-not-allowed opacity-70' : ''}`}
                        >
                          <div className={`p-1 rounded ${temAcesso ? 'bg-green-500' : 'bg-slate-300'}`}>
                            <IconComponent className="w-3 h-3 text-white" />
                          </div>
                          <span className={`text-xs ${temAcesso ? 'text-green-800' : 'text-slate-500'}`}>{pagina.name}</span>
                          {temAcesso && <CheckCircle2 className="w-3 h-3 text-green-600 ml-auto" />}
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* TAB PERMISSÕES */}
                <TabsContent value="permissoes" className="mt-0 space-y-3">
                  <div className="p-2 bg-blue-50 rounded border border-blue-200 text-xs text-blue-800">
                    Permissões da Central de Comunicação
                  </div>
                  
                  {["Contatos", "Mensagens", "Conversas", "Templates", "Dados", "Admin"].map(grupo => (
                    <div key={grupo}>
                      <p className="text-xs font-semibold text-slate-600 mb-1">{grupo}</p>
                      <div className="space-y-1">
                        {PERMISSOES_COMUNICACAO.filter(p => p.grupo === grupo).map(perm => (
                          <div key={perm.key} className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-xs">{perm.label}</span>
                            <Switch
                              checked={usuarioSelecionado.permissoes_comunicacao?.[perm.key] || false}
                              onCheckedChange={() => togglePermissao(perm.key)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </TabsContent>

                {/* TAB WHATSAPP */}
                <TabsContent value="whatsapp" className="mt-0 space-y-3">
                  <div className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                    <div>
                      <p className="text-xs font-medium">Atendente WhatsApp</p>
                      <p className="text-[10px] text-slate-500">Recebe conversas</p>
                    </div>
                    <Switch
                      checked={usuarioSelecionado.is_whatsapp_attendant || false}
                      onCheckedChange={(v) => alterarCampo('is_whatsapp_attendant', v)}
                    />
                  </div>

                  {usuarioSelecionado.is_whatsapp_attendant && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Setor</Label>
                          <Select value={usuarioSelecionado.attendant_sector || "geral"} onValueChange={(v) => alterarCampo('attendant_sector', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vendas">Vendas</SelectItem>
                              <SelectItem value="assistencia">Assistência</SelectItem>
                              <SelectItem value="financeiro">Financeiro</SelectItem>
                              <SelectItem value="fornecedor">Fornecedor</SelectItem>
                              <SelectItem value="geral">Geral</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Função</Label>
                          <Select value={usuarioSelecionado.attendant_role || "pleno"} onValueChange={(v) => alterarCampo('attendant_role', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="junior">Júnior</SelectItem>
                              <SelectItem value="pleno">Pleno</SelectItem>
                              <SelectItem value="senior">Sênior</SelectItem>
                              <SelectItem value="coordenador">Coordenador</SelectItem>
                              <SelectItem value="gerente">Gerente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Máx. Conversas Simultâneas</Label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={usuarioSelecionado.max_concurrent_conversations || 5}
                          onChange={(e) => alterarCampo('max_concurrent_conversations', parseInt(e.target.value))}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                    </>
                  )}

                  {integracoes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-2">Permissões por Canal</p>
                      {integracoes.map((integracao) => {
                        const perm = usuarioSelecionado.whatsapp_permissions?.find(p => p.integration_id === integracao.id) || {};
                        return (
                          <div key={integracao.id} className="p-2 bg-white rounded border mb-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Phone className="w-4 h-4 text-green-600" />
                              <div>
                                <p className="text-xs font-medium">{integracao.nome_instancia}</p>
                                <p className="text-[10px] text-slate-500">{integracao.numero_telefone}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              {["can_view", "can_receive", "can_send"].map(tipo => (
                                <div key={tipo} className="flex items-center justify-between bg-slate-50 p-1 rounded text-[10px]">
                                  <span>{tipo === 'can_view' ? 'Ver' : tipo === 'can_receive' ? 'Receber' : 'Enviar'}</span>
                                  <Switch checked={perm[tipo] || false} onCheckedChange={() => toggleWhatsAppPerm(integracao.id, tipo)} />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* TAB DADOS */}
                <TabsContent value="dados" className="mt-0 space-y-3">
                  <div>
                    <Label className="text-xs">Nome Completo</Label>
                    <Input
                      value={usuarioSelecionado.full_name || ""}
                      onChange={(e) => alterarCampo('full_name', e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">E-mail</Label>
                    <Input value={usuarioSelecionado.email || ""} disabled className="h-8 text-xs mt-1 bg-slate-100" />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de Acesso</Label>
                    <Select value={usuarioSelecionado.role || "user"} onValueChange={(v) => alterarCampo('role', v)}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">👑 Administrador</SelectItem>
                        <SelectItem value="user">👤 Usuário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <Label className="text-xs">Horário de Atendimento</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <Input
                        type="time"
                        value={usuarioSelecionado.horario_atendimento?.inicio || "08:00"}
                        onChange={(e) => alterarCampo('horario_atendimento', { ...usuarioSelecionado.horario_atendimento, inicio: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="time"
                        value={usuarioSelecionado.horario_atendimento?.fim || "18:00"}
                        onChange={(e) => alterarCampo('horario_atendimento', { ...usuarioSelecionado.horario_atendimento, fim: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Dias da Semana</Label>
                    <div className="flex gap-1 mt-1">
                      {diasSemana.map((dia, idx) => {
                        const ativo = usuarioSelecionado.horario_atendimento?.dias_semana?.includes(idx);
                        return (
                          <Button
                            key={idx}
                            type="button"
                            size="sm"
                            variant={ativo ? "default" : "outline"}
                            className={`h-6 w-8 text-[10px] p-0 ${ativo ? 'bg-green-600' : ''}`}
                            onClick={() => {
                              const dias = usuarioSelecionado.horario_atendimento?.dias_semana || [];
                              const novosDias = dias.includes(idx) ? dias.filter(d => d !== idx) : [...dias, idx].sort();
                              alterarCampo('horario_atendimento', { ...usuarioSelecionado.horario_atendimento, dias_semana: novosDias });
                            }}
                          >
                            {dia}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}