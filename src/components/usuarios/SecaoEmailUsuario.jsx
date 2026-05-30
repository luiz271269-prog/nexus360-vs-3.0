import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Mail } from 'lucide-react';

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
          </>
        )}
      </CardContent>
    </Card>
  );
}