import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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

export default function SecaoEmailUsuario({ usuarioSelecionado, atualizarUsuario }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);

  if (!usuarioSelecionado) return null;

  const email = usuarioSelecionado.email_account || {};
  const secretName = `EMAIL_PWD_${usuarioSelecionado.id || 'NOVO'}`;

  const toggleAtivo = (v) => {
    if (v) {
      atualizarUsuario('email_account', {
        ...email,
        ...SERVER_DEFAULTS,
        ativo: true,
        login: email.login || usuarioSelecionado.email || '',
        password_secret_name: email.password_secret_name || secretName,
      });
    } else {
      atualizarUsuario('email_account', { ...email, ativo: false });
    }
  };

  const testarConexao = async () => {
    setTestando(true);
    setResultado(null);
    try {
      const resp = await base44.functions.invoke('testarConexaoImap', { user_id: usuarioSelecionado.id });
      const data = resp?.data || resp;
      if (data?.ok) {
        setResultado({ ok: true, msg: `Conectado! ${data.total_uids_found ?? 0} mensagens na caixa.` });
        toast.success('✅ Conexão de e-mail OK');
      } else {
        setResultado({ ok: false, msg: data?.error || 'Falha na conexão', hint: data?.hint });
        toast.error('❌ Falha ao conectar');
      }
    } catch (e) {
      setResultado({ ok: false, msg: e.message || 'Erro ao testar' });
      toast.error('❌ Erro ao testar conexão');
    } finally {
      setTestando(false);
    }
  };

  return (
    <Card className="border-indigo-200 bg-indigo-50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          ✉️ Conta de E-mail
        </CardTitle>
        <CardDescription>Endereço de e-mail que este usuário usa para enviar e receber na Central</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Ativar e-mail deste usuário</span>
          <Switch checked={email.ativo || false} onCheckedChange={toggleAtivo} />
        </div>

        {email.ativo && (
          <>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">E-mail do usuário</label>
              <Input
                value={email.login || ''}
                onChange={(e) => atualizarUsuario('email_account', { ...email, login: e.target.value })}
                placeholder="usuario@liesch.com.br"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              🔒 A senha não é guardada aqui. Cadastre um secret chamado{' '}
              <code className="bg-slate-100 px-1 rounded">{email.password_secret_name || secretName}</code>{' '}
              com a senha desta caixa de e-mail. Servidor e portas são configurados automaticamente.
            </p>

            <Button
              onClick={testarConexao}
              disabled={testando || !email.login}
              variant="outline"
              className="w-full gap-2 border-indigo-300"
            >
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
          </>
        )}
      </CardContent>
    </Card>
  );
}