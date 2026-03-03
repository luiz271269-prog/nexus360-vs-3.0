import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useContatosInteligentes } from "../components/hooks/useContatosInteligentes";
import {
  BarChart3,
  Users,
  Target,
  FileText,
  TrendingUp,
  Upload,
  Menu,
  X,
  ShoppingCart,
  Briefcase,
  Brain,
  MessageSquare,
  Bot,
  Zap,
  CalendarCheck,
  BrainCircuit,
  Home,
  UserCheck,
  DollarSign,
  Calendar,
  Sparkles,
  Settings,
  Calculator,
  Building2,
  Package,
  Bug,
  UserCog,
  Activity,
  BookOpen,
  Workflow,
  Shield,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import NexusChat from "../components/global/NexusChat";
import LembreteFlutuanteIA from "../components/global/LembreteFlutuanteIA";
import NotificationSystem from "../components/comunicacao/NotificationSystem";
import { toast } from "sonner";
import InitializadorSistema from "../components/global/InitializadorSistema";
import DeploymentBanner from "../components/global/DeploymentBanner";
import CacheBuster from "../components/global/CacheBuster";
// import FeedbackAutomaticoCapturado from "../components/inteligencia/FeedbackAutomaticoCapturado";
import { calcularLembretesGlobal } from "../components/global/MotorLembretesGlobal";
import UserAuthWidget from "../components/global/UserAuthWidget";

function NavItem({ href, icon: Icon, label, badge, badgeColor, lembretesCount }) {
  const isActive = window.location.pathname === new URL(href, window.location.origin).pathname;

  const getBadgeColor = (count) => {
    if (count >= 10) return 'bg-purple-600';
    if (count >= 5) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Link
      to={href}
      title={label}
      className={`relative flex items-center justify-center p-3 text-sm font-medium rounded-xl transition-all duration-300 transform hover:scale-105 group ${
        isActive
          ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white shadow-xl shadow-orange-500/30'
          : 'text-slate-300 hover:bg-gradient-to-br hover:from-slate-700 hover:to-slate-600 hover:text-white hover:shadow-lg'
      }`}
    >
      <Icon className="h-6 w-6 flex-shrink-0" />
      <span className="sr-only">{label}</span>

      {badge && !lembretesCount && (
        <Badge className={`absolute -top-1 -right-1 h-6 min-w-6 flex items-center justify-center text-[11px] font-bold px-1.5 ${badgeColor || 'bg-red-500 text-white'} rounded-full shadow-lg`}>
          {badge}
        </Badge>
      )}

      {lembretesCount > 0 && (
        <div className="absolute -top-2 -right-2">
          <div className={`${getBadgeColor(lembretesCount)} w-7 h-7 rounded-full flex items-center justify-center shadow-lg shadow-black/30 border-2 border-slate-900 animate-pulse`}>
            <span className="text-white text-[11px] font-bold">
              {lembretesCount > 99 ? '99+' : lembretesCount}
            </span>
          </div>
        </div>
      )}

      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
      )}

      <div className="absolute left-full ml-3 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700">
        {label}
        {badge && <span className="ml-2 text-amber-400">({badge})</span>}
        {lembretesCount > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Zap className="w-3 h-3 text-purple-400" />
            <span className="text-purple-300 font-semibold">
              {lembretesCount} lembrete{lembretesCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}



function SideBar({ isOpen, menuItems, contadoresLembretes, usuario, loadingUsuario, onLogout, onOpenNexus, agentSession, onToggle }) {
  return (
    <aside
        className={`fixed inset-y-0 left-0 z-50 w-20 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col border-r border-slate-700/50`}
      >
        <div className="flex items-center justify-center p-4 border-b border-slate-700/50">
          {/* Mobile: botão hambúrguer para abrir/fechar sidebar. Desktop: logo link */}
          <button
            onClick={onToggle}
            className="relative group md:hidden w-12 h-12 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300"
          >
            <X className="h-7 w-7 text-white" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
          </button>
          <Link to={createPageUrl("Dashboard")} className="relative group hidden md:flex">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:shadow-orange-500/30 transition-all duration-300">
              <Zap className="h-7 w-7 text-white" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
          {/* Botão Nexus AI no topo */}
          <button
            onClick={onOpenNexus}
            className="w-full flex items-center justify-center p-3 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-lg shadow-purple-500/25 transition-all duration-300 hover:scale-105 group relative"
            title="Nexus AI"
          >
            <Sparkles className="h-6 w-6 text-white" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
            {(() => {
              const getAgentBadge = (session) => {
                if (session.status === 'offline') {
                  return { text: 'OFF', color: 'bg-red-500', pulse: false, tooltip: 'Agente offline' };
                }
                if (session.status === 'degraded') {
                  return { text: 'SLOW', color: 'bg-yellow-500', pulse: true, tooltip: 'Processamento degradado' };
                }
                if (session.activeRuns > 0) {
                  return { 
                    text: `${session.activeRuns}`, 
                    color: 'bg-blue-500', 
                    pulse: true,
                    tooltip: `${session.activeRuns} execuções ativas`
                  };
                }
                return { text: 'ON', color: 'bg-green-500', pulse: false, tooltip: 'Agente online' };
              };

              const badge = getAgentBadge(agentSession);

              return (
                <Badge 
                  className={`absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-[9px] font-bold px-1 ${badge.color} text-white rounded-full shadow-lg ${badge.pulse ? 'animate-pulse' : ''}`}
                  title={badge.tooltip}
                >
                  {badge.text}
                </Badge>
              );
            })()}
            {/* Tooltip */}
            <div className="absolute left-full ml-3 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700">
              🤖 Nexus AI <span className="text-green-400 ml-1">Online</span>
            </div>
          </button>

          {menuItems.map((item) => (
            <NavItem
              key={item.page}
              href={createPageUrl(item.page)}
              icon={item.icon}
              label={item.name}
              badge={item.badge}
              badgeColor={item.badgeColor}
              lembretesCount={contadoresLembretes[item.page] || 0}
            />
          ))}
        </nav>

        {/* Rodapé com autenticação unificada */}
        <div className="p-2 border-t border-slate-700/50">
          <UserAuthWidget usuario={usuario} loadingUsuario={loadingUsuario} onLogout={onLogout} />
        </div>
      </aside>
  );
}

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nexusOpen, setNexusOpen] = useState(false);
  const [globalUsuario, setGlobalUsuario] = useState(null);
  const [loadingUsuario, setLoadingUsuario] = useState(true);
  const [badges, setBadges] = useState({});
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [contadoresLembretes, setContadoresLembretes] = useState({});
  const [agentSession, setAgentSession] = useState({
    status: 'online',
    mode: 'assistente',
    activeRuns: 0,
    lastHeartbeat: null
  });
  const navigate = useNavigate();
  const ultimaAtualizacaoRef = useRef(0);
  
  // ✅ SEMPRE chamar hook (regra de hooks do React - sem condicionais)
  const contatosInteligentes = useContatosInteligentes(globalUsuario, {
    tipo: ['lead', 'cliente'],
    diasSemMensagem: 2,
    minDealRisk: 30,
    limit: 50,
    autoRefresh: true
  });

  // ✅ P1 FIX: Sincronizar badge em tempo real
  useEffect(() => {
    setContadoresLembretes(prev => ({
      ...prev,
      ContatosInteligentes: contatosInteligentes.totalUrgentes || 0
    }));
  }, [contatosInteligentes.totalUrgentes]);

  // Definição completa de todos os itens do menu
  const todosMenuItems = [
    { name: "Dashboard", icon: BarChart3, page: "Dashboard" },
    { name: "Central de Comunicacao", icon: MessageSquare, page: "Comunicacao" },
    { name: "Contatos Inteligentes", icon: Target, page: "ContatosInteligentes" },
    { name: "CRM - Kanban", icon: Briefcase, page: "LeadsQualificados" },
    { name: "Clientes", icon: Building2, page: "Clientes" },
    { name: "Metas de Vendas", icon: Users, page: "Vendedores" },
    { name: "Agenda Inteligente", icon: Calendar, page: "Agenda" },
    { name: "Produtos", icon: Package, page: "Produtos" },
    { name: "Automações", icon: Workflow, page: "Automacoes" },
    { name: "Métricas de Inteligência", icon: Brain, page: "InteligenciaMetricas" },
    { name: "Importação", icon: Upload, page: "Importacao" },
    { name: "Gerenciamento de Usuários", icon: UserCog, page: "Usuarios" },
    { name: "Ferramentas de Migração", icon: Activity, page: "FerramentasMigracao" },
    { name: "Auditoria", icon: Shield, page: "Auditoria" }
  ];

  // Função para obter os itens de menu baseado no perfil do usuário
  const getMenuItemsParaPerfil = (usuario) => {
    if (!usuario) return todosMenuItems; // Fallback: mostrar todos

    const role = usuario.role;
    const setor = usuario.attendant_sector || 'geral';
    const nivelAtendente = usuario.attendant_role || 'pleno';
    const paginasAcesso = usuario.paginas_acesso || [];

    // Se tem páginas específicas configuradas, usa elas
    if (paginasAcesso.length > 0) {
      return todosMenuItems.filter(item => paginasAcesso.includes(item.page));
    }

    // Administrador - acesso total
    if (role === 'admin') {
      return todosMenuItems.filter(item => {
        // Ferramentas de Migração: apenas admin
        if (item.page === 'FerramentasMigracao') return true;
        return true;
      });
    }

    // Gerência (coordenador/gerente)
    if (['coordenador', 'gerente'].includes(nivelAtendente)) {
      if (setor === 'vendas') {
        return todosMenuItems.filter(item => [
          'Comunicacao', 'Dashboard', 'LeadsQualificados', 'Vendedores', 
          'Clientes', 'Agenda', 'Produtos', 'Automacoes'
        ].includes(item.page));
        }
        if (setor === 'assistencia') {
        return todosMenuItems.filter(item => [
          'Comunicacao', 'Clientes', 'Agenda', 'Dashboard', 'Produtos', 'Automacoes'
        ].includes(item.page));
        }
        if (setor === 'fornecedor') {
        return todosMenuItems.filter(item => [
          'Comunicacao', 'Produtos', 'Importacao', 'Dashboard', 'Clientes', 'Agenda', 'Automacoes'
        ].includes(item.page));
        }
        // Gerência geral
        return todosMenuItems.filter(item => [
        'Comunicacao', 'Dashboard', 'LeadsQualificados', 'Clientes', 
        'Vendedores', 'Produtos', 'Agenda', 'Automacoes'
        ].includes(item.page));
        }

    // Supervisor (senior)
    if (nivelAtendente === 'senior') {
      if (setor === 'vendas') {
        return todosMenuItems.filter(item => [
          'Comunicacao', 'LeadsQualificados', 'Vendedores', 'Clientes', 
          'Agenda', 'Dashboard', 'Produtos'
        ].includes(item.page));
      }
      if (setor === 'assistencia') {
        return todosMenuItems.filter(item => [
          'Comunicacao', 'Clientes', 'Agenda', 'Dashboard', 'Produtos'
        ].includes(item.page));
      }
      if (setor === 'fornecedor') {
        return todosMenuItems.filter(item => [
          'Comunicacao', 'Produtos', 'Importacao', 'Agenda', 'Dashboard'
        ].includes(item.page));
      }
      return todosMenuItems.filter(item => [
        'Comunicacao', 'Clientes', 'Agenda', 'Dashboard', 'Produtos'
      ].includes(item.page));
    }

    // Atendente (junior/pleno)
    if (setor === 'vendas') {
      return todosMenuItems.filter(item => [
        'Comunicacao', 'LeadsQualificados', 'Clientes', 'Produtos', 'Agenda', 'Dashboard'
      ].includes(item.page));
    }
    if (setor === 'assistencia') {
      return todosMenuItems.filter(item => [
        'Comunicacao', 'Clientes', 'Produtos', 'Agenda', 'Dashboard'
      ].includes(item.page));
    }
    if (setor === 'fornecedor') {
      return todosMenuItems.filter(item => [
        'Comunicacao', 'Produtos', 'Clientes', 'Agenda', 'Dashboard'
      ].includes(item.page));
    }

    // Usuário padrão (fallback)
    return todosMenuItems.filter(item => [
      'Comunicacao', 'Dashboard', 'Clientes', 'Agenda'
    ].includes(item.page));
  };

  // Aplicar filtro de perfil
  const baseMenuItems = getMenuItemsParaPerfil(globalUsuario);

  const checkAgentHealth = async () => {
    try {
      const runs = await base44.entities.AgentRun.filter({
        status: 'processando',
        created_date: { $gte: new Date(Date.now() - 5 * 60 * 1000).toISOString() }
      });
      
      setAgentSession({
        status: 'online',
        mode: 'assistente',
        activeRuns: runs.length,
        lastHeartbeat: new Date().toISOString()
      });
    } catch (error) {
      console.error('[LAYOUT] Erro ao verificar saúde do agente:', error);
      setAgentSession(prev => ({
        ...prev,
        status: error.message?.includes('429') ? 'degraded' : 'offline'
      }));
    }
  };

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
    } catch (error) {
      console.error('[LAYOUT] Erro ao fazer logout:', error);
    } finally {
      setGlobalUsuario(null);
      setLoadingUsuario(false);
      window.location.reload();
    }
  };

  const carregarDadosGlobais = async () => {
    const agora = Date.now();
    if (agora - ultimaAtualizacaoRef.current < 120000) { // Aumentado para 2min
      console.log('[LAYOUT] ⏭️ Pulando atualização (muito recente)');
      return;
    }
    ultimaAtualizacaoRef.current = agora;

    try {
      const user = await base44.auth.me();
      setGlobalUsuario(user);

      if (user) {
        try {
          const contadores = await calcularLembretesGlobal(user, base44);

          // ✅ P1 FIX: Usar totalUrgentes do hook sem risco de ReferenceError
          const urgentes = contatosInteligentes?.totalUrgentes;
          if (typeof urgentes === 'number') {
            contadores['ContatosInteligentes'] = urgentes;
          } else {
            // Mantém valor anterior se hook ainda não está pronto
            contadores['ContatosInteligentes'] = contadores['ContatosInteligentes'] ?? 0;
          }

          setContadoresLembretes(contadores);
        } catch (error) {
          console.error('[LAYOUT] Erro ao calcular lembretes:', error);
          
          if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
            console.warn('[LAYOUT] ⚠️ Rate limit atingido. Próxima atualização de lembretes em 10 minutos.');
          }
        }
      }

      setBadges({});

    } catch (error) {
      console.error("[LAYOUT] Erro ao carregar dados globais:", error);
      
      // Força estado deslogado em caso de erro de autenticação
      setGlobalUsuario(null);
      
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        console.warn('[LAYOUT] ⚠️ Rate limit atingido nos dados globais.');
      }
    } finally {
      setLoadingUsuario(false);
    }
  };

  // Redirecionar para Comunicacao no mobile ao abrir o app na raiz/dashboard
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const currentPath = window.location.pathname;
    const comunicacaoPath = new URL(createPageUrl("Comunicacao"), window.location.origin).pathname;
    const rootOrDashboard = currentPath === '/' || currentPath === new URL(createPageUrl("Dashboard"), window.location.origin).pathname;
    if (isMobile && rootOrDashboard) {
      navigate(createPageUrl("Comunicacao"), { replace: true });
    }
  }, []);

  useEffect(() => {
    carregarDadosGlobais();
    checkAgentHealth();

    const intervalDados = setInterval(carregarDadosGlobais, 5 * 60 * 1000); // ✅ Poll a cada 5min
    const intervalAgent = setInterval(checkAgentHealth, 30000); // 30 segundos

    return () => {
      clearInterval(intervalDados);
      clearInterval(intervalAgent);
    };
  }, []); // ✅ Throttle interno impede excesso de chamadas

  const menuItems = baseMenuItems.map((item) => ({
    ...item,
    badge: badges[item.name]?.count,
    badgeColor: badges[item.name]?.color
  }));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <InitializadorSistema />
      <CacheBuster />
      <DeploymentBanner />

      {globalUsuario && <NotificationSystem usuario={globalUsuario} />}

      {/* Header mobile fixo no topo */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 shadow-lg">
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg"
        >
          <Menu className="h-5 w-5 text-white" />
        </button>
        <span className="text-white font-semibold text-sm truncate max-w-[200px]">{currentPageName}</span>
        <UserAuthWidget usuario={globalUsuario} loadingUsuario={loadingUsuario} onLogout={handleLogout} />
      </header>

      <SideBar
        isOpen={sidebarOpen}
        menuItems={menuItems}
        contadoresLembretes={contadoresLembretes}
        usuario={globalUsuario}
        loadingUsuario={loadingUsuario}
        onLogout={handleLogout}
        onOpenNexus={() => setNexusOpen(true)}
        agentSession={agentSession}
        onToggle={() => setSidebarOpen(prev => !prev)}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="bg-slate-50 flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-0 relative md:pt-0 pt-14">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-amber-400/20 to-orange-600/20 rounded-full mix-blend-multiply filter blur-xl animate-pulse" />
          <div className="absolute top-40 right-20 w-72 h-72 bg-gradient-to-r from-orange-400/20 to-red-600/20 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-2s" />
          <div className="absolute bottom-20 left-40 w-72 h-72 bg-gradient-to-r from-red-400/20 to-orange-600/20 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-4s" />
        </div>

        <div className="relative z-10">
          {children}
        </div>
      </main>

      {/* Botão flutuante removido - agora está no menu lateral */}

      <NexusChat
        isOpen={nexusOpen}
        onToggle={() => setNexusOpen(false)}
        agentContext={{
          user: globalUsuario ? {
            id: globalUsuario.id,
            role: globalUsuario.role,
            sector: globalUsuario.attendant_sector || 'geral',
            level: globalUsuario.attendant_role || 'pleno',
            paginas_acesso: globalUsuario.paginas_acesso || []
          } : null,
          page: currentPageName,
          path: typeof window !== 'undefined' ? window.location.pathname : '/'
        }}
        agentSession={agentSession}
      />

      <LembreteFlutuanteIA
        orcamentos={[]}
        usuario={globalUsuario}
        onAcaoIA={() => {}}
      />
    </div>
  );
}