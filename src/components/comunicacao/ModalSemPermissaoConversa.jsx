import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MessageSquarePlus, X, User, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Modal exibido quando o usuário tenta acessar uma conversa 
 * que não tem permissão (atribuída/fidelizada a outro atendente)
 * 
 * Opções:
 * 1. Iniciar nova conversa (cria nova thread para o usuário atual)
 * 2. Fechar (cancelar)
 */
export default function ModalSemPermissaoConversa({
  isOpen,
  onClose,
  contato,
  atendenteResponsavel,
  motivoBloqueio, // 'atribuida_outro' | 'fidelizada_outro' | 'outro_setor' | 'sem_permissao_integracao'
  onIniciarNovaConversa,
  podeIniciarNova = true
}) {
  const getMensagem = () => {
    switch (motivoBloqueio) {
      case 'atribuida_outro':
        return {
          titulo: "Conversa Atribuída a Outro Atendente",
          descricao: `Esta conversa está atualmente atribuída a ${atendenteResponsavel || 'outro atendente'}. Você não tem permissão para visualizar ou responder.`,
          icone: User
        };
      case 'fidelizada_outro':
        return {
          titulo: "Contato Fidelizado a Outro Atendente",
          descricao: `Este contato está fidelizado a ${atendenteResponsavel || 'outro atendente'}. As conversas dele são gerenciadas por esse atendente.`,
          icone: User
        };
      case 'outro_setor':
        return {
          titulo: "Conversa de Outro Setor",
          descricao: `Esta conversa pertence a um setor diferente do seu. Você não tem acesso a conversas deste setor.`,
          icone: AlertTriangle
        };
      case 'sem_permissao_integracao':
        return {
          titulo: "Sem Permissão para Esta Conexão",
          descricao: "Você não tem permissão para acessar conversas desta conexão WhatsApp.",
          icone: Phone
        };
      default:
        return {
          titulo: "Sem Permissão",
          descricao: "Você não tem permissão para acessar esta conversa.",
          icone: AlertTriangle
        };
    }
  };

  const mensagem = getMensagem();
  const Icone = mensagem.icone;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <Icone className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">{mensagem.titulo}</DialogTitle>
              {contato && (
                <p className="text-sm text-slate-500 mt-1">
                  Contato: <span className="font-medium">{contato.nome || contato.telefone}</span>
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="text-left pt-2">
            {mensagem.descricao}
          </DialogDescription>
        </DialogHeader>

        {atendenteResponsavel && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-sm text-slate-600">
              <span className="font-medium">Atendente responsável:</span>
            </p>
            <Badge variant="secondary" className="mt-1">
              <User className="w-3 h-3 mr-1" />
              {atendenteResponsavel}
            </Badge>
          </div>
        )}

        {podeIniciarNova && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Deseja iniciar uma nova conversa?</strong>
              <br />
              Uma nova conversa será criada e atribuída a você.
            </p>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
          
          {podeIniciarNova && (
            <Button 
              onClick={onIniciarNovaConversa}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              Iniciar Nova Conversa
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}