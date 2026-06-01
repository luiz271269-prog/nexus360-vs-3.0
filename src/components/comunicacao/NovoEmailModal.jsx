import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

// Modal isolado para compor um e-mail NOVO (não-resposta).
// Ao enviar, chama iniciarEmailNovo e devolve o thread_id criado via onEnviado.
export default function NovoEmailModal({ aberto, onClose, onEnviado }) {
  const [contas, setContas] = useState([]);
  const [contaId, setContaId] = useState('');
  const [para, setPara] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    base44.entities.EmailAccount.filter({ outbound_enabled: true }, '-is_default_outbound', 50)
      .then((lista) => {
        const ativas = (lista || []).filter((c) => c.status !== 'inactive');
        setContas(ativas);
        const padrao = ativas.find((c) => c.is_default_outbound) || ativas[0];
        if (padrao) setContaId(padrao.id);
      })
      .catch(() => setContas([]));
  }, [aberto]);

  const limpar = () => {
    setPara(''); setAssunto(''); setCorpo('');
  };

  const handleEnviar = async () => {
    if (!contaId) { toast.error('Selecione a caixa remetente'); return; }
    if (!para.trim()) { toast.error('Informe o destinatário'); return; }

    setEnviando(true);
    try {
      const resp = await base44.functions.invoke('iniciarEmailNovo', {
        email_account_id: contaId,
        to: para.trim(),
        subject: assunto,
        body: corpo
      });
      const data = resp?.data || resp;
      if (data?.ok) {
        toast.success('✅ E-mail enviado!');
        limpar();
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
            <Mail className="w-5 h-5 text-orange-500" /> Novo e-mail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
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

          <div className="space-y-1.5">
            <Label>Para</Label>
            <Input type="email" value={para} onChange={(e) => setPara(e.target.value)} placeholder="destinatario@empresa.com" />
          </div>

          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto do e-mail" />
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
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}