// components/usuarios/GerenciadorUsuariosUnificado.jsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Save, User, Shield, Settings, ChevronRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import debounce from "lodash/debounce";

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE RECURSOS DO SISTEMA
// ══════════════════════════════════════════════════════════════════════════════
const RECURSOS_SISTEMA = [
  {
    id: "dados_usuario",
    nome: "📝 Dados do Usuário",
    tipo: "config",
    description: "Nome, e-mail, setor, função e status do usuário."
  },
  {
    id: "Comunicacao",
    nome: "💬 Central de Comunicação",
    tipo: "menu",
    categoria: "Comunicação",
    description: "WhatsApp e canais de atendimento.",
    acoes: [
      { id: "Comunicacao.conversas", nome: "Ver Conversas", tipo: "subtela" },
      { id: "Comunicacao.conversas.enviar", nome: "Enviar Mensagens", tipo: "acao" },
      { id: "Comunicacao.conversas.midia", nome: "Enviar Mídia", tipo: "acao" },
      { id: "Comunicacao.conversas.transferir", nome: "Transferir Conversa", tipo: "acao" },
      { id: "Comunicacao.conversas.ver_todas", nome: "Ver Todas (Supervisão)", tipo: "acao" },
      { id: "Comunicacao.controle", nome: "Controle Operacional", tipo: "subtela" },
      { id: "Comunicacao.automacao", nome: "Automação", tipo: "subtela" },
      { id: "Comunicacao.config", nome: "Configurações WhatsApp", tipo: "subtela" },
    ]
  },
  {
    id: "Dashboard",
    nome: "📊 Dashboard",
    tipo: "menu",
    categoria: "Geral",
    description: "Visão geral e KPIs.",
    acoes: [
      { id: "Dashboard.filtrar", nome: "Filtrar Dados", tipo: "acao" },
      { id: "Dashboard.exportar", nome: "Exportar", tipo: "acao" },
    ]
  },
  {
    id: "LeadsQualificados",
    nome: "🎯 Leads & Qualificação",
    tipo: "menu",
    categoria: "Vendas",
    description: "Funil de leads e orçamentos.",
    acoes: [
      { id: "LeadsQualificados.kanban_leads", nome: "Kanban Leads", tipo: "subtela" },
      { id: "LeadsQualificados.kanban_clientes", nome: "Kanban Clientes", tipo: "subtela" },
      { id: "LeadsQualificados.orcamentos", nome: "Pipeline Orçamentos", tipo: "subtela" },
    ]
  },
  {
    id: "Clientes",
    nome: "🏢 Clientes",
    tipo: "menu",
    categoria: "CRM",
    description: "Gestão de clientes.",
    acoes: [
      { id: "Clientes.novo", nome: "Criar Cliente", tipo: "acao" },
      { id: "Clientes.editar", nome: "Editar Cliente", tipo: "acao" },
      { id: "Clientes.excluir", nome: "Excluir Cliente", tipo: "acao" },
    ]
  },
  {
    id: "Vendedores",
    nome: "👥 Vendedores",
    tipo: "menu",
    categoria: "Vendas",
    description: "Equipe de vendas.",
    acoes: [
      { id: "Vendedores.novo", nome: "Criar Vendedor", tipo: "acao" },
      { id: "Vendedores.editar", nome: "Editar Vendedor", tipo: "acao" },
      { id: "Vendedores.excluir", nome: "Excluir Vendedor", tipo: "acao" },
    ]
  },
  {
    id: "Produtos",
    nome: "📦 Produtos",
    tipo: "menu",
    categoria: "Catálogo",
    description: "Catálogo de produtos.",
    acoes: [
      { id: "Produtos.novo", nome: "Criar Produto", tipo: "acao" },
      { id: "Produtos.editar", nome: "Editar Produto", tipo: "acao" },
      { id: "Produtos.excluir", nome: "Excluir Produto", tipo: "acao" },
    ]
  },
  { id: "Agenda", nome: "📅 Agenda", tipo: "menu", categoria: "Geral", description: "Tarefas inteligentes." },
  { id: "AnalyticsAvancado", nome: "📈 Analytics", tipo: "menu", categoria: "Relatórios", description: "Análises avançadas." },
  { id: "Importacao", nome: "📥 Importação", tipo: "menu", categoria: "Dados", description: "Importar dados." },
  { id: "Usuarios", nome: "👤 Usuários", tipo: "menu", categoria: "Admin", description: "Gerenciar usuários." },
  { id: "Auditoria", nome: "🔒 Auditoria", tipo: "menu", categoria: "Admin", description: "Logs do sistema." },
];

const PERFIS_RAPIDOS = {
  admin: { label: "👑 Admin Total", permissoes: RECURSOS_SISTEMA.flatMap(r => [r.id, ...(r.acoes || []).map(a => a.id)]) },
  gerente: { label: "👔 Gerente", permissoes: ["Comunicacao", "Dashboard", "LeadsQualificados", "Clientes", "Vendedores", "Produtos", "Agenda", "AnalyticsAvancado"] },
  vendedor: { label: "💼 Vendedor", permissoes: ["Comunicacao", "Dashboard", "LeadsQualificados", "Clientes", "Produtos", "Agenda"] },
  suporte: { label: "🎧 Suporte", permissoes: ["Comunicacao", "Clientes", "Agenda"] },
};

