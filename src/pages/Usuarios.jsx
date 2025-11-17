
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import PermissionGuard, { PERMISSIONS } from "../components/security/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, Shield, UserCheck, Search, UserCog } from "lucide-react";
import { toast } from "sonner";

import TabelaUsuarios from "../components/usuarios/TabelaUsuarios";
import UsuarioForm from "../components/usuarios/UsuarioForm";
import AlertasInteligentesIA from '../components/global/AlertasInteligentesIA';
import BotaoNexusFlutuante from '../components/global/BotaoNexusFlutuante';

export default function Usuarios() {
  return (
    <PermissionGuard permission="MANAGE_USERS">
      <UsuariosContent />
    </PermissionGuard>
  );
}

function UsuariosContent() {
  const [usuarios, setUsuarios] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState(null); // Preserving 'editingUsuario' as it's consistently used
  const [loading, setLoading] = useState(true);
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [filtro, setFiltro] = useState({ busca: "", role: "todos" });
  const [alertasIA, setAlertasIA] = useState([]);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    setLoading(true);
    try {
      const usuarioLogado = await base44.auth.me();
      setUsuarioAtual(usuarioLogado);
      
      let usuariosData = [];
      // The role check 'admin' here is a secondary check and should ideally be covered by PermissionGuard
      // However, keeping it for data fetching logic if the PermissionGuard is bypassed or for specific data filtering.
      // If the user has MANAGE_USERS permission, they are likely an admin or equivalent.
      if (usuarioLogado.role === 'admin' || usuarioLogado.permissions.includes(PERMISSIONS.MANAGE_USERS)) { 
        const [users, vendors] = await Promise.all([
          base44.entities.User.list(),
          base44.entities.Vendedor.list()
        ]);
        usuariosData = users;
        setUsuarios(users);
        setVendedores(vendors);
      }
      gerarAlertasIA(usuariosData);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar usuários");
    }
    setLoading(false);
  };

  const gerarAlertasIA = (usuarios) => {
    const alertas = [];

    const inativos = usuarios.filter(u => !u.last_login || 
      Math.floor((new Date() - new Date(u.last_login)) / (1000 * 60 * 60 * 24)) > 30
    );

    if (inativos.length > 0) {
      alertas.push({
        id: 'usuarios_inativos',
        prioridade: 'media',
        titulo: `${inativos.length} Usuários Inativos`,
        descricao: 'Sem acesso há mais de 30 dias',
        acao_sugerida: 'Revisar Acessos',
        onAcao: () => toast.info('👥 Revisão de acessos recomendada')
      });
    }

    const admins = usuarios.filter(u => u.role === 'admin');
    if (admins.length > 5) {
      alertas.push({
        id: 'muitos_admins',
        prioridade: 'baixa',
        titulo: 'Muitos Administradores',
        descricao: `${admins.length} usuários com privilégios administrativos`,
        acao_sugerida: 'Revisar Permissões',
        onAcao: () => toast.info('🔐 Revisão de permissões sugerida')
      });
    }

    setAlertasIA(alertas);
  };

  const handleSalvar = async (usuarioData) => {
    setLoading(true);
    try {
      if (editingUsuario) {
        await base44.entities.User.update(editingUsuario.id, usuarioData);
        toast.success("✅ Usuário atualizado com sucesso!");
      } else {
        await base44.entities.User.create(usuarioData);
        toast.success(`✅ Convite enviado para ${usuarioData.email} com sucesso!`);
      }
      setShowForm(false);
      setEditingUsuario(null);
      await carregarUsuarios();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
      toast.error("Erro ao salvar usuário. Verifique se o e-mail já não está cadastrado.");
    }
    setLoading(false);
  };

  const handleEditar = (usuario) => {
    setEditingUsuario(usuario);
    setShowForm(true);
  };

  const handleAlterarRole = async (usuario, novoRole) => {
    if (confirm(`Tem certeza que deseja alterar o perfil de ${usuario.full_name}?`)) {
      setLoading(true);
      try {
        await base44.entities.User.update(usuario.id, { role: novoRole });
        toast.success(`✅ Perfil de ${usuario.full_name} alterado com sucesso!`);
        await carregarUsuarios();
      } catch (error) {
        console.error("Erro ao alterar role:", error);
        toast.error("Erro ao alterar perfil do usuário");
      }
      setLoading(false);
    }
  };

  if (loading && !usuarioAtual) {
    return <div className="text-center p-8">Carregando...</div>;
  }

  // This block is now redundant because PermissionGuard handles access control.
  // It's left commented out as a reference if a more granular in-component check is desired later,
  // but for now, the PermissionGuard provides the primary protection.
  /*
  if (!usuarioAtual || (usuarioAtual.role !== 'admin' && !usuarioAtual.permissions.includes(PERMISSIONS.MANAGE_USERS))) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-8 shadow-xl">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg shadow-red-500/50">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-red-700 to-orange-700 bg-clip-text text-transparent mb-2">
            Acesso Negado
          </h2>
          <p className="text-red-600">Apenas administradores podem gerenciar usuários.</p>
        </div>
      </div>
    );
  }
  */

  const filteredUsuarios = usuarios.filter(u => {
    const buscaMatch = u.full_name?.toLowerCase().includes(filtro.busca.toLowerCase()) ||
                       u.email?.toLowerCase().includes(filtro.busca.toLowerCase());
    const roleMatch = filtro.role === 'todos' || u.role === filtro.role;
    return buscaMatch && roleMatch;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <UserCog className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Gerenciamento de Usuários
              </h1>
              <p className="text-slate-300 mt-1">
                Controle de acessos e permissões do sistema
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setEditingUsuario(null);
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 hover:from-amber-500 hover:via-orange-600 hover:to-red-600 text-white font-bold shadow-lg shadow-orange-500/30"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      <BotaoNexusFlutuante
        contadorLembretes={alertasIA.length}
        onClick={() => {
          if (alertasIA.length > 0) {
            toast.info(`📊 ${alertasIA.length} alertas de usuários`);
          }
        }}
      />

      <AlertasInteligentesIA
        alertas={alertasIA}
        titulo="Usuários IA"
        onAcaoExecutada={(alerta) => {
          if (alerta.id === 'fechar_tudo') {
            setAlertasIA([]);
            return;
          }
          setAlertasIA(prev => prev.filter(a => a.id !== alerta.id));
        }}
      />

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                {usuarios.filter(u => u.role === 'admin').length}
              </p>
              <p className="text-sm text-blue-700 font-medium">Administradores</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border-2 border-green-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
                {usuarios.filter(u => u.role === 'user').length}
              </p>
              <p className="text-sm text-green-700 font-medium">Vendedores</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border-2 border-slate-200 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent">
                {usuarios.length}
              </p>
              <p className="text-sm text-slate-700 font-medium">Total de Usuários</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nome ou e-mail..."
              className="pl-10"
              value={filtro.busca}
              onChange={(e) => setFiltro(prev => ({ ...prev, busca: e.target.value }))}
            />
          </div>
          <Select 
            value={filtro.role}
            onValueChange={(value) => setFiltro(prev => ({ ...prev, role: value }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Perfis</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="user">Vendedor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-12">Carregando usuários...</div>
      ) : (
        <TabelaUsuarios
          usuarios={filteredUsuarios}
          vendedores={vendedores}
          onEditar={handleEditar}
          onAlterarRole={handleAlterarRole}
          usuarioAtual={usuarioAtual}
        />
      )}

      {/* MODAL DE FORMULÁRIO */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <UsuarioForm
              usuario={editingUsuario}
              onSave={handleSalvar}
              onCancel={() => {
                setShowForm(false);
                setEditingUsuario(null);
              }}
            />
          </div>
        </div>
      )}

      {filteredUsuarios.length === 0 && !loading && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-xl font-bold text-slate-800">Nenhum usuário encontrado</p>
          <p className="text-slate-600 mt-2">Ajuste os filtros ou convide novos usuários.</p>
        </div>
      )}
    </div>
  );
}
