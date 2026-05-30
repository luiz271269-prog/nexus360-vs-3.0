import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Mail, KeyRound } from 'lucide-react';

const SECURITY_OPTIONS = [
  { value: 'starttls', label: 'STARTTLS' },
  { value: 'tls', label: 'TLS/SSL' },
  { value: 'none', label: 'Nenhuma' },
];

export default function SecaoEmailUsuario({ usuarioSelecionado, atualizarUsuario }) {
  if (!usuarioSelecionado) return null;

  const email = usuarioSelecionado.email_account || {};
  const update = (campo, valor) => {
    atualizarUsuario('email_account', { ...email, [campo]: valor });
  };

  const secretSugerido = `EMAIL_PWD_${usuarioSelecionado.id || 'NOVO'}`;

  return (
    <Card className="border-indigo-200 bg-indigo-50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          ✉️ Conta de E-mail (IMAP/SMTP)
        </CardTitle>
        <CardDescription>Configuração da caixa de e-mail deste usuário para sincronização na Central</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Ativar sincronização de e-mail</span>
          <Switch
            checked={email.ativo || false}
            onCheckedChange={(v) => update('ativo', v)}
          />
        </div>

        {email.ativo && (
          <>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Login (e-mail completo)</label>
              <Input
                value={email.login || ''}
                onChange={(e) => update('login', e.target.value)}
                placeholder="luiz@liesch.com.br"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="text-xs font-medium text-slate-700 mb-1 block">Servidor IMAP</label>
                <Input
                  value={email.imap_host || ''}
                  onChange={(e) => update('imap_host', e.target.value)}
                  placeholder="mail.liesch.com.br"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Porta IMAP</label>
                <Input
                  type="number"
                  value={email.imap_port ?? 143}
                  onChange={(e) => update('imap_port', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Segurança IMAP</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={email.imap_security || 'starttls'}
                  onChange={(e) => update('imap_security', e.target.value)}
                >
                  {SECURITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="text-xs font-medium text-slate-700 mb-1 block">Servidor SMTP</label>
                <Input
                  value={email.smtp_host || ''}
                  onChange={(e) => update('smtp_host', e.target.value)}
                  placeholder="mail.liesch.com.br"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Porta SMTP</label>
                <Input
                  type="number"
                  value={email.smtp_port ?? 587}
                  onChange={(e) => update('smtp_port', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Segurança SMTP</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={email.smtp_security || 'starttls'}
                  onChange={(e) => update('smtp_security', e.target.value)}
                >
                  {SECURITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="p-3 bg-white rounded-lg border border-indigo-200">
              <label className="text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                Nome do Secret da Senha
              </label>
              <Input
                value={email.password_secret_name || ''}
                onChange={(e) => update('password_secret_name', e.target.value)}
                placeholder={secretSugerido}
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                🔒 A senha <strong>não</strong> é salva aqui. Cadastre um secret com este nome (sugestão: <code className="bg-slate-100 px-1 rounded">{secretSugerido}</code>) contendo a senha da conta. Assim a credencial fica protegida.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}