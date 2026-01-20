import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Save, User, Shield, Settings, ChevronRight, Check, Loader2, Trash2, Zap, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import PainelPermissoesUnificado from "./PainelPermissoesUnificado";
import SecaoDadosUsuario from "./SecaoDadosUsuario";
import SecaoComunicacaoUsuario from "./SecaoComunicacaoUsuario";

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
      { id: "Comunicacao.conversas.ver_contato", nome: "Ver Detalhes Contato", tipo: "acao" },
      { id: "Comunicacao.conversas.editar_contato", nome: "Editar Contato", tipo: "acao" },
      { id: "Comunicacao.controle", nome: "Controle Operacional", tipo: "subtela" },
      { id: "Comunicacao.controle.gerenciar_filas", nome: "Gerenciar Filas", tipo: "acao" },
      { id: "Comunicacao.controle.reatribuir", nome: "Reatribuir Conversas", tipo: "acao" },
      { id: "Comunicacao.automacao", nome: "Automação", tipo: "subtela" },
      { id: "Comunicacao.automacao.criar", nome: "Criar Playbooks", tipo: "acao" },
      { id: "Comunicacao.automacao.editar", nome: "Editar Playbooks", tipo: "acao" },
      { id: "Comunicacao.config", nome: "Configurações WhatsApp", tipo: "subtela" },
      { id: "Comunicacao.config.conexoes", nome: "Gerenciar Conexões", tipo: "acao" },
    ]
  },
  {
    id: "Dashboard",
    nome: "📊 Dashboard Executivo",
    tipo: "menu",
    categoria: "Geral",
    description: "Visão geral e KPIs da empresa.",
    acoes: [
      { id: "Dashboard.visao_empresa", nome: "Visão Empresa", tipo: "subtela" },
      { id: "Dashboard.visao_empresa.ver_faturamento", nome: "Ver Faturamento", tipo: "acao" },
      { id: "Dashboard.visao_empresa.ver_metas", nome: "Ver Metas Globais", tipo: "acao" },
      { id: "Dashboard.analytics_avancado", nome: "Analytics Avançado", tipo: "subtela" },
      { id: "Dashboard.analytics_avancado.relatorios", nome: "Ver Relatórios", tipo: "acao" },
      { id: "Dashboard.analytics_avancado.graficos", nome: "Ver Gráficos", tipo: "acao" },
      { id: "Dashboard.analytics_avancado.configurar", nome: "Configurar Métricas", tipo: "acao" },
      { id: "Dashboard.performance_vendas", nome: "Performance Vendas", tipo: "subtela" },
      { id: "Dashboard.performance_vendas.ranking", nome: "Ver Ranking Vendedores", tipo: "acao" },
      { id: "Dashboard.performance_vendas.detalhes_vendedor", nome: "Acessar Detalhes Vendedor", tipo: "acao" },
      { id: "Dashboard.analise_clientes", nome: "Análise Clientes", tipo: "subtela" },
      { id: "Dashboard.analise_clientes.curva_abc", nome: "Ver Curva ABC", tipo: "acao" },
      { id: "Dashboard.analise_clientes.detalhes_cliente", nome: "Acessar Detalhes Cliente", tipo: "acao" },
      { id: "Dashboard.metricas_operacionais", nome: "Métricas Operacionais", tipo: "subtela" },
      { id: "Dashboard.metricas_operacionais.tempo_resposta", nome: "Ver Tempo Resposta", tipo: "acao" },
      { id: "Dashboard.metricas_operacionais.taxa_conversao", nome: "Ver Taxa Conversão", tipo: "acao" },
      { id: "Dashboard.filtrar", nome: "Filtrar Dados", tipo: "acao" },
      { id: "Dashboard.exportar", nome: "Exportar Relatórios", tipo: "acao" },
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
      { id: "LeadsQualificados.kanban_leads.mover", nome: "Mover Cards", tipo: "acao" },
      { id: "LeadsQualificados.kanban_leads.ver_detalhes", nome: "Ver Detalhes Lead", tipo: "acao" },
      { id: "LeadsQualificados.kanban_clientes", nome: "Kanban Clientes", tipo: "subtela" },
      { id: "LeadsQualificados.kanban_clientes.mover", nome: "Mover Cards", tipo: "acao" },
      { id: "LeadsQualificados.orcamentos", nome: "Pipeline Orçamentos", tipo: "subtela" },
      { id: "LeadsQualificados.orcamentos.criar", nome: "Criar Orçamento", tipo: "acao" },
      { id: "LeadsQualificados.orcamentos.editar", nome: "Editar Orçamento", tipo: "acao" },
      { id: "LeadsQualificados.orcamentos.ver_detalhes", nome: "Ver Detalhes Orçamento", tipo: "acao" },
      { id: "LeadsQualificados.nexus_command", nome: "Nexus Command Center", tipo: "subtela" },
      { id: "LeadsQualificados.nexus_command.ver", nome: "Visualizar Nexus", tipo: "acao" },
      { id: "LeadsQualificados.nexus_command.configurar", nome: "Configurar Nexus", tipo: "acao" },
    ]
  },
  {
    id: "Clientes",
    nome: "🏢 Clientes",
    tipo: "menu",
    categoria: "CRM",
    description: "Gestão de clientes.",
    acoes: [
      { id: "Clientes.listar", nome: "Listar Clientes", tipo: "subtela" },
      { id: "Clientes.ver_detalhes", nome: "Ver Detalhes Cliente", tipo: "acao" },
      { id: "Clientes.ver_historico", nome: "Ver Histórico", tipo: "acao" },
      { id: "Clientes.ver_interacoes", nome: "Ver Interações", tipo: "acao" },
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
      { id: "Vendedores.listar", nome: "Listar Vendedores", tipo: "subtela" },
      { id: "Vendedores.ver_performance", nome: "Ver Performance", tipo: "acao" },
      { id: "Vendedores.ver_metas", nome: "Ver Metas", tipo: "acao" },
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
      { id: "Produtos.listar", nome: "Listar Produtos", tipo: "subtela" },
      { id: "Produtos.ver_detalhes", nome: "Ver Detalhes Produto", tipo: "acao" },
      { id: "Produtos.ver_estoque", nome: "Ver Estoque", tipo: "acao" },
      { id: "Produtos.novo", nome: "Criar Produto", tipo: "acao" },
      { id: "Produtos.editar", nome: "Editar Produto", tipo: "acao" },
      { id: "Produtos.excluir", nome: "Excluir Produto", tipo: "acao" },
    ]
  },
  { 
    id: "Agenda", 
    nome: "📅 Agenda", 
    tipo: "menu", 
    categoria: "Geral", 
    description: "Tarefas inteligentes.",
    acoes: [
      { id: "Agenda.ver_tarefas", nome: "Ver Tarefas", tipo: "subtela" },
      { id: "Agenda.criar_tarefa", nome: "Criar Tarefa", tipo: "acao" },
      { id: "Agenda.editar_tarefa", nome: "Editar Tarefa", tipo: "acao" },
      { id: "Agenda.concluir_tarefa", nome: "Concluir Tarefa", tipo: "acao" },
      { id: "Agenda.ver_calendario", nome: "Ver Calendário", tipo: "subtela" },
    ]
  },

  { 
    id: "Importacao", 
    nome: "📥 Importação", 
    tipo: "menu", 
    categoria: "Dados", 
    description: "Importar dados.",
    acoes: [
      { id: "Importacao.upload", nome: "Upload Arquivos", tipo: "subtela" },
      { id: "Importacao.google_sheets", nome: "Google Sheets", tipo: "subtela" },
      { id: "Importacao.historico", nome: "Ver Histórico", tipo: "subtela" },
      { id: "Importacao.processar", nome: "Processar Importação", tipo: "acao" },
      { id: "Importacao.excluir", nome: "Excluir Importação", tipo: "acao" },
    ]
  },
  { 
    id: "Usuarios", 
    nome: "👤 Usuários", 
    tipo: "menu", 
    categoria: "Admin", 
    description: "Gerenciar usuários.",
    acoes: [
      { id: "Usuarios.listar", nome: "Listar Usuários", tipo: "subtela" },
      { id: "Usuarios.criar", nome: "Criar Usuário", tipo: "acao" },
      { id: "Usuarios.editar", nome: "Editar Usuário", tipo: "acao" },
      { id: "Usuarios.permissoes", nome: "Gerenciar Permissões", tipo: "acao" },
      { id: "Usuarios.desativar", nome: "Desativar Usuário", tipo: "acao" },
    ]
  },
  { 
    id: "Auditoria", 
    nome: "🔒 Auditoria", 
    tipo: "menu", 
    categoria: "Admin", 
    description: "Logs do sistema.",
    acoes: [
      { id: "Auditoria.logs", nome: "Ver Logs", tipo: "subtela" },
      { id: "Auditoria.filtrar", nome: "Filtrar Logs", tipo: "acao" },
      { id: "Auditoria.exportar", nome: "Exportar Logs", tipo: "acao" },
    ]
  },
];

