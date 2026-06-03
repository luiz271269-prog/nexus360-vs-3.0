import React, { useState } from 'react';
import { listarEmailsImap } from '@/functions/listarEmailsImap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, AlertCircle, Inbox } from 'lucide-react';

// Inventário de contas Zimbra (planilha). Senha digitada na hora (não fica salva).
const CONTAS = [
  { label: 'luiz@liesch.com.br', host: 'mail.liesch.com.br', username: 'luiz@liesch.com.br' },
  { label: 'compras@lieschnet.com.br', host: 'mail.liesch.com.br', username: 'compras@lieschnet.com.br' },
  { label: 'ricardo@lieschnet.com.br', host: 'mail.liesch.com.br', username: 'ricardo@lieschnet.com.br' },
  { label: 'paulo@lieschnet.com.br', host: 'mail.liesch.com.br', username: 'paulo@lieschnet.com.br' },
  { label: 'vendas1@liesch.com.br', host: 'mail.liesch.com.br', username: 'vendas1@liesch.com.br' },
  { label: 'vendas5@liesch.com.br', host: 'mail.liesch.com.br', username: 'vendas5@liesch.com.br' },
  { label: 'financeiro@liesch.com.br', host: 'mail.liesch.com.br', username: 'financeiro@liesch.com.br' },
  { label: 'telemarketing@liesch.com.br', host: 'mail.liesch.com.br', username: 'telemarketing@liesch.com.br' },
  { label: 'atendimento@liesch.com.br', host: 'mail.liesch.com.br', username: 'atendimento@liesch.com.br' },
  { label: 'distribuicao@liesch.com.br', host: 'mail.liesch.com.br', username: 'distribuicao@liesch.com.br' },
  { label: 'portal@liesch.com.br', host: 'mail.liesch.com.br', username: 'portal@liesch.com.br' },
  { label: 'trabalheconosco@liesch.com.br', host: 'mail.liesch.com.br', username: 'trabalheconosco@liesch.com.br' },
  { label: 'admin@liesch.com.br', host: 'mail.liesch.com.br', username: 'admin@liesch.com.br' },
];

export default function AbaCaixaEntradaImap() {
  const [contaIdx, setContaIdx] = useState(0);
  const [senha, setSenha] = useState('');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [info, setInfo] = useState(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    setEmails([]);
    setInfo(null);
    const conta = CONTAS[contaIdx];
    try {
      const resp = await listarEmailsImap({
        host: conta.host,
        username: conta.username,
        password: senha,
        port: 143,
        security: 'starttls',
        use_embedded_ca: true,
        max_messages: 30,
      });
      const data = resp?.data || resp;
      if (data?.ok) {
        setEmails(data.emails || []);
        setInfo(`${data.count} de ${data.total} e-mails — ${data.username}`);
      } else {
        setErro(data?.error || 'Falha ao carregar e-mails.');
      }
    } catch (e) {
      setErro(e?.response?.data?.error || e?.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Selecionar conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Conta</Label>
              <select
                value={contaIdx}
                onChange={(e) => setContaIdx(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {CONTAS.map((c, i) => (
                  <option key={c.username} value={i}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block">Senha</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha da conta Zimbra"
                onKeyDown={(e) => e.key === 'Enter' && senha && carregar()}
              />
            </div>
          </div>
          <Button onClick={carregar} disabled={loading || !senha} className="gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Inbox className="w-4 h-4" />}
            {loading ? 'Carregando...' : 'Carregar e-mails'}
          </Button>
        </CardContent>
      </Card>

      {erro && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 mb-6">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Não foi possível carregar</p>
            <p className="text-sm break-words">{erro}</p>
          </div>
        </div>
      )}

      {info && <p className="text-sm text-slate-500 mb-3">{info}</p>}

      {emails.length > 0 && (
        <Card>
          <CardContent className="p-0 divide-y">
            {emails.map((m) => (
              <div key={m.uid} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <p className="font-medium text-slate-800 text-sm truncate">{m.from}</p>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{m.date}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1 truncate">{m.subject}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && !erro && emails.length === 0 && info && (
        <p className="text-center text-slate-400 py-8">Nenhum e-mail encontrado.</p>
      )}
    </div>
  );
}