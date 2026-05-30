import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Loader2, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// Conectores de e-mail suportados.
// Cada TIPO tem um secret próprio (senha de permissão da conexão), NÃO por usuário.
// Reaproveita os secrets que já foram testados com sucesso.
const CONNECTORS = {
  zimbra: {
    label: 'Zimbra (Liesch)',
    imap_host: 'mail.liesch.com.br',
    imap_port: 143,
    imap_security: 'starttls',
    smtp_host: 'mail.liesch.com.br',
    smtp_port: 587,
    smtp_security: 'starttls',
    secret: 'EMAIL_PWD_LUIZ2LIESCH_COM_BR',
    use_embedded_ca: true,
  },
  gmail: {
    label: 'Gmail',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_security: 'tls',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 465,
    smtp_security: 'tls',
    secret: 'EMAIL_PWD_LUIZ271269_GMAIL_COM',
    use_embedded_ca: false,
  },
};

const DEFAULT_TIPO = 'zimbra';

function connectorFor(tipo) {
  return CONNECTORS[tipo] || CONNECTORS[DEFAULT_TIPO];
}

function ContaEmailCard({ conta, onChange, onRemove }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const tipo = conta.tipo_conector || DEFAULT_TIPO;
  const conn = connectorFor(tipo);
  const secretName = conn.secret;

  const mudarTipo = (novoTipo) => {
    const c = connectorFor(novoTipo);
    onChange({
      ...conta,
      tipo_conector: novoTipo,
      imap_host: c.imap_host,
      imap_port: c.imap_port,
      imap_security: c.imap_security,
      smtp_host: c.smtp_host,
      smtp_port: c.smtp_port,
      smtp_security: c.smtp_security,
      password_secret_name: c.secret,
    });
    setResultado(null);
  };

  const testar = async () => {
    setTestando(true);
    setResultado(null);
    try {
      const resp = await base44.functions.invoke('testarConexaoImap', {
        imap_host: conn.imap_host,
        imap_port: conn.imap_port,
        security: conn.imap_security,
        username: conta.login,
        password_secret_name: secretName,
        use_embedded_ca: conn.use_embedded_ca,
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

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-500">Tipo de conexão</label>
        <Select value={tipo} onValueChange={mudarTipo}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CONNECTORS).map(([key, c]) => (
              <SelectItem key={key} value={key}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Input
        value={conta.login || ''}
        onChange={(e) => onChange({ ...conta, login: e.target.value })}
        placeholder={tipo === 'gmail' ? 'usuario@gmail.com' : 'usuario@liesch.com.br'}
      />

      <p className="text-[11px] text-slate-500 leading-relaxed">
        🔒 Usa o secret do conector{' '}
        <code className="bg-slate-100 px-1 rounded break-all">{secretName}</code>{' '}
        ({conn.imap_host}:{conn.imap_port}). Um segredo por tipo de conexão.
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
    const c = connectorFor(DEFAULT_TIPO);
    atualizarUsuario('email_accounts', [
      ...contas,
      {
        id: `mail-${Date.now()}`,
        login: '',
        ativo: true,
        tipo_conector: DEFAULT_TIPO,
        imap_host: c.imap_host,
        imap_port: c.imap_port,
        imap_security: c.imap_security,
        smtp_host: c.smtp_host,
        smtp_port: c.smtp_port,
        smtp_security: c.smtp_security,
        password_secret_name: c.secret,
      },
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
        <CardDescription>E-mails que este usuário usa para enviar e receber na Central. Cada tipo de conexão (Zimbra, Gmail) usa um único segredo compartilhado.</CardDescription>
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