import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// Defaults do servidor de e-mail da empresa (Zimbra Liesch).
// Ficam embutidos — o operador só precisa informar o e-mail do usuário.
const SERVER_DEFAULTS = {
  imap_host: 'mail.liesch.com.br',
  imap_port: 143,
  imap_security: 'starttls',
  smtp_host: 'mail.liesch.com.br',
  smtp_port: 587,
  smtp_security: 'starttls',
};

// Nome do secret derivado do e-mail (estável, único por caixa).
function secretNameFor(login) {
  const clean = String(login || '').toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return clean ? `EMAIL_PWD_${clean}` : 'EMAIL_PWD_NOVO';
}

function ContaEmailCard({ conta, onChange, onRemove }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const secretName = conta.password_secret_name || secretNameFor(conta.login);

  const testar = async () => {
    setTestando(true);
    setResultado(null);
    try {
      const resp = await base44.functions.invoke('testarConexaoImap', {
        imap_host: SERVER_DEFAULTS.imap_host,
        imap_port: SERVER_DEFAULTS.imap_port,
        security: SERVER_DEFAULTS.imap_security,
        username: conta.login,
        password_secret_name: secretName,
        use_embedded_ca: true,
      });
      const data = resp?.data || resp;
      if (data?.ok) {
        setResultado({ ok: true, msg: `Conectado! ${data.total_uids_found ?? 0} mensagens na caixa.` });
        toast.success('✅ Conexão OK');
      } else {
        setResultado({ ok: false, msg: data?.error || 'Falha na conexão', hint: data?.hint });
        toast.error('❌ Falha ao conectar');
      }
    } catch (e) {
      // base44.functions.invoke (axios) lança em status != 2xx — a mensagem real vem no corpo
      const data = e?.response?.data;
      setResultado({ ok: false, msg: data?.error || e.message || 'Erro ao testar', hint: data?.hint });
      toast.error('❌ ' + (data?.error || 'Erro ao testar conexão'));
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Switch checked={conta.ativo !== false} onCheckedChange={(v) => onChange({ ...conta, ativo: v })} />
          <span className="text-slate-600">Ativo</span>
        </div>
        <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Remover e-mail">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <Input
        value={conta.login || ''}
        onChange={(e) => onChange({ ...conta, login: e.target.value, password_secret_name: secretNameFor(e.target.value) })}
        placeholder="usuario@liesch.com.br"
      />

      <p className="text-[11px] text-slate-500 leading-relaxed">
        🔒 Cadastre um secret chamado{' '}
        <code className="bg-slate-100 px-1 rounded break-all">{secretName}</code>{' '}
        com a senha desta caixa.
      </p>

      <Button onClick={testar} disabled={testando || !conta.login} variant="outline" className="w-full gap-2 border-indigo-300">
        {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        {testando ? 'Testando...' : 'Testar conexão'}
      </Button>

      {resultado && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${resultado.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {resultado.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <div>
            <p className="font-medium">{resultado.msg}</p>
            {resultado.hint && <p className="mt-1 opacity-80">{resultado.hint}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SecaoEmailUsuario({ usuarioSelecionado, atualizarUsuario }) {
  if (!usuarioSelecionado) return null;

  const contas = usuarioSelecionado.email_accounts || [];

  const adicionar = () => {
    atualizarUsuario('email_accounts', [
      ...contas,
      { id: `mail-${Date.now()}`, login: '', ativo: true, ...SERVER_DEFAULTS, password_secret_name: '' },
    ]);
  };

  const atualizarConta = (idx, nova) => {
    atualizarUsuario('email_accounts', contas.map((c, i) => (i === idx ? nova : c)));
  };

  const removerConta = (idx) => {
    atualizarUsuario('email_accounts', contas.filter((_, i) => i !== idx));
  };

  return (
    <Card className="border-indigo-200 bg-indigo-50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          ✉️ Contas de E-mail
        </CardTitle>
        <CardDescription>E-mails que este usuário usa para enviar e receber na Central. Pode cadastrar vários.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {contas.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-2">Nenhum e-mail cadastrado.</p>
        )}

        {contas.map((conta, idx) => (
          <ContaEmailCard
            key={conta.id || idx}
            conta={conta}
            onChange={(nova) => atualizarConta(idx, nova)}
            onRemove={() => removerConta(idx)}
          />
        ))}

        <Button onClick={adicionar} variant="outline" className="w-full gap-2">
          <Plus className="w-4 h-4" /> Adicionar e-mail
        </Button>
      </CardContent>
    </Card>
  );
}