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
import { normalizarParaComparacao } from "../lib/userMatcher";

export default function AtribuirConversaModal({
  isOpen,
  onClose,
  thread,
  usuario,
  contatoNome = 'Cliente',
  onSuccess,
  atendentesPreCarregados = [] // Lista pré-carregada de atendentes (fallback)
}) {
  const [atendentes, setAtendentes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [busca, setBusca] = useState("");
  const [mensagemTransferencia, setMensagemTransferencia] = useState("");

  useEffect(() => {
    if (isOpen) {
      carregarAtendentes();
      setMensagemTransferencia(`Conversa com ${contatoNome} transferida.`);
    }
  }, [isOpen, contatoNome]);

  const carregarAtendentes = async () => {
    setCarregando(true);
    try {
      // Tentar buscar todos os usuários - SEM NENHUM FILTRO
      let users = [];
      try {
        // Primeiro: tentar list() sem ordenação
        users = await base44.entities.User.list();
        console.log('[AtribuirModal] User.list() retornou:', users?.length || 0);
      } catch (listError) {
        console.warn('[AtribuirModal] User.list() falhou:', listError.message);
        // Fallback 1: tentar filter vazio
        try {
          users = await base44.entities.User.filter({});
          console.log('[AtribuirModal] User.filter() retornou:', users?.length || 0);
        } catch (filterError) {
          console.warn('[AtribuirModal] User.filter() também falhou:', filterError.message);
        }
      }
      
      // Validar usuários - apenas verificar se tem id (sem filtros extras)
      let usuariosValidos = (users || []).filter(u => u && u.id);
      
      // Log detalhado para debug
      console.log('[AtribuirModal] Usuários válidos encontrados:', usuariosValidos.map(u => ({
        id: u.id,
        nome: u.full_name,
        email: u.email,
        role: u.role,
        setor: u.attendant_sector
      })));
      
      // Fallback 2: usar lista pré-carregada se API falhou
      if (usuariosValidos.length === 0 && atendentesPreCarregados.length > 0) {
        console.log('[AtribuirModal] Usando lista pré-carregada:', atendentesPreCarregados.length);
        usuariosValidos = atendentesPreCarregados.filter(u => u && u.id);
      }
      
      console.log('[AtribuirModal] Total de usuários disponíveis para atribuição:', usuariosValidos.length);
      setAtendentes(usuariosValidos);
    } catch (error) {
      console.error('[AtribuirModal] Erro ao carregar usuários:', error);
      // Último fallback: usar lista pré-carregada
      if (atendentesPreCarregados.length > 0) {
        console.log('[AtribuirModal] Usando fallback pré-carregado:', atendentesPreCarregados.length);
        setAtendentes(atendentesPreCarregados.filter(u => u && u.id));
      } else {
        setAtendentes([]);
      }
    } finally {
      setCarregando(false);
    }
  };

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

      await base44.entities.MessageThread.update(thread.id, {
        assigned_user_id: atendenteEscolhido.id,
        assigned_user_name: atendenteEscolhido.full_name,
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

      toast.success(
        thread.assigned_user_id
          ? `✅ Conversa transferida para ${atendenteEscolhido.full_name}`
          : `✅ Conversa atribuída a ${atendenteEscolhido.full_name}`
      );

      onClose();
      if (onSuccess) onSuccess();

    } catch (error) {
      console.error('[AtribuirModal] Erro ao atribuir conversa:', error);
      toast.error(`Erro ao ${thread.assigned_user_id ? 'transferir' : 'atribuir'} conversa: ${error.message}`);
    } finally {
      setAtribuindo(false);
    }
  };

  // Busca robusta usando normalizarParaComparacao (sem acentos, lowercase)
  const atendentesFiltrados = atendentes.filter(a => {
    if (!busca.trim()) return true;
    const termo = normalizarParaComparacao(busca);
    return (
      normalizarParaComparacao(a.full_name || '').includes(termo) ||
      normalizarParaComparacao(a.email || '').includes(termo) ||
      normalizarParaComparacao(a.attendant_sector || '').includes(termo) ||
      normalizarParaComparacao(a.attendant_role || '').includes(termo)
    );
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
            {carregando ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800 truncate">{atendente.full_name || atendente.email}</p>
                        {isAtual && <UserCheck className="w-4 h-4 text-green-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{atendente.email}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {/* Setor */}
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${setorCfg.cor}`}>
                          {setorCfg.emoji} {setorCfg.label}
                        </span>
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