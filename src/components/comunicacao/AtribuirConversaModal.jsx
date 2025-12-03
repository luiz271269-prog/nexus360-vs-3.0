import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Users, Search, Loader2, UserCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function AtribuirConversaModal({
  isOpen,
  onClose,
  thread,
  usuario,
  contatoNome = 'Cliente',
  onSuccess
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
      const users = await base44.entities.User.list();
      const usuariosValidos = (users || []).filter(u => u && u.id);
      setAtendentes(usuariosValidos);
    } catch (error) {
      console.error('[AtribuirModal] Erro ao carregar usuários:', error);
      setAtendentes([]);
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

  const atendentesFiltrados = atendentes.filter(a => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return (
      (a.full_name || '').toLowerCase().includes(termo) ||
      (a.email || '').toLowerCase().includes(termo)
    );
  });

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
              atendentesFiltrados.map((atendente) => (
                <button
                  key={atendente.id}
                  onClick={() => handleAtribuir(atendente.id)}
                  disabled={atribuindo}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors border border-slate-200 hover:border-orange-300"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center text-white font-bold">
                    {(atendente.full_name || atendente.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-800">{atendente.full_name || atendente.email}</p>
                    <p className="text-xs text-slate-500">{atendente.email}</p>
                  </div>
                  {thread && thread.assigned_user_id === atendente.id && (
                    <UserCheck className="w-5 h-5 text-green-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}