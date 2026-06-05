import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import AnexosEmail from './AnexosEmail';

// Aba "Novo e-mail" — compõe e envia via iniciarEmailNovo (mesma lógica do NovoEmailModal, sem dialog).
export default function AbaNovoEmail() {
  const [contas, setContas] = useState([]);
  const [contaId, setContaId] = useState('');
  const [para, setPara] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [anexos, setAnexos] = useState([]);
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
    setPara(''); setAssunto(''); setCorpo(''); setAnexos([]); setEnviado(null);
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
        body: corpo,
        attachments: anexos.map((a) => ({ url: a.url, filename: a.filename }))
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
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-8 flex flex-col items-center text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-slate-800">E-mail enviado com sucesso!</h3>
          <p className="text-xs text-slate-500">A mensagem saiu corretamente.</p>
        </div>
        <div className="w-full max-w-md text-left bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-1">
          <p><span className="text-slate-500">Para:</span> <span className="font-medium text-slate-800">{enviado.para}</span></p>
          {enviado.assunto && <p><span className="text-slate-500">Assunto:</span> <span className="font-medium text-slate-800">{enviado.assunto}</span></p>}
        </div>
        <Button size="sm" onClick={limpar} className="h-8 text-xs bg-orange-500 hover:bg-orange-600">Novo e-mail</Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-slate-800 text-sm">Novo e-mail</span>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">De (caixa remetente)</Label>
        <Select value={contaId} onValueChange={setContaId}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione a caixa" /></SelectTrigger>
          <SelectContent>
            {contas.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.smtp_from_name || c.name || c.email_address} &lt;{c.email_address}&gt;
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Para</Label>
        <Input type="email" className="h-9 text-sm" value={para} onChange={(e) => setPara(e.target.value)} placeholder="destinatario@empresa.com" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Assunto</Label>
        <Input className="h-9 text-sm" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto do e-mail" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Mensagem</Label>
        <Textarea rows={5} className="text-sm" value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder="Escreva a mensagem..." />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Anexos</Label>
        <AnexosEmail anexos={anexos} onChange={setAnexos} />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleEnviar} disabled={enviando} className="h-8 text-xs bg-orange-500 hover:bg-orange-600 gap-1.5">
          {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Enviar
        </Button>
      </div>
    </div>
  );
}