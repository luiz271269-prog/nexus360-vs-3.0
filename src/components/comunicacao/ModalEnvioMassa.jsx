import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function ModalEnvioMassa({ isOpen, onClose, contatosSelecionados, onEnvioCompleto }) {
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    if (!mensagem.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }

    if (!contatosSelecionados.length) {
      toast.error('Nenhum contato selecionado');
      return;
    }

    const confirmacao = window.confirm(
      `📤 Enviar mensagem para ${contatosSelecionados.length} contato(s)?\n\n` +
      `Mensagem: "${mensagem.slice(0, 50)}..."\n\n` +
      `Tempo estimado: ${Math.ceil(contatosSelecionados.length * 0.5)}s`
    );

    if (!confirmacao) return;

    setEnviando(true);
    const resultados = { sucesso: 0, erro: 0, erros: [] };

    try {
      toast.loading(`📤 Enviando para ${contatosSelecionados.length} contatos...`, { id: 'envio-massa' });

      for (const contato of contatosSelecionados) {
        try {
          // Buscar thread do contato
          const threads = await base44.entities.MessageThread.filter({
            contact_id: contato.contact_id || contato.id,
            is_canonical: true,
            thread_type: 'contact_external'
          }, '-last_message_at', 1);

          if (!threads.length) {
            throw new Error('Thread não encontrada');
          }

          const thread = threads[0];

          // Personalizar mensagem
          let mensagemPersonalizada = mensagem
            .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
            .replace(/\{\{empresa\}\}/gi, contato.empresa || '');

          // Enviar via função unificada
          await base44.functions.invoke('enviarMensagemUnificada', {
            thread_id: thread.id,
            texto: mensagemPersonalizada,
            integration_id: thread.whatsapp_integration_id
          });

          resultados.sucesso++;

          // Anti-rate-limit
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          resultados.erro++;
          resultados.erros.push({
            nome: contato.nome,
            erro: error.message
          });
          console.error(`Erro ao enviar para ${contato.nome}:`, error);
        }
      }

      // Resultado final
      if (resultados.sucesso > 0) {
        toast.success(
          `✅ ${resultados.sucesso} mensagem(s) enviada(s)!` +
          (resultados.erro > 0 ? `\n⚠️ ${resultados.erro} erro(s)` : ''),
          { id: 'envio-massa', duration: 5000 }
        );
      } else {
        toast.error(`❌ Nenhuma mensagem enviada (${resultados.erro} erros)`, { id: 'envio-massa' });
      }

      if (resultados.sucesso > 0 && onEnvioCompleto) {
        onEnvioCompleto();
      }

      if (resultados.sucesso > 0) {
        setMensagem('');
        onClose();
      }

    } catch (error) {
      console.error('[ModalEnvioMassa] Erro geral:', error);
      toast.error(`❌ ${error.message}`, { id: 'envio-massa' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Envio em Massa
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-blue-600 text-white">
              {contatosSelecionados.length} contato(s) selecionado(s)
            </Badge>
          </div>
        </DialogHeader>

        {/* Lista de contatos selecionados (preview) */}
        <div className="max-h-32 overflow-y-auto border rounded-lg p-3 bg-slate-50">
          <div className="flex flex-wrap gap-1.5">
            {contatosSelecionados.slice(0, 10).map((c) => (
              <Badge key={c.contact_id || c.id} variant="outline" className="text-xs">
                {c.nome || c.empresa}
              </Badge>
            ))}
            {contatosSelecionados.length > 10 && (
              <Badge variant="outline" className="text-xs bg-slate-200">
                +{contatosSelecionados.length - 10} mais
              </Badge>
            )}
          </div>
        </div>

        {/* Campo de mensagem */}
        <div className="space-y-2">
          <Label htmlFor="mensagem">Mensagem *</Label>
          <Textarea
            id="mensagem"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Digite sua mensagem aqui...&#10;&#10;Use {{nome}} e {{empresa}} para personalizar.&#10;&#10;Ex: Olá {{nome}}! Temos novidades para você..."
            rows={6}
            className="resize-none"
          />
          <p className="text-xs text-slate-500">
            💡 Placeholders disponíveis: <code className="bg-slate-100 px-1 rounded">{'{{nome}}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{{empresa}}'}</code>
          </p>
          <p className="text-xs text-slate-600">
            {mensagem.length} caracteres
          </p>
        </div>

        {/* Preview da mensagem personalizada */}
        {mensagem && contatosSelecionados.length > 0 && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs font-semibold text-green-800 mb-1">
              📝 Preview (primeiro contato):
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {mensagem
                .replace(/\{\{nome\}\}/gi, contatosSelecionados[0].nome || 'Cliente')
                .replace(/\{\{empresa\}\}/gi, contatosSelecionados[0].empresa || '')}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleEnviar}
            disabled={enviando || !mensagem.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {enviando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar para {contatosSelecionados.length}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}