import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Building2, Loader2, CheckSquare, Square, Plus, Star, UserCheck, ArrowRightLeft, X } from 'lucide-react';
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
  const setores = React.useMemo(() => {
    const setoresUnicos = new Set();
    usuarios.forEach(u => {
      if (u.attendant_sector) setoresUnicos.add(u.attendant_sector);
    });
    return Array.from(setoresUnicos).sort();
  }, [usuarios]);

  // Usuários (excluindo o atual) - SEM busca, sempre todos
  const usuariosDisponiveis = React.useMemo(() => {
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

    // Modo delegação
    if (mode === 'delegate') {
      if (!selectedOriginUser) {
        toast.error('Selecione o usuário de origem');
        return;
      }

      setResolving(true);
      try {
        const destinos = [];

        // Resolver destinos
        for (const userId of selectedUsers) {
          const user = usuarios.find(u => u.id === userId);
          destinos.push({
            type: 'user',
            user_id: userId,
            name: user?.full_name || 'Usuário'
          });
        }

        for (const sectorName of selectedSectors) {
          destinos.push({
            type: 'sector',
            sector_name: sectorName,
            name: `Setor ${sectorName}`
          });
        }

        for (const groupId of selectedGroups) {
          const grupo = grupos.find(g => g.id === groupId);
          destinos.push({
            type: 'group',
            thread_id: groupId,
            name: grupo?.group_name || 'Grupo'
          });
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

    // Modo compose (enviar mensagens)
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
        // Múltiplos destinatários — resolver TUDO em paralelo
        // Executar em batches de 10 para evitar fan-out excessivo
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
              .catch(err => {
                console.error('[INTERNAL_THREAD] Erro para user', userId, err);
                return null;
              })
          ),
          batchPromises(selectedSectors, sectorName =>
            base44.functions.invoke('getOrCreateSectorThread', { sector_name: sectorName })
              .then(result => {
                const thread = result?.data?.thread || result?.thread;
                if (!thread) return null;
                return { type: 'sector', thread_id: thread.id, sector_name: sectorName, name: `Setor ${sectorName}` };
              })
              .catch(err => {
                console.error('[INTERNAL_THREAD] Erro para setor', sectorName, err);
                return null;
              })
          )
        ]);

        // Grupos já estão em memória — sem chamada extra
        const groupsResults = selectedGroups.map(groupId => {
          const grupo = grupos.find(g => g.id === groupId);
          if (!grupo) return null;
          return { type: 'group', thread_id: groupId, name: grupo.group_name || 'Grupo' };
        });

        const destinations = [...usersResults, ...sectorsResults, ...groupsResults].filter(Boolean);

        const totalSelecionadosOriginal = selectedUsers.length + selectedSectors.length + selectedGroups.length;
        const falhas = totalSelecionadosOriginal - destinations.length;

        if (destinations.length > 0) {
          if (falhas > 0) {
            toast.warning(`⚠️ ${falhas} destinatário(s) não puderam ser resolvidos`);
          }
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

  // Buscar delegações ativas
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
      const resultado = await base44.functions.invoke('removerDelegacao', {
        origem_user_id: selectedOriginUser
      });

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
}