const SETORES = [
  { value: "vendas", label: "Vendas" },
  { value: "assistencia", label: "Assistência" },
  { value: "financeiro", label: "Financeiro" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "geral", label: "Geral" },
];

const FUNCOES = [
  { value: "junior", label: "Júnior" },
  { value: "pleno", label: "Pleno" },
  { value: "senior", label: "Sênior" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gerente", label: "Gerente" },
];

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function GerenciadorUsuariosUnificado({
  carregarUsuarios,
  salvarUsuario,
  salvarPermissoes,
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [recursoSelecionado, setRecursoSelecionado] = useState(RECURSOS_SISTEMA[0]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Carregar usuários
  useEffect(() => {
    if (!carregarUsuarios) return;
    let ativo = true;
    (async () => {
      setCarregando(true);
      try {
        const lista = await carregarUsuarios();
        if (ativo) setUsuarios(lista || []);
      } catch (e) {
        console.error("Erro ao carregar:", e);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [carregarUsuarios]);

  // Auto-save com debounce
  const salvarAutomatico = useCallback(
    debounce(async (usuario) => {
      if (!usuario || !salvarUsuario) return;
      setSalvando(true);
      try {
        const atualizado = await salvarUsuario(usuario);
        setUsuarios(prev => prev.map(u => u.id === atualizado.id ? atualizado : u));
        toast.success("Salvo automaticamente", { duration: 1500 });
      } catch (e) {
        toast.error("Erro ao salvar");
      } finally {
        setSalvando(false);
      }
    }, 1000),
    [salvarUsuario]
  );

  // Atualizar campo do usuário
  const atualizarUsuario = (campo, valor) => {
    if (!usuarioSelecionado) return;
    const atualizado = { ...usuarioSelecionado, [campo]: valor };
    setUsuarioSelecionado(atualizado);
    setUsuarios(prev => prev.map(u => u.id === atualizado.id ? atualizado : u));
    salvarAutomatico(atualizado);
  };

  // Toggle permissão
  const togglePermissao = (permId) => {
    if (!usuarioSelecionado) return;
    const perms = usuarioSelecionado.permissoes || [];
    const novasPerms = perms.includes(permId)
      ? perms.filter(p => p !== permId)
      : [...perms, permId];
    atualizarUsuario("permissoes", novasPerms);
  };

  // Aplicar perfil
  const aplicarPerfil = (perfilKey) => {
    const perfil = PERFIS_RAPIDOS[perfilKey];
    if (!perfil || !usuarioSelecionado) return;
    atualizarUsuario("permissoes", [...perfil.permissoes]);
    toast.success(`Perfil "${perfil.label}" aplicado`);
  };

  // Novo usuário
  const novoUsuario = () => {
    const novo = {
      id: `temp-${Date.now()}`,
      nome: "",
      email: "",
      setor: "geral",
      funcao: "pleno",
      tipoAcesso: "user",
      ativo: true,
      permissoes: [],
      isNovo: true,
    };
    setUsuarios(prev => [novo, ...prev]);
    setUsuarioSelecionado(novo);
    setRecursoSelecionado(RECURSOS_SISTEMA[0]);
  };

  // Filtrar usuários
  const usuariosFiltrados = useMemo(() => {
    if (!filtro) return usuarios;
    const t = filtro.toLowerCase();
    return usuarios.filter(u =>
      (u.nome && u.nome.toLowerCase().includes(t)) ||
      (u.email && u.email.toLowerCase().includes(t))
    );
  }, [usuarios, filtro]);

  const temPermissao = (permId) => (usuarioSelecionado?.permissoes || []).includes(permId);

  return (
    <div className="flex h-[calc(100vh-140px)] gap-3">
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* COLUNA 1: LISTA DE USUÁRIOS */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section className="w-64 flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
        <header className="p-3 border-b bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800">Usuários</h2>
            <Button size="sm" variant="outline" onClick={novoUsuario} className="h-7 px-2">
              <Plus className="w-3 h-3 mr-1" /> Novo
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input
              placeholder="Buscar..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {carregando ? (
            <div className="p-4 text-center text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
              Carregando...
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">Nenhum usuário</div>
          ) : (
            <ul>
              {usuariosFiltrados.map(u => (
                <li
                  key={u.id}
                  onClick={() => { setUsuarioSelecionado(u); setRecursoSelecionado(RECURSOS_SISTEMA[0]); }}
                  className={`px-3 py-2 cursor-pointer border-b text-xs transition-colors ${
                    usuarioSelecionado?.id === u.id
                      ? "bg-indigo-50 border-l-2 border-l-indigo-500"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 truncate">{u.nome || "(sem nome)"}</span>
                    <Badge variant={u.ativo ? "default" : "secondary"} className="text-[9px] px-1.5 py-0">
                      {u.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{u.email}</div>
                  {u.setor && <div className="text-[10px] text-slate-400">{u.setor} • {u.funcao}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* COLUNA 2: RECURSOS DO SISTEMA */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section className="w-72 flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
        <header className="p-3 border-b bg-gradient-to-r from-slate-50 to-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Recursos & Páginas</h2>
          <p className="text-[10px] text-slate-500">Selecione para configurar</p>
        </header>

        <div className="flex-1 overflow-auto p-2 space-y-1">
          {RECURSOS_SISTEMA.map(recurso => {
            const selecionado = recursoSelecionado?.id === recurso.id;
            const temAcessoMenu = temPermissao(recurso.id);
            
            return (
              <button
                key={recurso.id}
                onClick={() => setRecursoSelecionado(recurso)}
                disabled={!usuarioSelecionado}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                  selecionado
                    ? "bg-indigo-100 border border-indigo-300"
                    : "hover:bg-slate-50 border border-transparent"
                } ${!usuarioSelecionado ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{recurso.nome}</span>
                    {recurso.tipo === "config" && <Settings className="w-3 h-3 text-slate-400" />}
                    {recurso.tipo === "menu" && temAcessoMenu && (
                      <Check className="w-3 h-3 text-green-600" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">{recurso.description}</div>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${selecionado ? "rotate-90" : ""}`} />
              </button>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* COLUNA 3: DETALHES / PERMISSÕES / DADOS */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section className="flex-1 flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
        <header className="p-3 border-b bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {recursoSelecionado?.nome || "Detalhes"}
            </h2>
            <p className="text-[10px] text-slate-500">
              {recursoSelecionado?.description || "Selecione um recurso"}
            </p>
          </div>
          {salvando && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              Salvando...
            </div>
          )}
        </header>

        {!usuarioSelecionado ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            <User className="w-8 h-8 mr-2 opacity-50" />
            Selecione um usuário para começar
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* DADOS DO USUÁRIO (config) */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {recursoSelecionado?.tipo === "config" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">Nome Completo</label>
                    <Input
                      value={usuarioSelecionado.nome || ""}
                      onChange={(e) => atualizarUsuario("nome", e.target.value)}
                      placeholder="Nome do usuário"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">E-mail</label>
                    <Input
                      value={usuarioSelecionado.email || ""}
                      onChange={(e) => atualizarUsuario("email", e.target.value)}
                      placeholder="email@empresa.com"
                      className="h-9"
                      disabled={!usuarioSelecionado.isNovo}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">Setor</label>
                    <Select value={usuarioSelecionado.setor || "geral"} onValueChange={(v) => atualizarUsuario("setor", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SETORES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">Função</label>
                    <Select value={usuarioSelecionado.funcao || "pleno"} onValueChange={(v) => atualizarUsuario("funcao", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FUNCOES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">Tipo de Acesso</label>
                    <Select value={usuarioSelecionado.tipoAcesso || "user"} onValueChange={(v) => atualizarUsuario("tipoAcesso", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="user">Usuário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Status do Usuário</p>
                    <p className="text-xs text-slate-500">Usuários inativos não podem acessar o sistema</p>
                  </div>
                  <Switch
                    checked={usuarioSelecionado.ativo !== false}
                    onCheckedChange={(v) => atualizarUsuario("ativo", v)}
                  />
                </div>

                {/* Perfis Rápidos */}
                <div className="pt-4 border-t">
                  <h3 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Aplicar Perfil Rápido
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(PERFIS_RAPIDOS).map(([key, perfil]) => (
                      <Button
                        key={key}
                        size="sm"
                        variant="outline"
                        onClick={() => aplicarPerfil(key)}
                        className="h-7 text-xs"
                      >
                        {perfil.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* PERMISSÕES DO MENU (menu) */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {recursoSelecionado?.tipo === "menu" && (
              <div className="space-y-4">
                {/* Acesso ao Menu Principal */}
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                  <div>
                    <p className="text-sm font-bold text-indigo-800">{recursoSelecionado.nome}</p>
                    <p className="text-xs text-indigo-600">Acesso à página principal</p>
                  </div>
                  <Switch
                    checked={temPermissao(recursoSelecionado.id)}
                    onCheckedChange={() => togglePermissao(recursoSelecionado.id)}
                  />
                </div>

                {/* Ações/Subtelas */}
                {recursoSelecionado.acoes && recursoSelecionado.acoes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700">Permissões Granulares</h4>
                    {recursoSelecionado.acoes.map(acao => (
                      <label
                        key={acao.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={temPermissao(acao.id)}
                          onCheckedChange={() => togglePermissao(acao.id)}
                          disabled={!temPermissao(recursoSelecionado.id)}
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-800">{acao.nome}</span>
                          <Badge variant="outline" className="ml-2 text-[9px]">{acao.tipo}</Badge>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Resumo */}
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                  <strong>Resumo:</strong> {(usuarioSelecionado.permissoes || []).filter(p => 
                    p === recursoSelecionado.id || (recursoSelecionado.acoes || []).some(a => a.id === p)
                  ).length} permissões ativas neste recurso
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}