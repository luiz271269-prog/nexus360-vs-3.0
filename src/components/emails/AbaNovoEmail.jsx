import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// Aba "Novo e-mail" — compõe e envia via iniciarEmailNovo (mesma lógica do NovoEmailModal, sem dialog).
export default function AbaNovoEmail() {
  const [contas, setContas] = useState([]);
  const [contaId, setContaId] = useState('');
  const [para, setPara] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(null);

  useEffect(() => {
    base44.entities.EmailAccount.filter({ outbound_enabled: true }, '-is_default_outbound', 50)
      .then((lista) => {
        const ativas = (lista || []).filter((c) => c.status !== 'inactive');
        setContas(ativas);
        const padrao = ativas.find((c) => c.is_default_outbound) || ativas[0];
        if (padrao) setContaId(padrao.id);
      })
      .catch(() => setContas([]));
  }, []);

  const limpar = () => {
    setPara(''); setAssunto(''); setCorpo(''); setEnviado(null);
  };

  const handleEnviar = async () => {
    if (!contaId) { toast.error('Selecione a caixa remetente'); return; }
    if (!para.trim()) { toast.error('Informe o destinatário'); return; }
    if (!corpo.trim()) { toast.error('Escreva a mensagem'); return; }

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
        setEnviado({ para, assunto });
      } else {
        throw new Error(data?.error || 'Falha ao enviar');
      }
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-800">E-mail enviado com sucesso!</h3>
            <p className="text-sm text-slate-500">A mensagem saiu corretamente.</p>
          </div>
          <div className="w-full max-w-md text-left bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-1">
            <p><span className="text-slate-500">Para:</span> <span className="font-medium text-slate-800">{enviado.para}</span></p>
            {enviado.assunto && <p><span className="text-slate-500">Assunto:</span> <span className="font-medium text-slate-800">{enviado.assunto}</span></p>}
          </div>
          <Button onClick={limpar} className="bg-orange-500 hover:bg-orange-600">Novo e-mail</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4 max-w-xl">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-5 h-5 text-orange-500" />
          <span className="font-semibold text-slate-800">Novo e-mail</span>
        </div>

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

        <div className="flex justify-end">
          <Button onClick={handleEnviar} disabled={enviando} className="bg-orange-500 hover:bg-orange-600 gap-2">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}