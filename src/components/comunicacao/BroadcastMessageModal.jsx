import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Send, Loader2, Users, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function BroadcastMessageModal({
  isOpen,
  onClose,
  contatosSelecionados = [],
  integracaoId,
  usuario
}) {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ enviados: 0, erros: 0, total: 0 });
  const [concluido, setConcluido] = useState(false);

  const handleEnviar = async () => {
    if (!mensagem.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    if (!integracaoId) {
      toast.error("Nenhuma integração WhatsApp disponível");
      return;
    }

    setEnviando(true);
    setConcluido(false);
    setProgresso({ enviados: 0, erros: 0, total: contatosSelecionados.length });

    let enviados = 0;
    let erros = 0;

    for (const contato of contatosSelecionados) {
      const telefone = contato.telefone || contato.celular;
      
      if (!telefone) {
        erros++;
        setProgresso(prev => ({ ...prev, erros }));
        continue;
      }

      try {
        // Usar a função enviarWhatsApp existente para cada contato
        const resultado = await base44.functions.invoke('enviarWhatsApp', {
          integration_id: integracaoId,
          numero_destino: telefone,
          mensagem: mensagem.trim()
        });

        if (resultado.data.success) {
          enviados++;
          
          // Buscar ou criar thread para registrar a mensagem
          let threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
          let thread = threads && threads.length > 0 ? threads[0] : null;
          
          if (!thread) {
            thread = await base44.entities.MessageThread.create({
              contact_id: contato.id,
              whatsapp_integration_id: integracaoId,
              status: 'aberta',
              last_message_content: mensagem.trim().substring(0, 100),
              last_message_at: new Date().toISOString(),
              last_message_sender: 'user'
            });
          } else {
            await base44.entities.MessageThread.update(thread.id, {
              last_message_content: mensagem.trim().substring(0, 100),
              last_message_at: new Date().toISOString(),
              last_message_sender: 'user'
            });
          }

          // Registrar a mensagem na thread
          await base44.entities.Message.create({
            thread_id: thread.id,
            sender_id: usuario?.id || 'system',
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: mensagem.trim(),
            channel: 'whatsapp',
            status: 'enviada',
            whatsapp_message_id: resultado.data.message_id,
            sent_at: new Date().toISOString(),
            metadata: {
              whatsapp_integration_id: integracaoId,
              broadcast: true
            }
          });
        } else {
          erros++;
        }
      } catch (error) {
        console.error(`Erro ao enviar para ${telefone}:`, error);
        erros++;
      }

      setProgresso({ enviados, erros, total: contatosSelecionados.length });
      
      // Pequeno delay entre envios para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setEnviando(false);
    setConcluido(true);
    
    if (enviados > 0) {
      toast.success(`✅ ${enviados} mensagem(ns) enviada(s) com sucesso!`);
    }
    if (erros > 0) {
      toast.error(`❌ ${erros} erro(s) no envio`);
    }
  };

  const handleClose = () => {
    if (!enviando) {
      setMensagem("");
      setProgresso({ enviados: 0, erros: 0, total: 0 });
      setConcluido(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Enviar Mensagem em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lista de destinatários */}
          <div className="bg-slate-50 rounded-lg p-3 border">
            <p className="text-sm font-medium text-slate-700 mb-2">
              Destinatários ({contatosSelecionados.length}):
            </p>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {contatosSelecionados.map((contato) => (
                <span
                  key={contato.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700"
                >
                  {contato.nome || contato.telefone}
                </span>
              ))}
            </div>
          </div>

          {/* Campo de mensagem */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Mensagem:
            </label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite a mensagem que será enviada para todos os contatos selecionados..."
              rows={4}
              disabled={enviando}
              className="resize-none"
            />
          </div>

          {/* Barra de progresso */}
          {(enviando || concluido) && (
            <div className="bg-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {enviando ? "Enviando..." : "Concluído"}
                </span>
                <span className="text-sm text-slate-600">
                  {progresso.enviados + progresso.erros} / {progresso.total}
                </span>
              </div>
              
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                  style={{
                    width: `${((progresso.enviados + progresso.erros) / progresso.total) * 100}%`
                  }}
                />
              </div>
              
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  {progresso.enviados} enviados
                </span>
                {progresso.erros > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-3 h-3" />
                    {progresso.erros} erros
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={enviando}
          >
            {concluido ? "Fechar" : "Cancelar"}
          </Button>
          
          {!concluido && (
            <Button
              onClick={handleEnviar}
              disabled={enviando || !mensagem.trim()}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar para {contatosSelecionados.length} contato(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}