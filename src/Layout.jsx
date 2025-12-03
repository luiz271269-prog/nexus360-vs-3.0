import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
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
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import NexusChat from "../components/global/NexusChat";
import LembreteFlutuanteIA from "../components/global/LembreteFlutuanteIA";
import NotificationSystem from "../components/comunicacao/NotificationSystem";
import { toast } from "sonner";
import InitializadorSistema from "../components/global/InitializadorSistema";
import DeploymentBanner from "../components/global/DeploymentBanner";
import CacheBuster from "../components/global/CacheBuster";
import FeedbackAutomaticoCapturado from "../components/inteligencia/FeedbackAutomaticoCapturado";
import { calcularLembretesGlobal } from "../components/global/MotorLembretesGlobal";

function NavItem({ href, icon: Icon, label, badge, badgeColor, lembretesCount }) {
  const location = useLocation();
  const isActive = location.pathname === new URL(href, window.location.origin).pathname;

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



function SideBar({ isOpen, menuItems, contadoresLembretes, usuario, onOpenNexus }) {
  return (
    <TooltipProvider>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-20 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col border-r border-slate-700/50`}
      >
        <div className="flex items-center justify-center p-4 border-b border-slate-700/50">
          <Link to={createPageUrl("Dashboard")} className="relative group">
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
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-[9px] font-bold px-1 bg-green-500 text-white rounded-full shadow-lg animate-pulse">
              ON
            </Badge>
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

        {/* Rodapé com usuário e versão */}
        <div className="p-2 border-t border-slate-700/50 space-y-2">
          {/* Emoji Usuário Logado */}
          {usuario && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 cursor-pointer transition-all">
                  <span className="text-2xl">👤</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-slate-800 border-slate-700 p-3 max-w-xs">
                <div className="space-y-1">
                  <p className="font-bold text-white">{usuario.full_name || 'Usuário'}</p>
                  <p className="text-xs text-slate-400">{usuario.email}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Badge className="bg-amber-500 text-white text-[10px]">{usuario.role || 'user'}</Badge>
                    {usuario.attendant_sector && (
                      <Badge className="bg-blue-500 text-white text-[10px]">{usuario.attendant_sector}</Badge>
                    )}
                  </div>
                  {usuario.attendant_role && (
                    <p className="text-[10px] text-slate-500 mt-1">Nível: {usuario.attendant_role}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}


        </div>
      </aside>
    </TooltipProvider>
  );
}

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nexusOpen, setNexusOpen] = useState(false);
  const [globalUsuario, setGlobalUsuario] = useState(null);
  const [badges, setBadges] = useState({});
  const [contadoresLembretes, setContadoresLembretes] = useState({});
  const navigate = useNavigate();
  const ultimaAtualizacaoRef = useRef(0);

  // Definição completa de todos os itens do menu
  const todosMenuItems = [
    { name: "💬 Central de Comunicação", icon: MessageSquare, page: "Comunicacao" },
    { name: "Dashboard", icon: Home, page: "Dashboard" },
    { name: "📊 Metas de Vendas", icon: Users, page: "Vendedores" },
    { name: "🎯 Leads & Qualificação", icon: Target, page: "LeadsQualificados" },
    { name: "👥 Clientes", icon: Building2, page: "Clientes" },
    { name: "Produtos", icon: Package, page: "Produtos" },
    { name: "Agenda Inteligente", icon: Calendar, page: "Agenda" },
    { name: "Importação", icon: Upload, page: "Importacao" },
    { name: "Gerenciamento de Usuários", icon: UserCog, page: "Usuarios" },
    { name: "Auditoria", icon: Shield, page: "Auditoria" }
  ];

  // Função para obter os itens de menu baseado no perfil do usuário
  const getMenuItemsParaPerfil = (usuario) => {
    if (!usuario) return todosMenuItems; // Fallback: mostrar todos

    const role = usuario.role;
    const setor = usuario.attendant_sector || usuario.whatsapp_setores?.[0] || 'geral';
    const nivelAtendente = usuario.attendant_role || 'pleno';
    const paginasAcesso = usuario.paginas_acesso || [];

    // Se tem páginas específicas configuradas, usa elas
    if (paginasAcesso.length > 0) {
      return todosMenuItems.filter(item => paginasAcesso.includes(item.page));
    }

    // Administrador - acesso total
    if (role === 'admin') {
      return todosMenuItems;
    }

    // Gerência (coordenador/gerente)
    if (['coordenador', 'gerente'].includes(nivelAtendente)) {
      if (setor === 'vendas') {
        return todosMenuItems.filter(item => [
          'Comunicacao', 'Dashboard', 'LeadsQualificados', 'Vendedores', 
          'Clientes', 'AnalyticsAvancado', 'Agenda', 'Produtos'
        ].includes(item.page));
      }
      if (setor === 'assistencia') {
        return todosMenuItems.filter(item => [
          'Comunicacao', 'Clientes', 'Agenda', 'Dashboard', 'Produtos', 'AnalyticsAvancado'
        ].includes(item.page));
      }
      if (setor === 'fornecedor') {
        return todosMenuItems.filter(item => [
          'Comunicacao', 'Produtos', 'Importacao', 'Dashboard', 'Clientes', 'Agenda', 'AnalyticsAvancado'
        ].includes(item.page));
      }
      // Gerência geral
      return todosMenuItems.filter(item => [
        'Comunicacao', 'Dashboard', 'LeadsQualificados', 'Clientes', 
        'Vendedores', 'Produtos', 'Agenda', 'AnalyticsAvancado'
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
      // Supervisor geral
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

  useEffect(() => {
    carregarDadosGlobais();
    
    const interval = setInterval(carregarDadosGlobais, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const carregarDadosGlobais = async () => {
    const agora = Date.now();
    if (agora - ultimaAtualizacaoRef.current < 60000) {
      console.log('[LAYOUT] ⏭️ Pulando atualização (muito recente)');
      return;
    }
    ultimaAtualizacaoRef.current = agora;

    try {
      const user = await base44.auth.me();
      setGlobalUsuario(user);

      if (user) {
        try {
          const contadores = await calcularLembretesGlobal(user);
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
      console.error("Erro ao carregar dados globais:", error);
      
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        console.warn('[LAYOUT] ⚠️ Rate limit atingido nos dados globais.');
      }
    }
  };

  const menuItems = baseMenuItems.map((item) => ({
    ...item,
    badge: badges[item.name]?.count,
    badgeColor: badges[item.name]?.color
  }));

  return (
    <div className="flex h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      <InitializadorSistema />
      <FeedbackAutomaticoCapturado />
      <CacheBuster />
      <DeploymentBanner />

      {globalUsuario && <NotificationSystem usuario={globalUsuario} />}

      <SideBar
        isOpen={sidebarOpen}
        menuItems={menuItems}
        contadoresLembretes={contadoresLembretes}
        usuario={globalUsuario}
        onOpenNexus={() => setNexusOpen(true)}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <header className="md:hidden bg-gradient-to-r from-slate-900 to-slate-800 shadow-xl flex items-center justify-between p-4 border-b border-slate-700/50">
        <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            VendaPro
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="text-white hover:bg-white/10"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </header>

      <main className="bg-slate-50 from-amber-50 via-orange-50/30 to-red-50/20 flex-1 overflow-x-hidden overflow-y-auto p-0 relative">
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
      />

      <LembreteFlutuanteIA
        orcamentos={[]}
        usuario={globalUsuario}
        onAcaoIA={() => {}}
      />
    </div>
  );
}