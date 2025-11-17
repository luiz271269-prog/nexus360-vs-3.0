import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Shield, 
  Save, 
  Search, 
  Users as UsersIcon, 
  CheckSquare, 
  Square,
  Loader2,
  Package,
  Plus,
  Edit,
  MoreVertical,
  UserCheck,
  Crown
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import PermissionGuard from '../components/security/PermissionGuard';
import UsuarioForm from '../components/usuarios/UsuarioForm';
import AlertasInteligentesIA from '../components/global/AlertasInteligentesIA';
import BotaoNexusFlutuante from '../components/global/BotaoNexusFlutuante';

// Definição dos módulos e suas telas
const MODULOS_SISTEMA = [
  {
    nome: 'Central de Comunicação',
    key: 'comunicacao',
    icon: '💬',
    telas: [
      {
        nome: 'Central de Comunicação',
        page_key: 'Comunicacao',
        acoes: [
          { key: 'pode_ver_todas_conversas', label: 'Ver todas conversas' },
          { key: 'pode_ver_nao_atribuidas', label: 'Ver conversas não atribuídas' },
          { key: 'pode_criar_contatos', label: 'Criar contatos' },
          { key: 'pode_editar_contatos', label: 'Editar contatos' },
          { key: 'pode_bloquear_contatos', label: 'Bloquear contatos' },
          { key: 'pode_deletar_contatos', label: 'Deletar contatos' },
          { key: 'pode_enviar_mensagens', label: 'Enviar mensagens' },
          { key: 'pode_enviar_midias', label: 'Enviar mídias' },
          { key: 'pode_enviar_audios', label: 'Enviar áudios' },
          { key: 'pode_encaminhar_mensagens', label: 'Encaminhar mensagens' },
          { key: 'pode_apagar_mensagens', label: 'Apagar mensagens' },
          { key: 'pode_transferir_conversas', label: 'Transferir conversas' },
          { key: 'pode_atribuir_conversas', label: 'Atribuir conversas' },
          { key: 'pode_usar_templates', label: 'Usar templates' },
          { key: 'pode_criar_templates', label: 'Criar templates' },
          { key: 'pode_usar_respostas_rapidas', label: 'Usar respostas rápidas' },
          { key: 'pode_criar_respostas_rapidas', label: 'Criar respostas rápidas' },
          { key: 'pode_ver_historico_completo', label: 'Ver histórico completo' },
          { key: 'pode_exportar_conversas', label: 'Exportar conversas' },
          { key: 'pode_acessar_relatorios', label: 'Acessar relatórios' },
          { key: 'pode_configurar_integracao', label: 'Configurar integração' }
        ]
      }
    ]
  },
  {
    nome: 'Módulo de Vendas',
    key: 'vendas',
    icon: '💼',
    telas: [
      { nome: 'Dashboard', page_key: 'Dashboard', acoes: [] },
      { nome: 'Vendedores', page_key: 'Vendedores', acoes: [] },
      { nome: 'Clientes', page_key: 'Clientes', acoes: [] },
      { nome: 'Orçamentos', page_key: 'Orcamentos', acoes: [] },
      { nome: 'Vendas', page_key: 'Vendas', acoes: [] },
      { nome: 'Produtos', page_key: 'Produtos', acoes: [] },
      { nome: 'Agenda', page_key: 'Agenda', acoes: [] }
    ]
  },
  {
    nome: 'Módulo Administrativo',
    key: 'administrativo',
    icon: '⚙️',
    telas: [
      { nome: 'Usuários', page_key: 'Usuarios', acoes: [] },
      { nome: 'Auditoria', page_key: 'Auditoria', acoes: [] },
      { nome: 'System Health', page_key: 'SystemHealth', acoes: [] },
      { nome: 'Importação', page_key: 'Importacao', acoes: [] },
      { nome: 'Matriz de Permissões', page_key: 'GerenciadorPermissoes', acoes: [] }
    ]
  },
  {
    nome: 'Módulo de Analytics',
    key: 'analytics',
    icon: '📊',
    telas: [
      { nome: 'Relatórios', page_key: 'Relatorios', acoes: [] },
      { nome: 'Analytics Avançado', page_key: 'AnalyticsAvancado', acoes: [] },
      { nome: 'KPI Dashboard', page_key: 'KPIDashboard', acoes: [] }
    ]
  }
];

export default function GerenciadorPermissoes() {
  return (
    <PermissionGuard permission="MANAGE_USERS">
      <GerenciadorPermissoesContent />
    </PermissionGuard>
  );
}

