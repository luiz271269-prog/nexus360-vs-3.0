import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Shield, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  PERMISSION GUARD - Proteção de Rotas por Role               ║
 * ║  Bloqueia acesso a páginas que o usuário não tem permissão  ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  USER: 'user'
};

export const PERMISSIONS = {
  // Administração
  MANAGE_USERS: [ROLES.ADMIN],
  VIEW_AUDIT: [ROLES.ADMIN, ROLES.SUPERVISOR],
  MANAGE_INTEGRATIONS: [ROLES.ADMIN],
  MANAGE_AUTOMATIONS: [ROLES.ADMIN, ROLES.SUPERVISOR],
  
  // Comunicação
  VIEW_ALL_CONVERSATIONS: [ROLES.ADMIN, ROLES.SUPERVISOR],
  MANAGE_CONTACTS: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.USER],
  DELETE_MESSAGES: [ROLES.ADMIN],
  
  // Vendas
  VIEW_ALL_SALES: [ROLES.ADMIN, ROLES.SUPERVISOR],
  MANAGE_OWN_SALES: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.USER],
  DELETE_SALES: [ROLES.ADMIN],
  
  // Relatórios
  VIEW_FULL_REPORTS: [ROLES.ADMIN, ROLES.SUPERVISOR],
  EXPORT_DATA: [ROLES.ADMIN, ROLES.SUPERVISOR],
  
  // Sistema
  VIEW_SYSTEM_HEALTH: [ROLES.ADMIN],
  MANAGE_BASE_CONHECIMENTO: [ROLES.ADMIN, ROLES.SUPERVISOR],
  VIEW_IA_METRICS: [ROLES.ADMIN, ROLES.SUPERVISOR]
};

/**
 * Hook para verificar permissões
 */
export function usePermissions() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('[PERMISSIONS] Erro ao carregar usuário:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    const allowedRoles = PERMISSIONS[permission] || [];
    return allowedRoles.includes(user.role);
  };

  const isAdmin = () => user?.role === ROLES.ADMIN;
  const isSupervisor = () => user?.role === ROLES.SUPERVISOR;
  const isUser = () => user?.role === ROLES.USER;

  return {
    user,
    loading,
    hasPermission,
    isAdmin,
    isSupervisor,
    isUser
  };
}

/**
 * Componente PermissionGuard
 * Uso: <PermissionGuard permission="MANAGE_USERS" fallback={<NoAccess />}>
 */
export default function PermissionGuard({ 
  permission, 
  requiredRole,
  children, 
  fallback,
  redirectTo 
}) {
  const { user, loading, hasPermission } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      // Usuário não autenticado - redirecionar para login
      if (redirectTo) {
        navigate(redirectTo);
      }
    }
  }, [loading, user, redirectTo, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-12 h-12 text-blue-500 animate-pulse mx-auto mb-4" />
          <p className="text-slate-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return fallback || <NoAccessScreen message="Você precisa estar autenticado" />;
  }

  // Verificar por permissão específica
  if (permission && !hasPermission(permission)) {
    return fallback || <NoAccessScreen message="Você não tem permissão para acessar esta página" />;
  }

  // Verificar por role específica
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowedRoles.includes(user.role)) {
      return fallback || <NoAccessScreen message="Acesso restrito ao seu nível de usuário" />;
    }
  }

  return <>{children}</>;
}

/**
 * Tela de acesso negado
 */
function NoAccessScreen({ message }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Acesso Negado
          </h1>
          
          <p className="text-slate-600 mb-6">
            {message}
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>Entre em contato com o administrador se acha que isso é um erro</p>
          </div>

          <Button
            onClick={() => navigate(createPageUrl('Dashboard'))}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * HOC para proteger páginas inteiras
 */
export function withPermission(Component, permission, requiredRole) {
  return function ProtectedComponent(props) {
    return (
      <PermissionGuard permission={permission} requiredRole={requiredRole}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}