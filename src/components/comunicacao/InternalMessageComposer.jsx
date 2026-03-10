import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, Loader2, CheckSquare, Square, Plus, ArrowRightLeft, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import CriarGrupoModal from './CriarGrupoModal';
import UsuarioDisplay from './UsuarioDisplay';

export default function InternalMessageComposer({ open, onClose, currentUser, onSelectDestinations, mode = 'compose', originUserId = null }) {
  const [selectedUsers, setSelectedUsers] = React.useState([]);
  const [selectedSectors, setSelectedSectors] = React.useState([]);
  const [selectedGroups, setSelectedGroups] = React.useState([]);
  const [resolving, setResolving] = React.useState(false);
  const [criarGrupoOpen, setCriarGrupoOpen] = React.useState(false);
  const [selectedOriginUser, setSelectedOriginUser] = React.useState(originUserId || '');
  const [activeTab, setActiveTab] = React.useState('usuarios');

  const { data: usuarios = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['usuarios-internos'],
    queryFn: async () => {
      const resultado = await base44.functions.invoke('listarUsuariosParaAtribuicao', {});
      if (resultado?.data?.success && resultado?.data?.usuarios) {
        return resultado.data.usuarios;
      }
      return [];
    },
    enabled: open,
    staleTime: 2 * 60 * 1000
  });

  const { data: grupos = [], isLoading: loadingGroups, refetch: refetchGroups } = useQuery({
    queryKey: ['grupos-internos'],
    queryFn: async () => {
      const threads = await base44.entities.MessageThread.filter({
        thread_type: 'team_internal',
        is_group_chat: true
      });
      return threads || [];
    },
    enabled: open,
    staleTime: 2 * 60 * 1000
  });

  const setores = React.useMemo(() => {
    const setoresUnicos = new Set();
    usuarios.forEach(u => {
      if (u.attendant_sector) setoresUnicos.add(u.attendant_sector);
    });
    return Array.from(setoresUnicos).sort();
  }, [usuarios]);

  const usuariosDisponiveis = React.useMemo(() => {
    return usuarios.filter(u => u.id !== currentUser?.id);
  }, [usuarios, currentUser?.id]);

  const setorConfig = {
    'vendas': { cor: 'bg-emerald-500', label: 'Vendas', emoji: '💼' },
    'assistencia': { cor: 'bg-blue-500', label: 'Assistência', emoji: '🔧' },
    'financeiro': { cor: 'bg-purple-500', label: 'Financeiro', emoji: '💰' },
    'fornecedor': { cor: 'bg-orange-500', label: 'Fornecedor', emoji: '🏭' },
    'geral': { cor: 'bg-slate-500', label: 'Geral', emoji: '👥' }
  };

  const nivelConfig = {
    'admin': { cor: 'bg-red-500', label: 'Admin' },
    'gerente': { cor: 'bg-purple-600', label: 'Gerente' },
    'coordenador': { cor: 'bg-indigo-500', label: 'Coordenador' },
    'supervisor': { cor: 'bg-blue-600', label: 'Supervisor' },
    'senior': { cor: 'bg-teal-500', label: 'Sênior' },
    'pleno': { cor: 'bg-green-500', label: 'Pleno' },
    'junior': { cor: 'bg-amber-500', label: 'Júnior' }
  };

  const toggleUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleSector = (sectorName) => {
    setSelectedSectors(prev =>
      prev.includes(sectorName) ? prev.filter(s => s !== sectorName) : [...prev, sectorName]
    );
  };

  const toggleGroup = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleConfirm = async () => {
    const totalDestinos = selectedUsers.length + selectedSectors.length + selectedGroups.length;
    if (totalDestinos === 0) {
      toast.error('Selecione pelo menos um destinatário');
      return;
    }

    if (mode === 'delegate') {
      if (!selectedOriginUser) {
        toast.error('Selecione o usuário de origem');
        return;
      }
      setResolving(true);
      try {
        const destinos = [];
        for (const userId of selectedUsers) {
          const user = usuarios.find(u => u.id === userId);
          destinos.push({ type: 'user', user_id: userId, name: user?.full_name || 'Usuário' });
        }
        for (const sectorName of selectedSectors) {
          destinos.push({ type: 'sector', sector_name: sectorName, name: `Setor ${sectorName}` });
        }
        for (const groupId of selectedGroups) {
          const grupo = grupos.find(g => g.id === groupId);
          destinos.push({ type: 'group', thread_id: groupId, name: grupo?.group_name || 'Grupo' });
        }
        const resultado = await base44.functions.invoke('delegarResponsabilidades', {
          origem_user_id: selectedOriginUser,
          destinos
        });
        if (resultado?.data?.success) {
          toast.success(resultado.data.message);
          setSelectedUsers([]);
          setSelectedSectors([]);
          setSelectedGroups([]);
          onClose();
        } else {
          toast.error('Erro ao criar delegação');
        }
      } catch (error) {
        console.error('[DELEGATE] Erro:', error);
        toast.error(`Erro: ${error.message}`);
      } finally {
        setResolving(false);
      }
      return;
    }

    setResolving(true);
    try {
      if (totalDestinos === 1) {
        let thread = null;
        if (selectedUsers.length === 1) {
          const result = await base44.functions.invoke('getOrCreateInternalThread', { target_user_id: selectedUsers[0] });
          thread = result?.data?.thread || result?.thread;
        } else if (selectedSectors.length === 1) {
          const result = await base44.functions.invoke('getOrCreateSectorThread', { sector_name: selectedSectors[0] });
          thread = result?.data?.thread || result?.thread;
        } else if (selectedGroups.length === 1) {
          thread = grupos.find(g => g.id === selectedGroups[0]) || null;
        }
        if (thread) {
          onSelectDestinations({ mode: 'single', thread });
          setSelectedUsers([]);
          setSelectedSectors([]);
          setSelectedGroups([]);
          onClose();
        } else {
          toast.error('Erro ao abrir conversa');
        }
      } else {
        const batchPromises = async (items, fn, batchSize = 10) => {
          const results = [];
          for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(fn));
            results.push(...batchResults);
          }
          return results;
        };

        const [usersResults, sectorsResults] = await Promise.all([
          batchPromises(selectedUsers, userId =>
            base44.functions.invoke('getOrCreateInternalThread', { target_user_id: userId })
              .then(result => {
                const thread = result?.data?.thread || result?.thread;
                if (!thread) return null;
                const user = usuarios.find(u => u.id === userId);
                return { type: 'user', thread_id: thread.id, user_id: userId, name: user?.full_name || 'Usuário' };
              })
              .catch(err => { console.error('[INTERNAL_THREAD] Erro user', userId, err); return null; })
          ),
          batchPromises(selectedSectors, sectorName =>
            base44.functions.invoke('getOrCreateSectorThread', { sector_name: sectorName })
              .then(result => {
                const thread = result?.data?.thread || result?.thread;
                if (!thread) return null;
                return { type: 'sector', thread_id: thread.id, sector_name: sectorName, name: `Setor ${sectorName}` };
              })
              .catch(err => { console.error('[INTERNAL_THREAD] Erro setor', sectorName, err); return null; })
          )
        ]);

        const groupsResults = selectedGroups.map(groupId => {
          const grupo = grupos.find(g => g.id === groupId);
          if (!grupo) return null;
          return { type: 'group', thread_id: groupId, name: grupo.group_name || 'Grupo' };
        });

        const destinations = [...usersResults, ...sectorsResults, ...groupsResults].filter(Boolean);
        const falhas = totalDestinos - destinations.length;

        if (destinations.length > 0) {
          if (falhas > 0) toast.warning(`⚠️ ${falhas} destinatário(s) não puderam ser resolvidos`);
          onSelectDestinations({ mode: 'broadcast', destinations });
          setSelectedUsers([]);
          setSelectedSectors([]);
          setSelectedGroups([]);
          onClose();
        } else {
          toast.error('Todos os destinatários falharam. Verifique a conexão e tente novamente.');
        }
      }
    } catch (err) {
      console.error('Erro ao confirmar seleção:', err);
      toast.error('Erro ao processar seleção');
    } finally {
      setResolving(false);
    }
  };

  const totalSelecionados = selectedUsers.length + selectedSectors.length + selectedGroups.length;

  const { data: delegacoesAtivas = [] } = useQuery({
    queryKey: ['delegacoes-ativas', selectedOriginUser],
    queryFn: async () => {
      if (!selectedOriginUser || mode !== 'delegate') return [];
      const delegacoes = await base44.entities.DelegacaoAcesso.filter({
        origem_user_id: selectedOriginUser,
        status: 'ativa'
      });
      return delegacoes || [];
    },
    enabled: open && mode === 'delegate' && !!selectedOriginUser,
    staleTime: 30 * 1000
  });

  const handleRemoverDelegacao = async () => {
    if (!selectedOriginUser) return;
    try {
      const resultado = await base44.functions.invoke('removerDelegacao', { origem_user_id: selectedOriginUser });
      if (resultado?.data?.success) {
        toast.success(resultado.data.message);
      } else {
        toast.error('Erro ao remover delegação');
      }
    } catch (error) {
      console.error('[REMOVER_DELEGACAO] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[98vw] sm:max-w-4xl h-[92vh] sm:h-[85vh] sm:max-h-[90vh] flex flex-col p-3 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md ${
                  mode === 'delegate'
                    ? 'bg-gradient-to-br from-orange-500 to-amber-600'
                    : 'bg-gradient-to-br from-cyan-500 to-blue-600'
                }`}>
                  {mode === 'delegate' ? (
                    <ArrowRightLeft className="w-5 h-5 text-white" />
                  ) : (
                    <Users className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm sm:text-base">
                    {mode === 'delegate' ? 'Transferir Responsabilidades' : 'Envio Interno - Equipe'}
                  </div>
                  <div className="text-xs font-normal text-slate-500 truncate">
                    {mode === 'delegate'
                      ? (totalSelecionados === 0 ? 'Selecione para quem transferir' : `${totalSelecionados} selecionado(s)`)
                      : (totalSelecionados === 0 ? 'Selecione destinatários' : totalSelecionados === 1 ? '1 destinatário' : `${totalSelecionados} selecionados`)
                    }
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto flex-wrap">
                {mode === 'delegate' && delegacoesAtivas.length > 0 && (
                  <Button
                    onClick={handleRemoverDelegacao}
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-8"
                  >
                    <X className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Remover Delegação</span>
                    <span className="sm:hidden">Remover</span>
                  </Button>
                )}
                <Button
                  onClick={handleConfirm}
                  size="sm"
                  disabled={resolving || totalSelecionados === 0 || (mode === 'delegate' && !selectedOriginUser)}
                  className={`shadow-md text-white text-xs h-8 whitespace-nowrap ${
                    mode === 'delegate'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700'
                  }`}
                >
                  {resolving ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      <span className="hidden sm:inline">{mode === 'delegate' ? 'Transferindo...' : 'Abrindo...'}</span>
                    </>
                  ) : mode === 'delegate' ? (
                    <span className="hidden sm:inline">Transferir</span>
                  ) : totalSelecionados === 1 ? (
                    <span className="hidden sm:inline">Abrir Conversa</span>
                  ) : (
                    <span>Enviar ({totalSelecionados})</span>
                  )}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {mode === 'delegate' && (
            <div className="px-6 pb-3">
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                Usuário que terá suas responsabilidades transferidas:
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                {usuarios.filter(u => u.id !== currentUser?.id).map(usuario => {
                  const isSelected = selectedOriginUser === usuario.id;
                  const setor = usuario.attendant_sector || 'geral';
                  const corAvatar = setorConfig[setor]?.cor || 'bg-slate-500';
                  return (
                    <button
                      key={usuario.id}
                      onClick={() => setSelectedOriginUser(usuario.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'bg-orange-50 border-orange-400 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'
                      }`}
                    >
                      <div className={`w-7 h-7 ${corAvatar} rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                        {(usuario.full_name || usuario.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <UsuarioDisplay
                          usuario={usuario}
                          showRole={false}
                          showSector={false}
                          showAvatar={false}
                          variant="name-only"
                          className="text-xs font-medium text-slate-800 truncate"
                        />
                        <div className="text-[10px] text-slate-500 truncate">{setor}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {delegacoesAtivas.length > 0 && (
                <div className="mt-2 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
                  ⚠️ {delegacoesAtivas.length} delegação(ões) ativa(s)
                </div>
              )}
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Desktop: 3 colunas */}
            <div className="hidden sm:flex flex-1 gap-3 min-h-0">
              {/* Coluna 1: Usuários */}
              <div className="flex-1 flex flex-col border-r border-slate-200 pr-3">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                  <Users className="w-4 h-4 text-cyan-600" />
                  <h3 className="font-semibold text-sm text-slate-700">Usuários ({usuariosDisponiveis.length})</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-0.5">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                    </div>
                  ) : usuariosDisponiveis.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">Nenhum usuário disponível</div>
                  ) : (
                    usuariosDisponiveis.map(usuario => {
                     const isSelected = selectedUsers.includes(usuario.id);
                     const setor = usuario.attendant_sector || 'geral';
                     const nivel = usuario.attendant_role || usuario.role || 'pleno';
                     const setorCfg = setorConfig[setor] || setorConfig['geral'];
                     const nivelCfg = nivelConfig[nivel] || nivelConfig['pleno'];
                     return (
                       <button
                         key={usuario.id}
                         onClick={() => toggleUser(usuario.id)}
                         className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg transition-all text-left border ${
                           isSelected ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                         }`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                          </div>
                          <div className={`w-8 h-8 ${setorCfg.cor} rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
                            {(usuario.full_name || usuario.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <UsuarioDisplay usuario={usuario} showRole={false} showSector={false} showAvatar={false} variant="name-only" className="text-xs font-medium text-slate-700 truncate" />
                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                              <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-medium text-white ${setorCfg.cor}`}>
                                {setorCfg.emoji} {setorCfg.label}
                              </span>
                              <span className="inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-medium text-slate-600 bg-slate-100">
                                {nivelCfg.label}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Coluna 2: Setores */}
              <div className="flex-1 flex flex-col border-r border-slate-200 pr-3">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                  <Building2 className="w-4 h-4 text-cyan-600" />
                  <h3 className="font-semibold text-sm text-slate-700">Setores ({setores.length})</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-0.5">
                  {setores.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">Nenhum setor encontrado</div>
                  ) : (
                    setores.map(setor => {
                      const isSelected = selectedSectors.includes(setor);
                      const usuariosDoSetor = usuarios.filter(u => u.attendant_sector === setor);
                      const setorCfg = setorConfig[setor] || setorConfig['geral'];
                      return (
                        <button
                          key={setor}
                          onClick={() => toggleSector(setor)}
                          className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg transition-all text-left border ${
                            isSelected ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                          </div>
                          <div className={`w-8 h-8 rounded-full ${setorCfg.cor} flex items-center justify-center text-white shadow-sm text-xs font-bold`}>
                            {setorCfg.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-700 truncate text-xs">{setorCfg.emoji} {setorCfg.label}</div>
                            <div className="text-[10px] text-slate-500">{usuariosDoSetor.length} {usuariosDoSetor.length === 1 ? 'membro' : 'membros'}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Coluna 3: Grupos */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                  <Users className="w-4 h-4 text-cyan-600" />
                  <h3 className="font-semibold text-sm text-slate-700">Grupos ({grupos.length})</h3>
                </div>
                <Button
                  onClick={() => setCriarGrupoOpen(true)}
                  variant="outline"
                  size="sm"
                  className="mb-2 w-full border-cyan-200 hover:bg-cyan-50 hover:border-cyan-300 text-xs h-8"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Criar Grupo
                </Button>
                <div className="flex-1 overflow-y-auto space-y-0.5">
                  {loadingGroups ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                    </div>
                  ) : grupos.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">Nenhum grupo criado</div>
                  ) : (
                    grupos.map(grupo => {
                      const isSelected = selectedGroups.includes(grupo.id);
                      return (
                        <button
                          key={grupo.id}
                          onClick={() => toggleGroup(grupo.id)}
                          className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg transition-all text-left border ${
                            isSelected ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white shadow-sm">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-700 truncate text-xs">{grupo.group_name || 'Grupo sem nome'}</div>
                            <div className="text-[10px] text-slate-500">{grupo.participants?.length || 0} {grupo.participants?.length === 1 ? 'membro' : 'membros'}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Mobile: Abas */}
            <div className="sm:hidden flex flex-col flex-1 min-h-0">
              {totalSelecionados > 0 && (
                <div className="flex items-center gap-1 flex-wrap mb-2 px-1">
                  <span className="text-[10px] text-slate-500 font-medium">Selecionados:</span>
                  {selectedUsers.map(uid => {
                    const u = usuarios.find(x => x.id === uid);
                    return (
                      <span key={uid} onClick={() => toggleUser(uid)} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-[10px] cursor-pointer">
                        {(u?.full_name || 'User').split(' ')[0]}
                        <X className="w-2 h-2" />
                      </span>
                    );
                  })}
                  {selectedSectors.map(s => (
                    <span key={s} onClick={() => toggleSector(s)} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] cursor-pointer">
                      {setorConfig[s]?.emoji} {setorConfig[s]?.label || s}
                      <X className="w-2 h-2" />
                    </span>
                  ))}
                  {selectedGroups.map(gid => {
                    const g = grupos.find(x => x.id === gid);
                    return (
                      <span key={gid} onClick={() => toggleGroup(gid)} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[10px] cursor-pointer">
                        {g?.group_name || 'Grupo'}
                        <X className="w-2 h-2" />
                      </span>
                    );
                  })}
                </div>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
                <TabsList className="grid w-full grid-cols-3 h-9 bg-slate-100 rounded-lg mb-2 flex-shrink-0">
                  <TabsTrigger value="usuarios" className="text-[10px] px-1">
                    👥 ({usuariosDisponiveis.length}) {selectedUsers.length > 0 && <span className="ml-1 bg-cyan-500 text-white rounded-full w-4 h-4 inline-flex items-center justify-center text-[8px]">{selectedUsers.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="setores" className="text-[10px] px-1">
                    🏢 ({setores.length}) {selectedSectors.length > 0 && <span className="ml-1 bg-cyan-500 text-white rounded-full w-4 h-4 inline-flex items-center justify-center text-[8px]">{selectedSectors.length}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="grupos" className="text-[10px] px-1">
                    👫 ({grupos.length}) {selectedGroups.length > 0 && <span className="ml-1 bg-cyan-500 text-white rounded-full w-4 h-4 inline-flex items-center justify-center text-[8px]">{selectedGroups.length}</span>}
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 overflow-y-auto">
                  <TabsContent value="usuarios" className="m-0 p-0">
                    <div className="space-y-1">
                      {loadingUsers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-cyan-600" />
                        </div>
                      ) : usuariosDisponiveis.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">Nenhum usuário disponível</div>
                      ) : (
                        usuariosDisponiveis.map(usuario => {
                          const isSelected = selectedUsers.includes(usuario.id);
                          const setor = usuario.attendant_sector || 'geral';
                          const nivel = usuario.attendant_role || usuario.role || 'pleno';
                          const setorCfg = setorConfig[setor] || setorConfig['geral'];
                          const nivelCfg = nivelConfig[nivel] || nivelConfig['pleno'];
                          return (
                            <button
                              key={usuario.id}
                              onClick={() => toggleUser(usuario.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left border text-xs ${
                                isSelected ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-sm' : 'hover:bg-slate-50 border-transparent'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {isSelected ? <CheckSquare className="w-3 h-3 text-cyan-600" /> : <Square className="w-3 h-3 text-slate-300" />}
                              </div>
                              <div className={`w-7 h-7 ${setorCfg.cor} rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm flex-shrink-0`}>
                                {(usuario.full_name || usuario.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <UsuarioDisplay usuario={usuario} showRole={false} showSector={false} showAvatar={false} variant="name-only" className="text-xs font-medium text-slate-700 truncate" />
                                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                  <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-[7px] font-medium text-white ${setorCfg.cor}`}>
                                    {setorCfg.emoji} {setorCfg.label}
                                  </span>
                                  <span className="inline-flex items-center px-1 py-0.5 rounded-full text-[7px] font-medium text-slate-600 bg-slate-100">
                                    {nivelCfg.label}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="setores" className="m-0 p-0">
                    <div className="space-y-1">
                      {setores.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">Nenhum setor encontrado</div>
                      ) : (
                        setores.map(setor => {
                          const isSelected = selectedSectors.includes(setor);
                          const usuariosDoSetor = usuarios.filter(u => u.attendant_sector === setor);
                          const setorCfg = setorConfig[setor] || setorConfig['geral'];
                          return (
                            <button
                              key={setor}
                              onClick={() => toggleSector(setor)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left border text-xs ${
                                isSelected ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-sm' : 'hover:bg-slate-50 border-transparent'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {isSelected ? <CheckSquare className="w-3 h-3 text-cyan-600" /> : <Square className="w-3 h-3 text-slate-300" />}
                              </div>
                              <div className={`w-7 h-7 rounded-full ${setorCfg.cor} flex items-center justify-center text-white shadow-sm text-xs font-bold flex-shrink-0`}>
                                {setorCfg.emoji}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-700 truncate text-xs">{setorCfg.emoji} {setorCfg.label}</div>
                                <div className="text-[10px] text-slate-500">{usuariosDoSetor.length} {usuariosDoSetor.length === 1 ? 'membro' : 'membros'}</div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="grupos" className="m-0 p-0">
                    <div className="space-y-1">
                      <Button
                        onClick={() => setCriarGrupoOpen(true)}
                        variant="outline"
                        size="sm"
                        className="w-full mb-2 border-cyan-200 hover:bg-cyan-50 hover:border-cyan-300 text-xs h-8"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Criar Grupo
                      </Button>
                      {loadingGroups ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-cyan-600" />
                        </div>
                      ) : grupos.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">Nenhum grupo criado</div>
                      ) : (
                        grupos.map(grupo => {
                          const isSelected = selectedGroups.includes(grupo.id);
                          return (
                            <button
                              key={grupo.id}
                              onClick={() => toggleGroup(grupo.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left border text-xs ${
                                isSelected ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-sm' : 'hover:bg-slate-50 border-transparent'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {isSelected ? <CheckSquare className="w-3 h-3 text-cyan-600" /> : <Square className="w-3 h-3 text-slate-300" />}
                              </div>
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                                <Users className="w-3 h-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-700 truncate text-xs">{grupo.group_name || 'Grupo sem nome'}</div>
                                <div className="text-[10px] text-slate-500">{grupo.participants?.length || 0} {grupo.participants?.length === 1 ? 'membro' : 'membros'}</div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>

              {/* Botão confirmar fixo no fundo mobile */}
              <div className="flex-shrink-0 pt-2 border-t border-slate-200 mt-2">
                <Button
                  onClick={handleConfirm}
                  disabled={resolving || totalSelecionados === 0 || (mode === 'delegate' && !selectedOriginUser)}
                  className={`w-full h-11 text-sm font-semibold shadow-md text-white ${
                    mode === 'delegate'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-600'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600'
                  } disabled:opacity-50`}
                >
                  {resolving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{mode === 'delegate' ? 'Transferindo...' : 'Abrindo...'}</>
                  ) : totalSelecionados === 0 ? (
                    'Selecione ao menos 1 destinatário'
                  ) : mode === 'delegate' ? (
                    `Transferir para ${totalSelecionados}`
                  ) : totalSelecionados === 1 ? (
                    'Abrir Conversa'
                  ) : (
                    `Enviar para ${totalSelecionados} destinatários`
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CriarGrupoModal
        open={criarGrupoOpen}
        onClose={() => setCriarGrupoOpen(false)}
        usuarios={usuarios}
        currentUser={currentUser}
        onSuccess={() => {
          refetchGroups();
          toast.success('✅ Grupo criado com sucesso!');
        }}
      />
    </>
  );
}