function GerenciadorPermissoesContent() {
  const [usuarios, setUsuarios] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [moduloSelecionado, setModuloSelecionado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState('');
  const [alteracoes, setAlteracoes] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [alertasIA, setAlertasIA] = useState([]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const usuarioLogado = await base44.auth.me();
      setUsuarioAtual(usuarioLogado);

      const [users, vendors] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Vendedor.list()
      ]);

      setUsuarios(users || []);
      setVendedores(vendors || []);
      
      // Selecionar primeiro usuário e primeiro módulo por padrão
      if (users && users.length > 0 && !usuarioSelecionado) {
        setUsuarioSelecionado(users[0]);
      }
      if (MODULOS_SISTEMA.length > 0 && !moduloSelecionado) {
        setModuloSelecionado(MODULOS_SISTEMA[0]);
      }

      gerarAlertasIA(users);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
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

  const handlePermissaoChange = (pageKey, acaoKey) => {
    if (!usuarioSelecionado) return;

    const changeKey = `${usuarioSelecionado.id}_${pageKey}_${acaoKey}`;
    setAlteracoes(prev => ({
      ...prev,
      [changeKey]: true
    }));

    setUsuarios(prev => prev.map(u => {
      if (u.id !== usuarioSelecionado.id) return u;

      const updated = { ...u };
      
      if (acaoKey === 'acesso_pagina') {
        if (!updated.paginas_acesso) updated.paginas_acesso = [];
        
        if (updated.paginas_acesso.includes(pageKey)) {
          updated.paginas_acesso = updated.paginas_acesso.filter(p => p !== pageKey);
        } else {
          updated.paginas_acesso = [...updated.paginas_acesso, pageKey];
        }
      } else {
        if (!updated.permissoes_comunicacao) updated.permissoes_comunicacao = {};
        updated.permissoes_comunicacao[acaoKey] = !updated.permissoes_comunicacao[acaoKey];
      }

      return updated;
    }));

    setUsuarioSelecionado(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      
      if (acaoKey === 'acesso_pagina') {
        if (!updated.paginas_acesso) updated.paginas_acesso = [];
        
        if (updated.paginas_acesso.includes(pageKey)) {
          updated.paginas_acesso = updated.paginas_acesso.filter(p => p !== pageKey);
        } else {
          updated.paginas_acesso = [...updated.paginas_acesso, pageKey];
        }
      } else {
        if (!updated.permissoes_comunicacao) updated.permissoes_comunicacao = {};
        updated.permissoes_comunicacao[acaoKey] = !updated.permissoes_comunicacao[acaoKey];
      }

      return updated;
    });
  };

  const handleSalvarTudo = async () => {
    if (Object.keys(alteracoes).length === 0) {
      toast.info('Nenhuma alteração para salvar');
      return;
    }

    setSaving(true);
    try {
      const usuariosModificados = usuarios.filter(u => 
        Object.keys(alteracoes).some(k => k.startsWith(u.id))
      );

      for (const usuario of usuariosModificados) {
        await base44.entities.User.update(usuario.id, {
          paginas_acesso: usuario.paginas_acesso || [],
          permissoes_comunicacao: usuario.permissoes_comunicacao || {}
        });
      }

      setAlteracoes({});
      toast.success(`✅ Permissões salvas com sucesso!`);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast.error('Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarUsuario = async (data) => {
    try {
      if (editingUsuario) {
        await base44.entities.User.update(editingUsuario.id, data);
        toast.success('✅ Usuário atualizado com sucesso!');
      } else {
        await base44.entities.User.create(data);
        toast.success(`✅ Convite enviado para ${data.email} com sucesso!`);
      }
      setShowForm(false);
      setEditingUsuario(null);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast.error('Erro ao salvar usuário. Verifique se o e-mail já não está cadastrado.');
    }
  };

  const handleEditar = (usuario) => {
    setEditingUsuario(usuario);
    setShowForm(true);
  };

  const handleAlterarRole = async (usuario, novoRole) => {
    if (confirm(`Tem certeza que deseja alterar o perfil de ${usuario.full_name}?`)) {
      try {
        await base44.entities.User.update(usuario.id, { role: novoRole });
        toast.success(`✅ Perfil de ${usuario.full_name} alterado com sucesso!`);
        await carregarDados();
      } catch (error) {
        console.error('Erro ao alterar role:', error);
        toast.error('Erro ao alterar perfil do usuário');
      }
    }
  };

  const usuariosFiltrados = usuarios.filter(u => 
    u.full_name?.toLowerCase().includes(busca.toLowerCase()) ||
    u.email?.toLowerCase().includes(busca.toLowerCase())
  );

  const getRoleBadgeColor = (role) => {
    if (role === 'admin') return 'bg-red-100 text-red-700 border-red-300';
    if (role === 'supervisor') return 'bg-blue-100 text-blue-700 border-blue-300';
    return 'bg-green-100 text-green-700 border-green-300';
  };

  const getVendedorStatus = (usuarioEmail) => {
    const isLinked = vendedores.some(v => v.email === usuarioEmail);
    return isLinked
      ? { label: 'Vinculado', color: 'text-green-600' }
      : { label: 'Não Vinculado', color: 'text-amber-600' };
  };

  const temPermissao = (usuario, pageKey, acaoKey) => {
    if (!usuario) return false;
    if (acaoKey === 'acesso_pagina') {
      return usuario.paginas_acesso?.includes(pageKey) || false;
    }
    return usuario.permissoes_comunicacao?.[acaoKey] || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] mx-auto space-y-4">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              Gerenciamento de Usuários e Permissões
            </h1>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                setEditingUsuario(null);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>

            <Button
              onClick={handleSalvarTudo}
              disabled={saving || Object.keys(alteracoes).length === 0}
              className="bg-slate-800 hover:bg-slate-900 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Permissões
                </>
              )}
              {Object.keys(alteracoes).length > 0 && (
                <Badge className="ml-2 bg-red-500 text-white">{Object.keys(alteracoes).length}</Badge>
              )}
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

        {/* CARDS DE ESTATÍSTICAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm">
            <CardContent className="p-4">
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
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm">
            <CardContent className="p-4">
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
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg shadow-lg">
                  <UsersIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent">
                    {usuarios.length}
                  </p>
                  <p className="text-sm text-slate-700 font-medium">Total de Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LAYOUT DE 3 COLUNAS */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* COLUNA 1: USUÁRIOS */}
          <Card className="col-span-3 bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <UsersIcon className="w-5 h-5 text-slate-600" />
                <h2 className="font-semibold text-slate-800">Usuários</h2>
              </div>

              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar usuário..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9 h-9 text-sm bg-slate-50 border-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-1 max-h-[calc(100vh-450px)] overflow-y-auto">
                {usuariosFiltrados.map(usuario => {
                  const isCurrentUser = usuario.id === usuarioAtual?.id;
                  const vendedorStatus = getVendedorStatus(usuario.email);

                  return (
                    <div
                      key={usuario.id}
                      onClick={() => setUsuarioSelecionado(usuario)}
                      className={`group cursor-pointer px-3 py-2.5 rounded-lg transition-all text-sm border ${
                        usuarioSelecionado?.id === usuario.id
                          ? 'bg-blue-50 text-blue-900 font-medium border-blue-200'
                          : 'hover:bg-slate-50 text-slate-700 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate">{usuario.full_name}</span>
                            {isCurrentUser && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{usuario.email}</div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge className={`text-xs ${getRoleBadgeColor(usuario.role)}`}>
                              {usuario.role}
                            </Badge>
                            {usuario.role === 'user' && (
                              <span className={`text-[10px] ${vendedorStatus.color}`}>
                                {vendedorStatus.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              disabled={isCurrentUser}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditar(usuario); }}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {usuario.role === 'user' ? (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAlterarRole(usuario, 'admin'); }}>
                                <Shield className="w-4 h-4 mr-2" />
                                Tornar Admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAlterarRole(usuario, 'user'); }}>
                                <UserCheck className="w-4 h-4 mr-2" />
                                Tornar Vendedor
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* COLUNA 2: MÓDULOS */}
          <Card className="col-span-3 bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-slate-600" />
                <h2 className="font-semibold text-slate-800">Módulos</h2>
              </div>

              <div className="space-y-1 max-h-[calc(100vh-450px)] overflow-y-auto">
                {MODULOS_SISTEMA.map(modulo => (
                  <button
                    key={modulo.key}
                    onClick={() => setModuloSelecionado(modulo)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm ${
                      moduloSelecionado?.key === modulo.key
                        ? 'bg-blue-50 text-blue-900 font-medium border border-blue-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{modulo.icon}</span>
                      <span>{modulo.nome}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* COLUNA 3: TELAS E PERMISSÕES */}
          <Card className="col-span-6 bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Telas e Permissões</h2>
                {usuarioSelecionado && (
                  <Badge className="bg-slate-100 text-slate-700 border border-slate-300">
                    {usuarioSelecionado.full_name}
                  </Badge>
                )}
              </div>

              {!usuarioSelecionado || !moduloSelecionado ? (
                <div className="text-center py-12 text-slate-400">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Selecione um usuário e um módulo</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-450px)] overflow-y-auto">
                  {moduloSelecionado.telas.map(tela => (
                    <div key={tela.page_key} className="border border-slate-200 rounded-lg p-3">
                      {/* Checkbox de acesso à tela */}
                      <div className="flex items-center gap-3 mb-2">
                        <button
                          onClick={() => handlePermissaoChange(tela.page_key, 'acesso_pagina')}
                          className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded transition-colors"
                        >
                          {temPermissao(usuarioSelecionado, tela.page_key, 'acesso_pagina') ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        <span className="font-medium text-slate-800">{tela.nome}</span>
                      </div>

                      {/* Ações específicas (se houver) */}
                      {tela.acoes.length > 0 && (
                        <div className="ml-8 mt-2 space-y-1.5 pl-4 border-l-2 border-slate-200">
                          {tela.acoes.map(acao => (
                            <div key={acao.key} className="flex items-center gap-2">
                              <button
                                onClick={() => handlePermissaoChange(tela.page_key, acao.key)}
                                className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded transition-colors"
                              >
                                {temPermissao(usuarioSelecionado, tela.page_key, acao.key) ? (
                                  <CheckSquare className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                              <span className="text-sm text-slate-600">{acao.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL DE FORMULÁRIO */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <UsuarioForm
              usuario={editingUsuario}
              onSave={handleSalvarUsuario}
              onCancel={() => {
                setShowForm(false);
                setEditingUsuario(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}