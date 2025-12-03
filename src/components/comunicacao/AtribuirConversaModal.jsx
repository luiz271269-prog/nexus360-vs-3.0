import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Users, Loader2, Search, UserCheck, CheckSquare } from "lucide-react";
import { toast } from "sonner";

export default function AtribuirConversaModal({
  isOpen,
  onClose,
  thread,
  usuario,
  contatoNome,
  onSuccess
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [busca, setBusca] = useState("");
  const [mensagemTransferencia, setMensagemTransferencia] = useState("");

  // Carregar TODOS os usuários quando abrir o modal
  useEffect(() => {
    if (isOpen) {
      carregarTodosUsuarios();
      setMensagemTransferencia(`Conversa com ${contatoNome || 'Cliente'} transferida.`);
    }
  }, [isOpen, contatoNome]);

  const carregarTodosUsuarios = async () => {
    setCarregando(true);
    try {
      // REGRA: Tela de transferência mostra TODOS os atendentes (is_whatsapp_attendant = true)
      const atendentes = await base44.entities.User.filter({ is_whatsapp_attendant: true });
      
      console.log('[AtribuirModal] Atendentes carregados:', atendentes?.length || 0);
      
      // Filtrar apenas atendentes válidos (com id)
      const atendentesValidos = (atendentes || []).filter(u => u && u.id);
      
      console.log('[AtribuirModal] Atendentes válidos:', atendentesValidos.length);
      setUsuarios(atendentesValidos);
      
      if (atendentesValidos.length === 0) {
        toast.warning("Nenhum atendente encontrado no sistema");
      }
    } catch (error) {
      console.error('[AtribuirModal] Erro ao carregar:', error);
      toast.error("Erro ao carregar atendentes");
      setUsuarios([]);
    } finally {
      setCarregando(false);
    }
  };

  const handleAtribuir = async (usuarioSelecionado) => {
    if (!thread || !usuarioSelecionado) {
      toast.error("Dados inválidos");
      return;
    }

    setAtribuindo(true);
    try {
      // Atualizar thread
      await base44.entities.MessageThread.update(thread.id, {
        assigned_user_id: usuarioSelecionado.id,
        assigned_user_name: usuarioSelecionado.full_name || usuarioSelecionado.email,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      });

      // Criar mensagem de sistema
      const textoMensagem = mensagemTransferencia?.trim() 
        ? `🔔 ${mensagemTransferencia} (→ ${usuarioSelecionado.full_name || usuarioSelecionado.email})`
        : `🔔 Conversa transferida para ${usuarioSelecionado.full_name || usuarioSelecionado.email}`;

      await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: usuario?.id || 'system',
        sender_type: 'user',
        recipient_id: thread.contact_id,
        recipient_type: 'contact',
        content: textoMensagem,
        channel: 'interno',
        status: 'enviada',
        sent_at: new Date().toISOString(),
        metadata: {
          is_system_message: true,
          action_type: 'assignment'
        }
      });

      toast.success(`✅ Conversa transferida para ${usuarioSelecionado.full_name || usuarioSelecionado.email}`);
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('[AtribuirModal] Erro ao atribuir:', error);
      toast.error("Erro ao transferir conversa: " + error.message);
    } finally {
      setAtribuindo(false);
    }
  };

  // Filtrar usuários pela busca
  const usuariosFiltrados = usuarios.filter(u => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return (
      (u.full_name && u.full_name.toLowerCase().includes(termo)) ||
      (u.email && u.email.toLowerCase().includes(termo))
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Transferir Conversa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Atendente atual */}
          {thread?.assigned_user_name && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
              <span className="text-xs text-slate-500">Atendente atual:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                <UserCheck className="w-3 h-3" />
                {thread.assigned_user_name}
              </span>
            </div>
          )}

          {/* Mensagem de transferência */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Mensagem de transferência:
            </label>
            <textarea
              value={mensagemTransferencia}
              onChange={(e) => setMensagemTransferencia(e.target.value)}
              placeholder="Ex: Cliente aguardando retorno..."
              className="w-full p-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={2}
            />
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar usuário..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Lista de usuários */}
          {carregando ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <span className="ml-2 text-slate-600">Carregando usuários...</span>
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Nenhum usuário encontrado</p>
              <p className="text-xs mt-1">Total carregado: {usuarios.length}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={carregarTodosUsuarios}
              >
                Recarregar Lista
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">
                {usuariosFiltrados.length} usuário(s) disponível(is)
              </p>
              
              {usuariosFiltrados.map((u) => {
                const isAtual = thread?.assigned_user_id === u.id;
                const nome = u.full_name || u.email || 'Usuário sem nome';
                
                return (
                  <button
                    key={u.id}
                    onClick={() => handleAtribuir(u)}
                    disabled={atribuindo || isAtual}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isAtual
                        ? 'bg-green-50 border-green-300 cursor-not-allowed'
                        : 'hover:bg-orange-50 hover:border-orange-300 border-slate-200'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      isAtual ? 'bg-green-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'
                    }`}>
                      {isAtual ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        nome.charAt(0).toUpperCase()
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{nome}</p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      {u.attendant_sector && (
                        <span className="text-[10px] text-slate-400">
                          Setor: {u.attendant_sector}
                        </span>
                      )}
                    </div>
                    
                    {isAtual && (
                      <span className="text-xs text-green-600 font-medium">Atual</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}