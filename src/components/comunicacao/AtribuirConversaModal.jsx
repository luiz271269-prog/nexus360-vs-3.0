import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Users, Search, Loader2, UserCheck, Building2, Briefcase, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { normalizarParaComparacao } from "../lib/userMatcher";
import UsuarioDisplay from "./UsuarioDisplay";

export default function AtribuirConversaModal({
  isOpen,
  onClose,
  thread,
  usuario,
  contatoNome = 'Cliente',
  onSuccess,
  atendentes = [] // ✅ PROP: Recebe lista de atendentes do pai (Comunicacao.jsx)
}) {
  const queryClient = useQueryClient(); // ✅ Hook do React Query
  const [atribuindo, setAtribuindo] = useState(false);
  const [busca, setBusca] = useState("");
  const [mensagemTransferencia, setMensagemTransferencia] = useState("");

  useEffect(() => {
    if (isOpen) {
      setMensagemTransferencia(`Conversa com ${contatoNome} transferida.`);
    }
  }, [isOpen, contatoNome]);

  const handleAtribuir = async (atendenteId) => {
    if (!thread?.id || !usuario) {
      toast.error("Dados da conversa não disponíveis");
      return;
    }

    setAtribuindo(true);
    try {
      const atendenteEscolhido = atendentes.find((a) => a.id === atendenteId);

      if (!atendenteEscolhido) {
        throw new Error("Atendente não encontrado");
      }

      // ✅ CORREÇÃO: Remover assigned_user_name - buscar dinamicamente via user_id
      await base44.entities.MessageThread.update(thread.id, {
        assigned_user_id: atendenteEscolhido.id,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      });

      await base44.entities.AutomationLog.create({
        acao: thread.assigned_user_id ? 'reatribuicao_manual' : 'atribuicao_manual',
        contato_id: thread.contact_id,
        thread_id: thread.id,
        usuario_id: usuario.id,
        resultado: 'sucesso',
        timestamp: new Date().toISOString(),
        detalhes: {
          mensagem: `Conversa ${thread.assigned_user_id ? 'transferida' : 'atribuída'} para ${atendenteEscolhido.full_name}`,
          atendente_anterior: thread.assigned_user_name || 'Nenhum',
          atendente_novo: atendenteEscolhido.full_name,
          atribuido_por: usuario.full_name
        },
        origem: 'manual',
        prioridade: 'normal'
      });

      const textoMensagem = mensagemTransferencia?.trim() 
        ? `🔔 ${mensagemTransferencia} (→ ${atendenteEscolhido.full_name})`
        : `🔔 Conversa ${thread.assigned_user_id ? 'transferida' : 'atribuída'} para ${atendenteEscolhido.full_name} por ${usuario.full_name}`;

      await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: usuario.id,
        sender_type: 'user',
        recipient_id: thread.contact_id,
        recipient_type: 'contact',
        content: textoMensagem,
        channel: 'interno',
        status: 'enviada',
        sent_at: new Date().toISOString(),
        metadata: {
          is_system_message: true,
          action_type: 'assignment',
          atendente_anterior: thread.assigned_user_name || null,
          atendente_novo: atendenteEscolhido.full_name
        }
      });

      // ✅ INVALIDAÇÃO CRÍTICA: Força atualização imediata da barra lateral
      // IMPORTANTE: Invalidar TODAS as queries relacionadas a threads
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['threads'] }),
        queryClient.invalidateQueries({ queryKey: ['threads-controle'] }),
        queryClient.invalidateQueries({ queryKey: ['mensagens', thread.id] }),
        queryClient.invalidateQueries({ queryKey: ['contacts'] })
      ]);

      toast.success(
        thread.assigned_user_id
          ? `✅ Conversa transferida para ${atendenteEscolhido.full_name}`
          : `✅ Conversa atribuída a ${atendenteEscolhido.full_name}`
      );

      onClose();
      if (onSuccess) await onSuccess(); // ✅ Aguardar callback do pai

    } catch (error) {
      console.error('[AtribuirModal] Erro ao atribuir conversa:', error);
      toast.error(`Erro ao ${thread.assigned_user_id ? 'transferir' : 'atribuir'} conversa: ${error.message}`);
    } finally {
      setAtribuindo(false);
    }
  };

  // ✅ REGRA B: Filtrar por sector_id usando setores_atendidos_ids
  // Se thread tem sector_id, filtrar por ele; senão, mostrar todos
  const atendentesFiltrados = atendentes.filter(a => {
    // Filtro por busca
    if (busca.trim()) {
      const termo = normalizarParaComparacao(busca);
      const match = (
        normalizarParaComparacao(a.full_name || '').includes(termo) ||
        normalizarParaComparacao(a.email || '').includes(termo) ||
        normalizarParaComparacao(a.attendant_sector || '').includes(termo) ||
        normalizarParaComparacao(a.attendant_role || '').includes(termo)
      );
      if (!match) return false;
    }
    
    // Filtro por sector_id (se thread tem setor definido)
    if (thread?.sector_id) {
      const sectorIdMap = {
        'vendas': 'sector_vendas',
        'assistencia': 'sector_assistencia',
        'financeiro': 'sector_financeiro',
        'fornecedor': 'sector_fornecedor',
        'geral': 'sector_geral'
      };
      const sector_id = sectorIdMap[thread.sector_id] || `sector_${thread.sector_id}`;
      
      // Se não tem setores_atendidos_ids, usar fallback attendant_sector
      if (!a.setores_atendidos_ids || a.setores_atendidos_ids.length === 0) {
        return a.attendant_sector === thread.sector_id;
      }
      
      // Filtro correto por sector_id
      return a.setores_atendidos_ids.includes(sector_id);
    }
    
    return true;
  });

  // Configuração de cores por setor
  const setorConfig = {
    'vendas': { cor: 'bg-emerald-500', label: 'Vendas', emoji: '💼' },
    'assistencia': { cor: 'bg-blue-500', label: 'Assistência', emoji: '🔧' },
    'financeiro': { cor: 'bg-purple-500', label: 'Financeiro', emoji: '💰' },
    'fornecedor': { cor: 'bg-orange-500', label: 'Fornecedor', emoji: '🏭' },
    'geral': { cor: 'bg-slate-500', label: 'Geral', emoji: '👥' }
  };

  // Configuração de cores por nível/role
  const nivelConfig = {
    'admin': { cor: 'bg-red-500', label: 'Admin' },
    'gerente': { cor: 'bg-purple-600', label: 'Gerente' },
    'coordenador': { cor: 'bg-indigo-500', label: 'Coordenador' },
    'supervisor': { cor: 'bg-blue-600', label: 'Supervisor' },
    'senior': { cor: 'bg-teal-500', label: 'Sênior' },
    'pleno': { cor: 'bg-green-500', label: 'Pleno' },
    'junior': { cor: 'bg-amber-500', label: 'Júnior' }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            {thread?.assigned_user_id ? 'Transferir Conversa' : 'Atribuir Conversa'}
          </DialogTitle>
          <DialogDescription>
            Selecione um atendente para {thread?.assigned_user_id ? 'transferir' : 'atribuir'} esta conversa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mensagem personalizada */}
          <div>
            <Label className="text-sm text-slate-600">Mensagem de transferência</Label>
            <Input
              value={mensagemTransferencia}
              onChange={(e) => setMensagemTransferencia(e.target.value)}
              placeholder="Mensagem que aparecerá no chat..."
              className="mt-1"
            />
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar atendente..."
              className="pl-10"
            />
          </div>

          {/* Lista de atendentes */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {atendentes.length === 0 ? (
              <p className="text-center text-slate-500 py-4">Nenhum atendente disponível</p>
            ) : atendentesFiltrados.length === 0 ? (
              <p className="text-center text-slate-500 py-4">Nenhum atendente encontrado</p>
            ) : (
              atendentesFiltrados.map((atendente) => {
                const setor = atendente.attendant_sector || 'geral';
                const nivel = atendente.attendant_role || atendente.role || 'pleno';
                const setorCfg = setorConfig[setor] || setorConfig['geral'];
                const nivelCfg = nivelConfig[nivel] || nivelConfig['pleno'];
                const isAtual = thread && thread.assigned_user_id === atendente.id;

                return (
                  <button
                    key={atendente.id}
                    onClick={() => handleAtribuir(atendente.id)}
                    disabled={atribuindo || isAtual}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors border ${
                      isAtual 
                        ? 'bg-green-50 border-green-300 cursor-not-allowed' 
                        : 'hover:bg-orange-50 border-slate-200 hover:border-orange-300'
                    }`}
                  >
                    <div className={`w-10 h-10 ${setorCfg.cor} rounded-full flex items-center justify-center text-white font-bold shadow-md`}>
                      {(atendente.full_name || atendente.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <UsuarioDisplay usuario={atendente} className="flex-1 min-w-0" />
                        {isAtual && <UserCheck className="w-4 h-4 text-green-500 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Nível */}
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${nivelCfg.cor}`}>
                          {nivelCfg.label}
                        </span>
                        {/* Admin badge */}
                        {atendente.role === 'admin' && (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}