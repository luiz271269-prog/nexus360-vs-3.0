import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, Loader2, CheckSquare, Square, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function CriarGrupoModal({ open, onClose, usuarios = [], currentUser, onSuccess }) {
  const [groupName, setGroupName] = React.useState('');
  const [selectedMembers, setSelectedMembers] = React.useState([]);
  const [creating, setCreating] = React.useState(false);

  // Filtrar usuários disponíveis (excluir usuário atual)
  const usuariosDisponiveis = usuarios.filter(u => u.id !== currentUser?.id);

  const toggleMember = (userId) => {
    setSelectedMembers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Digite um nome para o grupo');
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error('Selecione pelo menos 1 membro');
      return;
    }

    setCreating(true);

    try {
      // Incluir usuário atual sempre nos participantes
      const participants = [currentUser.id, ...selectedMembers];

      // Criar thread de grupo
      const novoGrupo = await base44.entities.MessageThread.create({
        thread_type: 'team_internal',
        is_group_chat: true,
        group_name: groupName.trim(),
        participants: participants,
        status: 'aberta',
        last_message_content: `Grupo "${groupName.trim()}" criado`,
        last_message_at: new Date().toISOString(),
        last_message_sender: 'user'
      });

      // Criar mensagem de sistema informando criação
      await base44.entities.Message.create({
        thread_id: novoGrupo.id,
        sender_id: currentUser.id,
        sender_type: 'user',
        content: `🎉 Grupo "${groupName.trim()}" criado por ${currentUser.full_name || 'você'}`,
        channel: 'interno',
        provider: 'internal_system',
        status: 'enviada',
        sent_at: new Date().toISOString(),
        metadata: {
          is_system_message: true,
          message_type: 'group_created',
          created_by: currentUser.full_name
        }
      });

      // Resetar e chamar callback
      setGroupName('');
      setSelectedMembers([]);
      onClose();
      
      if (onSuccess) {
        onSuccess(novoGrupo);
      }
    } catch (err) {
      console.error('Erro ao criar grupo:', err);
      toast.error('Erro ao criar grupo: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Criar Grupo Interno
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome do Grupo */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Nome do Grupo
            </label>
            <Input
              placeholder="Ex: Equipe de Vendas SP"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={creating}
            />
          </div>

          {/* Seleção de Membros */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Membros ({selectedMembers.length} selecionado{selectedMembers.length !== 1 ? 's' : ''})
            </label>
            <div className="max-h-64 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2 bg-slate-50">
              {usuariosDisponiveis.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Nenhum usuário disponível
                </p>
              ) : (
                usuariosDisponiveis.map(usuario => {
                  const isSelected = selectedMembers.includes(usuario.id);
                  return (
                    <button
                      key={usuario.id}
                      onClick={() => toggleMember(usuario.id)}
                      disabled={creating}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left ${
                        isSelected 
                          ? 'bg-emerald-100 border border-emerald-300' 
                          : 'hover:bg-white border border-transparent'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                        {usuario.full_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate text-xs">
                          {usuario.full_name || 'Sem nome'}
                        </div>
                        {usuario.attendant_sector && (
                          <div className="text-[10px] text-slate-500">
                            {usuario.attendant_sector}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creating}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !groupName.trim() || selectedMembers.length === 0}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Criar Grupo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}