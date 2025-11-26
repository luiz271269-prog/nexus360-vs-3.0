import React, { useState, useEffect } from "react";
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
import { 
  User, Shield, MessageSquare, Clock, BarChart3, CheckCircle2, XCircle, 
  AlertCircle, Users, FileText, Phone, Home, Target, Building2, Package, 
  Calendar, Brain, Upload, UserCog, Bug, Search, Save, Loader2, 
  ChevronRight, Settings, Eye, Send, Trash2, Forward, UserCheck
} from "lucide-react";
import { toast } from "sonner";

// Definição das páginas disponíveis
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
  gerencia_assistencia: { label: "🔧 Gerência - Assistência", paginas: ["Comunicacao", "Clientes", "Agenda", "Dashboard", "Produtos", "AnalyticsAvancado"] },
  supervisor_vendas: { label: "👔 Supervisor - Vendas", paginas: ["Comunicacao", "LeadsQualificados", "Vendedores", "Clientes", "Agenda", "Dashboard", "Produtos"] },
  supervisor_compras: { label: "📋 Supervisor - Compras", paginas: ["Comunicacao", "Produtos", "Importacao", "Agenda", "Dashboard"] },
  supervisor_assistencia: { label: "🛠️ Supervisor - Assistência", paginas: ["Comunicacao", "Clientes", "Agenda", "Dashboard", "Produtos"] },
  atendente_vendas: { label: "💼 Atendente - Vendas", paginas: ["Comunicacao", "LeadsQualificados", "Clientes", "Produtos", "Agenda", "Dashboard"] },
  atendente_compras: { label: "🛒 Atendente - Compras", paginas: ["Comunicacao", "Produtos", "Clientes", "Agenda", "Dashboard"] },
  atendente_assistencia: { label: "🎧 Atendente - Assistência", paginas: ["Comunicacao", "Clientes", "Produtos", "Agenda", "Dashboard"] },
  personalizado: { label: "⚙️ Personalizado", paginas: [] }
};

// Permissões granulares por página
const PERMISSOES_POR_PAGINA = {
  Comunicacao: {
    titulo: "Permissões da Central de Comunicação",
    grupos: [
      {
        nome: "Gestão de Contatos",
        icon: Users,
        permissoes: [
          { key: "pode_criar_contatos", label: "Criar Contatos", desc: "Adicionar novos contatos ao sistema" },
          { key: "pode_editar_contatos", label: "Editar Contatos", desc: "Modificar dados de contatos existentes" },
          { key: "pode_bloquear_contatos", label: "Bloquear Contatos", desc: "Bloquear/desbloquear contatos" },
          { key: "pode_deletar_contatos", label: "Deletar Contatos", desc: "Remover contatos permanentemente" }
        ]
      },
      {
        nome: "Envio de Mensagens",
        icon: Send,
        permissoes: [
          { key: "pode_enviar_mensagens", label: "Enviar Mensagens de Texto", desc: "Enviar mensagens de texto" },
          { key: "pode_enviar_midias", label: "Enviar Mídias", desc: "Anexar imagens, vídeos e documentos" },
          { key: "pode_enviar_audios", label: "Enviar Áudios", desc: "Gravar e enviar mensagens de voz" },
          { key: "pode_encaminhar_mensagens", label: "Encaminhar Mensagens", desc: "Encaminhar mensagens para outros" },
          { key: "pode_apagar_mensagens", label: "Apagar Mensagens", desc: "Apagar mensagens enviadas" }
        ]
      },
      {
        nome: "Gestão de Conversas",
        icon: MessageSquare,
        permissoes: [
          { key: "pode_transferir_conversas", label: "Transferir Conversas", desc: "Transferir para outros atendentes" },
          { key: "pode_ver_todas_conversas", label: "Ver Todas as Conversas", desc: "Acessar conversas de outros atendentes" },
          { key: "pode_atribuir_conversas", label: "Atribuir Conversas", desc: "Atribuir conversas não atribuídas" }
        ]
      },
      {
        nome: "Templates e Respostas",
        icon: FileText,
        permissoes: [
          { key: "pode_usar_templates", label: "Usar Templates", desc: "Utilizar templates aprovados" },
          { key: "pode_criar_templates", label: "Criar Templates", desc: "Criar novos templates" },
          { key: "pode_usar_respostas_rapidas", label: "Usar Respostas Rápidas", desc: "Utilizar respostas rápidas" },
          { key: "pode_criar_respostas_rapidas", label: "Criar Respostas Rápidas", desc: "Criar novas respostas rápidas" }
        ]
      },
      {
        nome: "Dados e Relatórios",
        icon: BarChart3,
        permissoes: [
          { key: "pode_ver_historico_completo", label: "Ver Histórico Completo", desc: "Acessar todo o histórico" },
          { key: "pode_exportar_conversas", label: "Exportar Conversas", desc: "Baixar conversas em PDF/CSV" },
          { key: "pode_acessar_relatorios", label: "Acessar Relatórios", desc: "Ver relatórios e analytics" }
        ]
      },
      {
        nome: "Configurações Avançadas",
        icon: Settings,
        permissoes: [
          { key: "pode_configurar_integracao", label: "Configurar Integração", desc: "Gerenciar integrações WhatsApp" }
        ]
      }
    ]
  }
};