const PERFIS_RAPIDOS = {
  admin: { 
    label: "👑 Admin Total", 
    desc: "Acesso completo a todos os recursos e configurações",
    cor: "from-red-500 to-orange-500",
    permissoes: RECURSOS_SISTEMA.flatMap(r => [r.id, ...(r.acoes || []).map(a => a.id)]) 
  },
  gerente: { 
    label: "👔 Gerente", 
    desc: "Visão completa + gestão de equipe e relatórios",
    cor: "from-blue-500 to-indigo-500",
    permissoes: ["Comunicacao", "Dashboard", "LeadsQualificados", "Clientes", "Vendedores", "Produtos", "Agenda", "AnalyticsAvancado"] 
  },
  vendedor: { 
    label: "💼 Vendedor", 
    desc: "Atendimento, leads, clientes e produtos",
    cor: "from-green-500 to-emerald-500",
    permissoes: ["Comunicacao", "Dashboard", "LeadsQualificados", "Clientes", "Produtos", "Agenda"] 
  },
  suporte: { 
    label: "🎧 Suporte", 
    desc: "Atendimento ao cliente e agenda",
    cor: "from-purple-500 to-pink-500",
    permissoes: ["Comunicacao", "Clientes", "Agenda"] 
  },
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
  excluirUsuario: excluirUsuarioAPI,
  integracoesWhatsApp = [],
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

  // Referência para o debounce
  const debounceRef = React.useRef(null);
  
  // Função de salvar direta (sem debounce)
  const executarSalvar = useCallback(async (usuario) => {
    if (!usuario || !salvarUsuario) {
      console.log('[GerenciadorUsuarios] Sem usuário ou função de salvar');
      return;
    }
    
    // Não salvar automaticamente usuários novos sem email
    if (usuario.isNovo && !usuario.email) {
      console.log('[GerenciadorUsuarios] Usuário novo sem email, aguardando...');
      return;
    }
    
    console.log('[GerenciadorUsuarios] 💾 Salvando:', usuario);
    setSalvando(true);
    try {
      const atualizado = await salvarUsuario(usuario);
      console.log('[GerenciadorUsuarios] Retorno do salvar:', atualizado);
      if (atualizado) {
        setUsuarios(prev => prev.map(u => u.id === usuario.id ? atualizado : u));
      }
      toast.success("✅ Salvo!", { duration: 1500 });
    } catch (e) {
      console.error('[GerenciadorUsuarios] Erro ao salvar:', e);
      toast.error("❌ Erro ao salvar: " + (e.message || 'Erro desconhecido'));
    } finally {
      setSalvando(false);
    }
  }, [salvarUsuario]);

  // Auto-save com debounce
  const salvarAutomatico = useCallback((usuario) => {
    // Cancelar debounce anterior
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    // Criar novo debounce
    debounceRef.current = setTimeout(() => {
      executarSalvar(usuario);
    }, 1200);
  }, [executarSalvar]);
  
  // Limpar debounce ao desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Atualizar campo do usuário
  const atualizarUsuario = useCallback((campo, valor) => {
    setUsuarioSelecionado(prev => {
      if (!prev) return prev;
      console.log('[GerenciadorUsuarios] Atualizando campo:', campo, '=', valor);
      const atualizado = { ...prev, [campo]: valor };
      // Atualizar lista local imediatamente
      setUsuarios(lista => lista.map(u => u.id === atualizado.id ? atualizado : u));
      // Agendar salvamento
      salvarAutomatico(atualizado);
      return atualizado;
    });
  }, [salvarAutomatico]);

  // Toggle permissão - atualiza AMBOS os campos para garantir sincronização
  const togglePermissao = (permId) => {
    if (!usuarioSelecionado) return;
    const perms = usuarioSelecionado.permissoes || [];
    const novasPerms = perms.includes(permId)
      ? perms.filter(p => p !== permId)
      : [...perms, permId];
    
    // Atualizar estado local imediatamente com ambos os campos
    setUsuarioSelecionado(prev => {
      if (!prev) return prev;
      const atualizado = { 
        ...prev, 
        permissoes: novasPerms,
        paginas_acesso: novasPerms  // Sincronizar ambos campos
      };
      setUsuarios(lista => lista.map(u => u.id === atualizado.id ? atualizado : u));
      salvarAutomatico(atualizado);
      return atualizado;
    });
  };

  // Aplicar perfil - atualiza AMBOS os campos para garantir sincronização
  const aplicarPerfil = (perfilKey) => {
    const perfil = PERFIS_RAPIDOS[perfilKey];
    if (!perfil || !usuarioSelecionado) return;
    
    const novasPerms = [...perfil.permissoes];
    
    setUsuarioSelecionado(prev => {
      if (!prev) return prev;
      const atualizado = { 
        ...prev, 
        permissoes: novasPerms,
        paginas_acesso: novasPerms  // Sincronizar ambos campos
      };
      setUsuarios(lista => lista.map(u => u.id === atualizado.id ? atualizado : u));
      salvarAutomatico(atualizado);
      return atualizado;
    });
    
    toast.success(`Perfil "${perfil.label}" aplicado`);
  };

  // Excluir usuário
  const excluirUsuario = async (usuario) => {
    if (!usuario) return;
    const confirmar = window.confirm(`Tem certeza que deseja EXCLUIR o usuário "${usuario.nome || usuario.email}"?\n\nEsta ação é irreversível.`);
    if (!confirmar) return;
    
    try {
      // Se for novo (não salvo), apenas remove da lista local
      if (usuario.isNovo) {
        setUsuarios(prev => prev.filter(u => u.id !== usuario.id));
        if (usuarioSelecionado?.id === usuario.id) setUsuarioSelecionado(null);
        toast.success("Usuário removido");
        return;
      }
      
      // Chamar API de exclusão real do banco de dados
      if (excluirUsuarioAPI) {
        await excluirUsuarioAPI(usuario.id);
      }
      setUsuarios(prev => prev.filter(u => u.id !== usuario.id));
      if (usuarioSelecionado?.id === usuario.id) setUsuarioSelecionado(null);
      toast.success("Usuário excluído com sucesso");
    } catch (e) {
      console.error("Erro ao excluir:", e);
      toast.error("Erro ao excluir usuário: " + (e.message || "Erro desconhecido"));
    }
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

  // Filtrar e agrupar usuários por setor
  const usuariosFiltrados = useMemo(() => {
    let lista = usuarios;
    if (filtro) {
      const t = filtro.toLowerCase();
      lista = usuarios.filter(u =>
        (u.nome && u.nome.toLowerCase().includes(t)) ||
        (u.email && u.email.toLowerCase().includes(t))
      );
    }
    return lista;
  }, [usuarios, filtro]);

  // Agrupar por setor
  const usuariosAgrupados = useMemo(() => {
    const grupos = {};
    usuariosFiltrados.forEach(u => {
      const setor = u.setor || "geral";
      if (!grupos[setor]) grupos[setor] = [];
      grupos[setor].push(u);
    });
    // Ordenar setores
    const ordem = ["vendas", "assistencia", "financeiro", "fornecedor", "geral"];
    const resultado = {};
    ordem.forEach(s => {
      if (grupos[s]) resultado[s] = grupos[s];
    });
    // Adicionar setores não listados
    Object.keys(grupos).forEach(s => {
      if (!resultado[s]) resultado[s] = grupos[s];
    });
    return resultado;
  }, [usuariosFiltrados]);

  const SETOR_LABELS = {
    vendas: { label: "🟢 Vendas", cor: "bg-green-100 text-green-800" },
    assistencia: { label: "🔵 Assistência", cor: "bg-blue-100 text-blue-800" },
    financeiro: { label: "🟡 Financeiro", cor: "bg-yellow-100 text-yellow-800" },
    fornecedor: { label: "🟠 Fornecedor", cor: "bg-orange-100 text-orange-800" },
    geral: { label: "⚪ Geral", cor: "bg-slate-100 text-slate-800" },
  };

  const temPermissao = (permId) => (usuarioSelecionado?.permissoes || []).includes(permId);

  const salvarPermissoesNexus = async (userId, configNexus) => {
    try {
      setSalvando(true);
      console.log('[GerenciadorUsuarios] 🔵 Salvando Nexus360 para:', userId, configNexus);
      
      // Buscar o usuário completo primeiro
      const usuarioCompleto = usuarios.find(u => u.id === userId);
      if (!usuarioCompleto) {
        throw new Error('Usuário não encontrado');
      }
      
      // Combinar dados completos do usuário com as configs Nexus
      const usuarioParaSalvar = {
        ...usuarioCompleto,
        ...configNexus
      };
      
      console.log('[GerenciadorUsuarios] 📦 Objeto completo a salvar:', usuarioParaSalvar);
      
      // Chamar salvarUsuario (sempre Nexus360 agora)
      const resultado = await salvarUsuario(usuarioParaSalvar);
      
      console.log('[GerenciadorUsuarios] ✅ Resultado do salvamento:', resultado);
      
      // Atualizar lista local
      const usuariosAtualizados = await carregarUsuarios();
      setUsuarios(usuariosAtualizados || []);
      const atualizado = usuariosAtualizados.find(u => u.id === userId);
      if (atualizado) {
        console.log('[GerenciadorUsuarios] 🔄 Usuário recarregado:', atualizado);
        setUsuarioSelecionado(atualizado);
      } else {
        console.warn('[GerenciadorUsuarios] ⚠️ Usuário não encontrado após salvar');
      }
    } catch (error) {
      console.error('[GerenciadorUsuarios] ❌ Erro ao salvar permissões Nexus:', error);
      throw error;
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-2">
      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* COLUNA 1: LISTA DE USUÁRIOS - COMPACTA */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section className="w-56 flex flex-col bg-white rounded-lg border shadow-sm overflow-hidden">
        <header className="p-2 border-b bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-bold text-slate-800">Usuários</h2>
            <Button size="sm" variant="outline" onClick={novoUsuario} className="h-6 px-1.5 text-xs">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input
              placeholder="Buscar..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="h-6 pl-7 text-[11px]"
            />
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {carregando ? (
            <div className="p-3 text-center text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
              Carregando...
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500">Nenhum usuário</div>
          ) : (
            <div>
              {Object.entries(usuariosAgrupados).map(([setor, listaUsuarios]) => {
                const setorConfig = SETOR_LABELS[setor] || SETOR_LABELS.geral;
                return (
                  <div key={setor}>
                    <div className={`px-2 py-1 ${setorConfig.cor} border-b sticky top-0 z-10`}>
                      <span className="text-[10px] font-bold">{setorConfig.label}</span>
                      <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">{listaUsuarios.length}</Badge>
                    </div>
                    <ul>
                      {listaUsuarios.map(u => (
                        <li
                          key={u.id}
                          onClick={() => { setUsuarioSelecionado(u); setRecursoSelecionado(RECURSOS_SISTEMA[0]); }}
                          className={`px-2 py-1.5 cursor-pointer border-b text-xs transition-colors group ${
                            usuarioSelecionado?.id === u.id
                              ? "bg-indigo-50 border-l-2 border-l-indigo-500"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-slate-800 truncate text-[11px]">{u.nome || "(sem nome)"}</span>
                            <div className="flex items-center gap-0.5">
                              <Badge variant={u.ativo ? "default" : "secondary"} className="text-[9px] px-1 py-0">
                                {u.ativo ? "✓" : "✗"}
                              </Badge>
                              <button
                                onClick={(e) => { e.stopPropagation(); excluirUsuario(u); }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-all"
                                title="Excluir"
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{u.email}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
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
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="dados">
                  <User className="w-4 h-4 mr-2" />
                  Dados
                </TabsTrigger>
                <TabsTrigger value="comunicacao" onClick={() => setRecursoSelecionado({ id: "Comunicacao", nome: "💬 Comunicação", tipo: "menu" })}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Comunicação
                </TabsTrigger>
                <TabsTrigger value="permissoes_nexus">
                  <Shield className="w-4 h-4 mr-2" />
                  Permissões
                </TabsTrigger>
              </TabsList>

              {/* ABA: Dados & Perfil */}
              <TabsContent value="dados" className="space-y-4 mt-4">
                {recursoSelecionado?.tipo === "config" && (
                  <SecaoDadosUsuario
                    usuarioSelecionado={usuarioSelecionado}
                    atualizarUsuario={atualizarUsuario}
                    integracoesWhatsApp={integracoesWhatsApp}
                  />
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
          </TabsContent>

              {/* ABA: Comunicação */}
              <TabsContent value="comunicacao" className="space-y-4 mt-4">
                <SecaoComunicacaoUsuario
                  usuarioSelecionado={usuarioSelecionado}
                  integracoesWhatsApp={integracoesWhatsApp}
                  atualizarUsuario={atualizarUsuario}
                />
              </TabsContent>

              {/* ABA: Permissões Nexus360 (ÚNICO MOTOR DE DECISÃO) */}
              <TabsContent value="permissoes_nexus" className="space-y-4 mt-4">
                <PainelPermissoesUnificado
                  usuario={usuarioSelecionado}
                  integracoes={integracoesWhatsApp}
                  onSalvar={salvarPermissoesNexus}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </section>
    </div>
  );
}