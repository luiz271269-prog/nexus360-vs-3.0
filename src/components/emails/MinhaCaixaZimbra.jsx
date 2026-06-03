import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Server, CheckCircle2, AlertCircle, Loader2, Save, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { testarConexaoImap } from '@/functions/testarConexaoImap';

const FORM_INICIAL = {
  name: '',
  email_address: '',
  imap_host: '',
  imap_port: 993,
  imap_security: 'tls',
  imap_mailbox: 'INBOX',
  password_secret_name: ''
};

export default function MinhaCaixaZimbra({ usuario }) {
  const [conta, setConta] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);

  const carregar = useCallback(async () => {
    if (!usuario?.id) return;
    setLoading(true);
    try {
      const contas = await base44.entities.EmailAccount.filter({
        provider: 'zimbra',
        assigned_user_ids: usuario.id
      });
      const minha = (contas || [])[0] || null;
      setConta(minha);
      if (minha) {
        setForm({
          name: minha.name || '',
          email_address: minha.email_address || '',
          imap_host: minha.imap_host || '',
          imap_port: minha.imap_port || 993,
          imap_security: minha.imap_security || 'tls',
          imap_mailbox: minha.imap_mailbox || 'INBOX',
          password_secret_name: minha.password_secret_name || ''
        });
      } else {
        setForm(FORM_INICIAL);
      }
    } catch {
      setConta(null);
    } finally {
      setLoading(false);
    }
  }, [usuario?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const set = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  const handleSalvar = async () => {
    if (!form.email_address || !form.imap_host || !form.password_secret_name) {
      toast.error('Preencha e-mail, servidor IMAP e o nome do secret da senha.');
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        name: form.name || form.email_address,
        email_address: form.email_address.trim().toLowerCase(),
        provider: 'zimbra',
        auth_type: 'password_secret',
        password_secret_name: form.password_secret_name.trim(),
        imap_host: form.imap_host.trim(),
        imap_port: Number(form.imap_port) || 993,
        imap_security: form.imap_security,
        imap_mailbox: form.imap_mailbox || 'INBOX',
        inbound_enabled: true,
        assigned_user_ids: [usuario.id],
        sector_id: usuario.attendant_sector || 'geral',
        status: 'testing'
      };
      let salva;
      if (conta) {
        await base44.entities.EmailAccount.update(conta.id, dados);
        salva = { ...conta, ...dados };
      } else {
        salva = await base44.entities.EmailAccount.create(dados);
      }
      setConta(salva);
      toast.success('Caixa salva. Agora teste a conexão.');
    } catch (e) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleTestar = async () => {
    if (!conta?.id) {
      toast.error('Salve a caixa antes de testar.');
      return;
    }
    setTestando(true);
    try {
      const res = await testarConexaoImap({ email_account_id: conta.id });
      if (res.data?.ok) {
        toast.success(`Conexão OK — ${res.data.total_uids_found ?? 0} e-mails na caixa.`);
        carregar();
      } else {
        toast.error(res.data?.error || 'Falha na conexão IMAP.');
      }
    } catch (e) {
      toast.error('Erro ao testar: ' + (e.response?.data?.error || e.message));
    } finally {
      setTestando(false);
    }
  };

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardHeader className="pb-3 border-b border-gray-100">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Server className="h-5 w-5 text-blue-600" />
          Zimbra / IMAP — caixa por senha
        </CardTitle>
        <CardDescription className="text-xs">
          Configure sua caixa corporativa (Zimbra/IMAP). A senha fica guardada com segurança no cofre.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            {conta && (
              <div className={`flex items-center gap-2 rounded-lg p-3 border ${
                conta.status === 'active'
                  ? 'bg-green-50 border-green-200'
                  : conta.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
              }`}>
                {conta.status === 'active'
                  ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                  : <AlertCircle className="h-5 w-5 text-amber-600" />}
                <span className="text-sm">
                  {conta.status === 'active'
                    ? 'Conexão validada e ativa'
                    : conta.status === 'error'
                      ? `Erro: ${conta.last_error || 'falha na última conexão'}`
                      : 'Aguardando teste de conexão'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">E-mail da caixa *</Label>
                <Input
                  placeholder="seunome@liesch.com.br"
                  value={form.email_address}
                  onChange={(e) => set('email_address', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rótulo (opcional)</Label>
                <Input
                  placeholder="Ex: Vendas - Luiz"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Servidor IMAP *</Label>
                <Input
                  placeholder="mail.liesch.com.br"
                  value={form.imap_host}
                  onChange={(e) => set('imap_host', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Porta</Label>
                  <Input
                    type="number"
                    value={form.imap_port}
                    onChange={(e) => set('imap_port', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Segurança</Label>
                  <Select value={form.imap_security} onValueChange={(v) => set('imap_security', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS (993)</SelectItem>
                      <SelectItem value="starttls">STARTTLS (143)</SelectItem>
                      <SelectItem value="none">Nenhuma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pasta</Label>
                <Input
                  value={form.imap_mailbox}
                  onChange={(e) => set('imap_mailbox', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome do secret da senha *</Label>
                <Input
                  placeholder="EMAIL_PWD_SEUNOME"
                  value={form.password_secret_name}
                  onChange={(e) => set('password_secret_name', e.target.value)}
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded p-2">
              🔒 Por segurança, a senha não é digitada aqui. Um administrador cadastra a senha
              da sua caixa no cofre (Configurações → Variáveis de ambiente) com o nome informado acima.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSalvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700 text-white">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar caixa
              </Button>
              <Button onClick={handleTestar} disabled={testando || !conta} variant="outline">
                {testando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plug className="h-4 w-4 mr-1" />}
                Testar conexão
              </Button>
            </div>

            <Badge variant="outline" className="text-xs text-gray-500">
              Visível na Central para todos do setor: {usuario?.attendant_sector || 'geral'}
            </Badge>
          </>
        )}
      </CardContent>
    </Card>
  );
}