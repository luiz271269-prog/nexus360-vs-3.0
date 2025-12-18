import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, Loader2, CheckSquare, Square, Plus, Search, Star, UserCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import CriarGrupoModal from './CriarGrupoModal';
import UsuarioDisplay from './UsuarioDisplay';
import { normalizarParaComparacao } from '../lib/userMatcher';

export default function InternalMessageComposer({ open, onClose, currentUser, onSelectDestinations }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [criarGrupoOpen, setCriarGrupoOpen] = useState(false);
  const [busca, setBusca] = useState('');

  // Buscar todos os usuários via função (igual ao AtribuirConversaModal)
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

  // Buscar grupos customizados (MessageThread com is_group_chat=true e thread_type='team_internal')
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

  // Extrair setores únicos
  const setores = useMemo(() => {
    const setoresUnicos = new Set();
    usuarios.forEach(u => {
      if (u.attendant_sector) setoresUnicos.add(u.attendant_sector);
    });
    return Array.from(setoresUnicos).sort();
  }, [usuarios]);

  // Usuários (excluindo o atual) + Filtro de busca (igual ao AtribuirConversaModal)
  const usuariosDisponiveis = useMemo(() => {
    let filtered = usuarios.filter(u => u.id !== currentUser?.id);
    
    // Aplicar busca
    if (busca.trim()) {
      const termo = normalizarParaComparacao(busca);
      filtered = filtered.filter(a => {
        return (
          normalizarParaComparacao(a.full_name || '').includes(termo) ||
          normalizarParaComparacao(a.email || '').includes(termo) ||
          normalizarParaComparacao(a.attendant_sector || '').includes(termo) ||
          normalizarParaComparacao(a.attendant_role || '').includes(termo)
        );
      });
    }
    
    return filtered;
  }, [usuarios, currentUser?.id, busca]);
  
  // Configuração de cores por setor (igual ao AtribuirConversaModal)
  const setorConfig = {
    'vendas': { cor: 'bg-emerald-500', label: 'Vendas', emoji: '💼' },
    'assistencia': { cor: 'bg-blue-500', label: 'Assistência', emoji: '🔧' },
    'financeiro': { cor: 'bg-purple-500', label: 'Financeiro', emoji: '💰' },
    'fornecedor': { cor: 'bg-orange-500', label: 'Fornecedor', emoji: '🏭' },
    'geral': { cor: 'bg-slate-500', label: 'Geral', emoji: '👥' }
  };

  // Configuração de cores por nível (igual ao AtribuirConversaModal)
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

    setResolving(true);

    try {
      // Se for seleção única, abrir thread diretamente
      if (totalDestinos === 1) {
        let thread = null;

        if (selectedUsers.length === 1) {
          const result = await base44.functions.invoke('getOrCreateInternalThread', {
            target_user_id: selectedUsers[0]
          });
          thread = result?.data?.thread || result?.thread;
        } else if (selectedSectors.length === 1) {
          const result = await base44.functions.invoke('getOrCreateSectorThread', {
            sector_name: selectedSectors[0]
          });
          thread = result?.data?.thread || result?.thread;
        } else if (selectedGroups.length === 1) {
          const threads = await base44.entities.MessageThread.filter({ id: selectedGroups[0] });
          thread = threads?.[0];
        }

        if (thread) {
          onSelectDestinations({
            mode: 'single',
            thread: thread
          });
          
          // Limpar seleção
          setSelectedUsers([]);
          setSelectedSectors([]);
          setSelectedGroups([]);
          onClose();
        } else {
          toast.error('Erro ao abrir conversa');
        }
      } else {
        // Múltiplos destinatários - preparar lista para broadcast
        const destinations = [];

        // Resolver usuários
        for (const userId of selectedUsers) {
          const result = await base44.functions.invoke('getOrCreateInternalThread', {
            target_user_id: userId
          });
          const thread = result?.data?.thread || result?.thread;
          if (thread) {
            const user = usuarios.find(u => u.id === userId);
            destinations.push({
              type: 'user',
              thread_id: thread.id,
              user_id: userId,
              name: user?.full_name || 'Usuário'
            });
          }
        }

        // Resolver setores
        for (const sectorName of selectedSectors) {
          const result = await base44.functions.invoke('getOrCreateSectorThread', {
            sector_name: sectorName
          });
          const thread = result?.data?.thread || result?.thread;
          if (thread) {
            destinations.push({
              type: 'sector',
              thread_id: thread.id,
              sector_name: sectorName,
              name: `Setor ${sectorName}`
            });
          }
        }

        // Resolver grupos
        for (const groupId of selectedGroups) {
          const threads = await base44.entities.MessageThread.filter({ id: groupId });
          const thread = threads?.[0];
          if (thread) {
            destinations.push({
              type: 'group',
              thread_id: groupId,
              name: thread.group_name || 'Grupo'
            });
          }
        }

        if (destinations.length > 0) {
          onSelectDestinations({
            mode: 'broadcast',
            destinations: destinations
          });
          
          // Limpar seleção
          setSelectedUsers([]);
          setSelectedSectors([]);
          setSelectedGroups([]);
          onClose();
        } else {
          toast.error('Erro ao resolver destinatários');
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

  // Resetar busca ao fechar
  React.useEffect(() => {
    if (!open) {
      setBusca('');
    }
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Envio Interno - Equipe / Setor
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex gap-4 min-h-0">
            {/* Painel Esquerdo - Seleção de Destinatários */}
            <div className="w-1/2 flex flex-col border-r border-slate-200 pr-4">
              <Tabs defaultValue="usuarios" className="flex-1 flex flex-col min-h-0" onValueChange={() => setBusca('')}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="usuarios">
                    <Users className="w-4 h-4 mr-2" />
                    Usuários ({usuariosDisponiveis.length})
                  </TabsTrigger>
                  <TabsTrigger value="setores">
                    <Building2 className="w-4 h-4 mr-2" />
                    Setores ({setores.length})
                  </TabsTrigger>
                  <TabsTrigger value="grupos">
                    <Users className="w-4 h-4 mr-2" />
                    Grupos ({grupos.length})
                  </TabsTrigger>
                </TabsList>

                {/* Aba Usuários */}
                <TabsContent value="usuarios" className="flex-1 flex flex-col overflow-hidden mt-3">
                  {/* Busca (igual ao AtribuirConversaModal) */}
                  <div className="relative mb-2 px-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar atendente..."
                      className="pl-10"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1">
                    {loadingUsers ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                      </div>
                    ) : usuariosDisponiveis.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-sm">
                        {busca.trim() ? 'Nenhum atendente encontrado' : 'Nenhum usuário disponível'}
                      </div>
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
                            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left border ${
                              isSelected 
                                ? 'bg-purple-100 border-purple-400' 
                                : 'hover:bg-purple-50 border-transparent'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-purple-600" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className={`w-10 h-10 ${setorCfg.cor} rounded-full flex items-center justify-center text-white font-bold shadow-md`}>
                              {(usuario.full_name || usuario.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <UsuarioDisplay usuario={usuario} className="flex-1 min-w-0 text-sm" />
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${nivelCfg.cor}`}>
                                  {nivelCfg.label}
                                </span>
                                {usuario.role === 'admin' && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-100">
                                    <Star className="w-2.5 h-2.5" /> Admin
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </TabsContent>

                {/* Aba Setores */}
                <TabsContent value="setores" className="flex-1 overflow-y-auto mt-3 space-y-1">
                  {setores.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      Nenhum setor encontrado
                    </div>
                  ) : (
                    setores.map(setor => {
                      const isSelected = selectedSectors.includes(setor);
                      const usuariosDoSetor = usuarios.filter(u => u.attendant_sector === setor);
                      
                      return (
                        <button
                          key={setor}
                          onClick={() => toggleSector(setor)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left ${
                            isSelected 
                              ? 'bg-indigo-100 border-2 border-indigo-400' 
                              : 'hover:bg-indigo-50 border-2 border-transparent'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-indigo-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white shadow-md">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800 truncate text-sm">
                              Setor {setor}
                            </div>
                            <div className="text-xs text-slate-500">
                              {usuariosDoSetor.length} {usuariosDoSetor.length === 1 ? 'membro' : 'membros'}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </TabsContent>

                {/* Aba Grupos Customizados */}
                <TabsContent value="grupos" className="flex-1 flex flex-col mt-3">
                  <Button
                    onClick={() => setCriarGrupoOpen(true)}
                    variant="outline"
                    size="sm"
                    className="mb-3 w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Novo Grupo
                  </Button>

                  <div className="flex-1 overflow-y-auto space-y-1">
                    {loadingGroups ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                      </div>
                    ) : grupos.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-sm">
                        Nenhum grupo criado
                      </div>
                    ) : (
                      grupos.map(grupo => {
                        const isSelected = selectedGroups.includes(grupo.id);
                        return (
                          <button
                            key={grupo.id}
                            onClick={() => toggleGroup(grupo.id)}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left ${
                              isSelected 
                                ? 'bg-emerald-100 border-2 border-emerald-400' 
                                : 'hover:bg-emerald-50 border-2 border-transparent'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-md">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-800 truncate text-sm">
                                {grupo.group_name || 'Grupo sem nome'}
                              </div>
                              <div className="text-xs text-slate-500">
                                {grupo.participants?.length || 0} {grupo.participants?.length === 1 ? 'membro' : 'membros'}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Painel Direito - Resumo e Confirmação */}
            <div className="w-1/2 flex flex-col justify-between">
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Selecionados</h3>
                  <p className="text-sm text-slate-500">
                    {totalSelecionados === 0 
                      ? 'Nenhum destinatário selecionado' 
                      : totalSelecionados === 1
                        ? 'Abrirá conversa com 1 destinatário'
                        : `Enviará mensagem para ${totalSelecionados} destinatários`
                    }
                  </p>
                </div>
                
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {selectedUsers.map(userId => {
                    const usuario = usuarios.find(u => u.id === userId);
                    return (
                      <div key={userId} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-semibold shadow-md">
                          {usuario?.full_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{usuario?.full_name || 'Usuário'}</p>
                          {usuario?.attendant_sector && (
                            <p className="text-xs text-slate-500">{usuario.attendant_sector}</p>
                          )}
                        </div>
                        <button 
                          onClick={() => toggleUser(userId)} 
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  
                  {selectedSectors.map(setor => {
                    const usuariosDoSetor = usuarios.filter(u => u.attendant_sector === setor);
                    return (
                      <div key={setor} className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white shadow-md">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">Setor {setor}</p>
                          <p className="text-xs text-slate-500">
                            {usuariosDoSetor.length} {usuariosDoSetor.length === 1 ? 'membro' : 'membros'}
                          </p>
                        </div>
                        <button 
                          onClick={() => toggleSector(setor)} 
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Building2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  
                  {selectedGroups.map(groupId => {
                    const grupo = grupos.find(g => g.id === groupId);
                    return (
                      <div key={groupId} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-md">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{grupo?.group_name || 'Grupo'}</p>
                          <p className="text-xs text-slate-500">
                            {grupo?.participants?.length || 0} {grupo?.participants?.length === 1 ? 'membro' : 'membros'}
                          </p>
                        </div>
                        <button 
                          onClick={() => toggleGroup(groupId)} 
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={resolving}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={resolving || totalSelecionados === 0}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  {resolving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Abrindo...
                    </>
                  ) : totalSelecionados === 1 ? (
                    'Abrir Conversa'
                  ) : (
                    `Enviar para ${totalSelecionados}`
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