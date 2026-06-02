import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Loader2, Send, Reply } from 'lucide-react';
import { toast } from 'sonner';

// Modal ÚNICO de e-mail. Dois modos:
// 1) NOVO (sem thread): compõe e envia via iniciarEmailNovo.
// 2) RESPOSTA (thread de e-mail aberta): responde via responderEmailGmail.
// Mesmo botão de cima serve aos dois — sem envio pelo campo de mensagem.
export default function NovoEmailModal({ aberto, thread = null, onClose, onEnviado }) {
  const isResposta = thread?.channel === 'email';

  const [contas, setContas] = useState([]);
  const [contaId, setContaId] = useState('');
  const [para, setPara] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;

    setCorpo('');

    if (isResposta) {
      // Modo resposta: destinatário/assunto vêm da conversa (apenas exibição).
      const destino = thread?.contato?.email || '';
      const baseAssunto = thread?.email_subject_key || thread?.last_message_content || '';
      setPara(destino);
      setAssunto(baseAssunto ? (/^re:/i.test(baseAssunto) ? baseAssunto : `Re: ${baseAssunto}`) : '');
      return;
    }

    // Modo novo: pré-preenche destinatário com o e-mail do contato (se houver).
    setPara(thread?.contato?.email || ''); setAssunto('');
    base44.entities.EmailAccount.filter({ outbound_enabled: true }, '-is_default_outbound', 50)
      .then((lista) => {
        const ativas = (lista || []).filter((c) => c.status !== 'inactive');
        setContas(ativas);
        const padrao = ativas.find((c) => c.is_default_outbound) || ativas[0];
        if (padrao) setContaId(padrao.id);
      })
      .catch(() => setContas([]));
  }, [aberto, isResposta, thread?.id]);

  const handleEnviar = async () => {
    if (!corpo.trim()) { toast.error('Escreva a mensagem'); return; }

    setEnviando(true);
    try {
      if (isResposta) {
        const resp = await base44.functions.invoke('responderEmailGmail', {
          thread_id: thread.id,
          content: corpo.trim()
        });
        const data = resp?.data || resp;
        if (data?.success || data?.ok) {
          toast.success('✅ E-mail enviado!');
          setCorpo('');
          onEnviado?.(thread.id);
          onClose?.();
        } else {
          throw new Error(data?.error || 'Falha ao enviar');
        }
        return;
      }

      // Modo novo
      if (!contaId) { toast.error('Selecione a caixa remetente'); return; }
      if (!para.trim()) { toast.error('Informe o destinatário'); return; }
      const resp = await base44.functions.invoke('iniciarEmailNovo', {
        email_account_id: contaId,
        to: para.trim(),
        subject: assunto,
        body: corpo
      });
      const data = resp?.data || resp;
      if (data?.ok) {
        toast.success('✅ E-mail enviado!');
        setPara(''); setAssunto(''); setCorpo('');
        onEnviado?.(data.thread_id);
        onClose?.();
      } else {
        throw new Error(data?.error || 'Falha ao enviar');
      }
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isResposta
              ? <><Reply className="w-5 h-5 text-orange-500" /> Responder e-mail</>
              : <><Mail className="w-5 h-5 text-orange-500" /> Novo e-mail</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isResposta && (
            <div className="space-y-1.5">
              <Label>De (caixa remetente)</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a caixa" /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.smtp_from_name || c.name || c.email_address} &lt;{c.email_address}&gt;
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Para</Label>
            <Input type="email" value={para} onChange={(e) => setPara(e.target.value)} readOnly={isResposta} placeholder="destinatario@empresa.com" />
          </div>

          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} readOnly={isResposta} placeholder="Assunto do e-mail" />
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea rows={6} value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="Escreva a mensagem..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose?.()} disabled={enviando}>Cancelar</Button>
          <Button onClick={handleEnviar} disabled={enviando} className="bg-orange-500 hover:bg-orange-600">
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {isResposta ? 'Responder' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}