export default function GerenciadorPermissoes3Colunas() {
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [paginaSelecionada, setPaginaSelecionada] = useState(null);
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);
  const [alteracoesPendentes, setAlteracoesPendentes] = useState({});

  // Carregar usuários
  const { data: usuarios = [], isLoading, refetch } = useQuery({
    queryKey: ['usuarios-permissoes'],
    queryFn: () => base44.entities.User.list(),
  });

  // Carregar integrações WhatsApp
  const { data: integracoes = [] } = useQuery({
    queryKey: ['whatsapp-integracoes'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
  });

  // Filtrar usuários por busca
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
      whatsapp_permissions: usuario.whatsapp_permissions || []
    });
    setPaginaSelecionada(null);
    setAlteracoesPendentes({});
  };

  // Alterar perfil de acesso
  const alterarPerfil = (perfilKey) => {
    if (!usuarioSelecionado) return;
    const perfil = PERFIS_ACESSO[perfilKey];
    if (perfil) {
      setUsuarioSelecionado(prev => ({
        ...prev,
        perfil_acesso: perfilKey,
        paginas_acesso: perfilKey === 'personalizado' ? prev.paginas_acesso : perfil.paginas
      }));
      setAlteracoesPendentes(prev => ({ ...prev, perfil: true }));
    }
  };

  // Toggle página
  const togglePagina = (pagina) => {
    if (!usuarioSelecionado || usuarioSelecionado.role === 'admin') return;
    setUsuarioSelecionado(prev => {
      const novasPaginas = prev.paginas_acesso.includes(pagina)
        ? prev.paginas_acesso.filter(p => p !== pagina)
        : [...prev.paginas_acesso, pagina];
      return {
        ...prev,
        paginas_acesso: novasPaginas,
        perfil_acesso: 'personalizado'
      };
    });
    setAlteracoesPendentes(prev => ({ ...prev, paginas: true }));
  };

  // Toggle permissão granular
  const togglePermissao = (key) => {
    if (!usuarioSelecionado) return;
    setUsuarioSelecionado(prev => ({
      ...prev,
      permissoes_comunicacao: {
        ...prev.permissoes_comunicacao,
        [key]: !prev.permissoes_comunicacao[key]
      }
    }));
    setAlteracoesPendentes(prev => ({ ...prev, permissoes: true }));
  };

  // Toggle permissão WhatsApp por instância
  const toggleWhatsAppPermission = (integracaoId, tipo) => {
    if (!usuarioSelecionado) return;
    setUsuarioSelecionado(prev => {
      const permissoes = [...(prev.whatsapp_permissions || [])];
      const idx = permissoes.findIndex(p => p.integration_id === integracaoId);
      
      if (idx >= 0) {
        permissoes[idx] = { ...permissoes[idx], [tipo]: !permissoes[idx][tipo] };
      } else {
        permissoes.push({ integration_id: integracaoId, [tipo]: true });
      }
      
      return { ...prev, whatsapp_permissions: permissoes };
    });
    setAlteracoesPendentes(prev => ({ ...prev, whatsapp: true }));
  };

  // Salvar alterações
  const salvarAlteracoes = async () => {
    if (!usuarioSelecionado) return;
    setSaving(true);
    try {
      await base44.entities.User.update(usuarioSelecionado.id, {
        paginas_acesso: usuarioSelecionado.paginas_acesso,
        perfil_acesso: usuarioSelecionado.perfil_acesso,
        permissoes_comunicacao: usuarioSelecionado.permissoes_comunicacao,
        whatsapp_permissions: usuarioSelecionado.whatsapp_permissions
      });
      toast.success("✅ Permissões salvas com sucesso!");
      setAlteracoesPendentes({});
      refetch();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("❌ Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const temAlteracoes = Object.keys(alteracoesPendentes).length > 0;

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* COLUNA 1: USUÁRIOS */}
      <Card className="w-80 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Usuários
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar usuário..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {usuariosFiltrados.map((usuario) => (
                  <div
                    key={usuario.id}
                    onClick={() => selecionarUsuario(usuario)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      usuarioSelecionado?.id === usuario.id
                        ? 'bg-gradient-to-r from-amber-100 to-orange-100 border-l-4 border-orange-500'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        usuario.role === 'admin' 
                          ? 'bg-gradient-to-br from-red-500 to-orange-500' 
                          : 'bg-gradient-to-br from-slate-400 to-slate-500'
                      }`}>
                        {usuario.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{usuario.full_name}</p>
                        <p className="text-xs text-slate-500 truncate">{usuario.email}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${
                        usuarioSelecionado?.id === usuario.id ? 'rotate-90' : ''
                      }`} />
                    </div>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {usuario.role === 'admin' && (
                        <Badge className="bg-red-100 text-red-700 text-[10px]">Admin</Badge>
                      )}
                      {usuario.is_whatsapp_attendant && (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">Atendente</Badge>
                      )}
                      {usuario.attendant_sector && usuario.attendant_sector !== 'geral' && (
                        <Badge variant="outline" className="text-[10px]">{usuario.attendant_sector}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* COLUNA 2: TELAS */}
      <Card className="w-80 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Telas de Acesso
          </CardTitle>
          {usuarioSelecionado && (
            <Select
              value={usuarioSelecionado.perfil_acesso || ""}
              onValueChange={alterarPerfil}
              disabled={usuarioSelecionado.role === 'admin'}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione um perfil..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERFIS_ACESSO).map(([key, perfil]) => (
                  <SelectItem key={key} value={key}>{perfil.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {!usuarioSelecionado ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                <User className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Selecione um usuário para configurar as telas</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {usuarioSelecionado.role === 'admin' && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-600" />
                      <p className="text-xs text-amber-800 font-medium">Administradores têm acesso a todas as telas</p>
                    </div>
                  </div>
                )}
                {PAGINAS_DISPONIVEIS.map((pagina) => {
                  const IconComponent = pagina.icon;
                  const temAcesso = usuarioSelecionado.role === 'admin' || 
                    usuarioSelecionado.paginas_acesso?.includes(pagina.page);
                  const isSelecionada = paginaSelecionada === pagina.page;
                  
                  return (
                    <div
                      key={pagina.page}
                      className={`p-3 rounded-lg transition-all ${
                        isSelecionada
                          ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-l-4 border-blue-500'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={temAcesso}
                          onCheckedChange={() => togglePagina(pagina.page)}
                          disabled={usuarioSelecionado.role === 'admin'}
                        />
                        <div 
                          className="flex-1 flex items-center gap-2 cursor-pointer"
                          onClick={() => setPaginaSelecionada(pagina.page)}
                        >
                          <div className={`p-1.5 rounded ${temAcesso ? 'bg-green-500' : 'bg-slate-300'}`}>
                            <IconComponent className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${!temAcesso && 'text-slate-400'}`}>
                              {pagina.name}
                            </p>
                            <p className="text-[10px] text-slate-400">{pagina.categoria}</p>
                          </div>
                        </div>
                        {PERMISSOES_POR_PAGINA[pagina.page] && (
                          <ChevronRight 
                            className={`w-4 h-4 text-slate-400 cursor-pointer transition-transform ${
                              isSelecionada ? 'rotate-90' : ''
                            }`}
                            onClick={() => setPaginaSelecionada(isSelecionada ? null : pagina.page)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* COLUNA 3: REGRAS/PERMISSÕES */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Regras e Permissões
            </CardTitle>
            {temAlteracoes && usuarioSelecionado && (
              <Button 
                onClick={salvarAlteracoes} 
                disabled={saving}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Alterações
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {!usuarioSelecionado ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                <Settings className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Selecione um usuário para ver as permissões</p>
              </div>
            ) : !paginaSelecionada ? (
              <div className="p-4 space-y-4">
                {/* Resumo do usuário */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                      usuarioSelecionado.role === 'admin' 
                        ? 'bg-gradient-to-br from-red-500 to-orange-500' 
                        : 'bg-gradient-to-br from-slate-400 to-slate-500'
                    }`}>
                      {usuarioSelecionado.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold">{usuarioSelecionado.full_name}</p>
                      <p className="text-sm text-slate-500">{usuarioSelecionado.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white p-2 rounded">
                      <p className="text-slate-500 text-xs">Tipo</p>
                      <p className="font-medium">{usuarioSelecionado.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <p className="text-slate-500 text-xs">Perfil</p>
                      <p className="font-medium">{PERFIS_ACESSO[usuarioSelecionado.perfil_acesso]?.label || 'Não definido'}</p>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <p className="text-slate-500 text-xs">Páginas</p>
                      <p className="font-medium">{usuarioSelecionado.role === 'admin' ? 'Todas' : usuarioSelecionado.paginas_acesso?.length || 0}</p>
                    </div>
                    <div className="bg-white p-2 rounded">
                      <p className="text-slate-500 text-xs">Setor</p>
                      <p className="font-medium capitalize">{usuarioSelecionado.attendant_sector || 'Geral'}</p>
                    </div>
                  </div>
                </div>

                {/* Integrações WhatsApp */}
                {integracoes.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                      <Phone className="w-4 h-4" />
                      Permissões por Canal WhatsApp
                    </h4>
                    <div className="space-y-2">
                      {integracoes.map((integracao) => {
                        const perm = usuarioSelecionado.whatsapp_permissions?.find(
                          p => p.integration_id === integracao.id
                        ) || {};
                        return (
                          <div key={integracao.id} className="bg-white border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                <Phone className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{integracao.nome_instancia}</p>
                                <p className="text-xs text-slate-500">{integracao.numero_telefone}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="flex items-center justify-between bg-slate-50 p-2 rounded">
                                <span className="text-xs">Ver</span>
                                <Switch
                                  checked={perm.can_view || false}
                                  onCheckedChange={() => toggleWhatsAppPermission(integracao.id, 'can_view')}
                                />
                              </div>
                              <div className="flex items-center justify-between bg-slate-50 p-2 rounded">
                                <span className="text-xs">Receber</span>
                                <Switch
                                  checked={perm.can_receive || false}
                                  onCheckedChange={() => toggleWhatsAppPermission(integracao.id, 'can_receive')}
                                />
                              </div>
                              <div className="flex items-center justify-between bg-slate-50 p-2 rounded">
                                <span className="text-xs">Enviar</span>
                                <Switch
                                  checked={perm.can_send || false}
                                  onCheckedChange={() => toggleWhatsAppPermission(integracao.id, 'can_send')}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-center p-4 text-slate-500">
                  <p className="text-sm">Selecione uma tela na coluna ao lado para ver as permissões granulares</p>
                </div>
              </div>
            ) : PERMISSOES_POR_PAGINA[paginaSelecionada] ? (
              <div className="p-4 space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                  <h4 className="font-semibold text-blue-800">
                    {PERMISSOES_POR_PAGINA[paginaSelecionada].titulo}
                  </h4>
                </div>

                {PERMISSOES_POR_PAGINA[paginaSelecionada].grupos.map((grupo) => {
                  const GrupoIcon = grupo.icon;
                  return (
                    <div key={grupo.nome} className="bg-white border rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 border-b">
                        <GrupoIcon className="w-4 h-4 text-slate-600" />
                        <h5 className="font-medium text-sm text-slate-700">{grupo.nome}</h5>
                      </div>
                      <div className="divide-y">
                        {grupo.permissoes.map((perm) => (
                          <div 
                            key={perm.key}
                            className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{perm.label}</p>
                                {usuarioSelecionado.permissoes_comunicacao?.[perm.key] ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-slate-300" />
                                )}
                              </div>
                              <p className="text-xs text-slate-500">{perm.desc}</p>
                            </div>
                            <Switch
                              checked={usuarioSelecionado.permissoes_comunicacao?.[perm.key] || false}
                              onCheckedChange={() => togglePermissao(perm.key)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                <CheckCircle2 className="w-12 h-12 text-green-300 mb-3" />
                <p className="text-sm text-slate-500">Esta tela não possui permissões granulares específicas</p>
                <p className="text-xs text-slate-400 mt-1">O acesso é controlado apenas pela visibilidade da página</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}