import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, Loader2, CheckSquare, Square, Plus, Star, UserCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import CriarGrupoModal from './CriarGrupoModal';
import UsuarioDisplay from './UsuarioDisplay';

export default function InternalMessageComposer({ open, onClose, currentUser, onSelectDestinations }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [criarGrupoOpen, setCriarGrupoOpen] = useState(false);

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

  // Usuários (excluindo o atual) - SEM busca, sempre todos
  const usuariosDisponiveis = useMemo(() => {
    return usuarios.filter(u => u.id !== currentUser?.id);
  }, [usuarios, currentUser?.id]);
  
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

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-slate-800">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold">Envio Interno - Equipe</div>
                <div className="text-xs font-normal text-slate-500">
                  {totalSelecionados === 0 
                    ? 'Selecione destinatários' 
                    : totalSelecionados === 1
                      ? '1 destinatário selecionado'
                      : `${totalSelecionados} destinatários selecionados`
                  }
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {/* 3 Colunas Visíveis - Layout WhatsApp */}
            <div className="flex-1 flex gap-3 min-h-0">
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
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Nenhum usuário disponível
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
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left border ${
                            isSelected 
                              ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-sm' 
                              : 'hover:bg-slate-50 border-transparent'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </div>
                          <div className={`w-8 h-8 ${setorCfg.cor} rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
                            {(usuario.full_name || usuario.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-700 truncate">
                              {usuario.full_name || usuario.email}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                              <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-medium text-white ${setorCfg.cor}`}>
                                {setorCfg.emoji}
                              </span>
                              <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-medium text-slate-600 bg-slate-100`}>
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
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Nenhum setor encontrado
                    </div>
                  ) : (
                    setores.map(setor => {
                      const isSelected = selectedSectors.includes(setor);
                      const usuariosDoSetor = usuarios.filter(u => u.attendant_sector === setor);
                      const setorCfg = setorConfig[setor] || setorConfig['geral'];
                      
                      return (
                        <button
                          key={setor}
                          onClick={() => toggleSector(setor)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left border ${
                            isSelected 
                              ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-sm' 
                              : 'hover:bg-slate-50 border-transparent'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </div>
                          <div className={`w-8 h-8 rounded-full ${setorCfg.cor} flex items-center justify-center text-white shadow-sm`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-700 truncate text-xs">
                              {setorCfg.emoji} {setorCfg.label}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {usuariosDoSetor.length} {usuariosDoSetor.length === 1 ? 'membro' : 'membros'}
                            </div>
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
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Nenhum grupo criado
                    </div>
                  ) : (
                    grupos.map(grupo => {
                      const isSelected = selectedGroups.includes(grupo.id);
                      return (
                        <button
                          key={grupo.id}
                          onClick={() => toggleGroup(grupo.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left border ${
                            isSelected 
                              ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-sm' 
                              : 'hover:bg-slate-50 border-transparent'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white shadow-sm">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-700 truncate text-xs">
                              {grupo.group_name || 'Grupo sem nome'}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {grupo.participants?.length || 0} {grupo.participants?.length === 1 ? 'membro' : 'membros'}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

              {/* Botões de Ação */}
              <div className="mt-4 pt-4 border-t border-slate-200 flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={resolving}
                  className="flex-1 border-slate-300 hover:bg-slate-50"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={resolving || totalSelecionados === 0}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-md"
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