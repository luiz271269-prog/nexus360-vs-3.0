import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { salvarSenhaEmailAccount } from '@/functions/salvarSenhaEmailAccount';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KeyRound, Loader2, Check, Server, Eye, EyeOff } from 'lucide-react';

// Cadastro de senha por caixa IMAP (Zimbra). A senha é cifrada no banco (AES)
// via backend salvarSenhaEmailAccount — não usa secrets manuais.
export default function CaixasImapSenhas() {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [senhas, setSenhas] = useState({});
  const [mostrar, setMostrar] = useState({});
  const [salvando, setSalvando] = useState({});
  const [salvo, setSalvo] = useState({});

  const carregar = async () => {
    setLoading(true);
    const todas = await base44.entities.EmailAccount.filter({ provider: 'zimbra' }, '-created_date', 100).catch(() => []);
    setContas(todas || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const handleSalvar = async (conta) => {
    const senha = senhas[conta.id];
    if (!senha) return;
    setSalvando((s) => ({ ...s, [conta.id]: true }));
    try {
      await salvarSenhaEmailAccount({ email_account_id: conta.id, password: senha });
      setSalvo((s) => ({ ...s, [conta.id]: true }));
      setSenhas((s) => ({ ...s, [conta.id]: '' }));
      setTimeout(() => setSalvo((s) => ({ ...s, [conta.id]: false })), 2500);
      carregar();
    } catch (e) {
      alert('Erro ao salvar senha: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSalvando((s) => ({ ...s, [conta.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando caixas...
      </div>
    );
  }

  if (contas.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-8">Nenhuma caixa IMAP (Zimbra) cadastrada.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Cadastre a senha de cada caixa. Ela é guardada <strong>cifrada no banco</strong> — sem precisar configurar secrets manualmente.
      </p>

      {contas.map((conta) => {
        const temSenha = !!conta.password_encrypted;
        return (
          <Card key={conta.id} className="border border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-900 text-sm truncate">{conta.name || conta.email_address}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{conta.email_address}</p>
                </div>
                {temSenha ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 flex-shrink-0">
                    <KeyRound className="w-3 h-3 mr-1" /> Senha salva
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 flex-shrink-0">Sem senha</Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={mostrar[conta.id] ? 'text' : 'password'}
                    placeholder={temSenha ? 'Digite para alterar a senha' : 'Digite a senha da caixa'}
                    value={senhas[conta.id] || ''}
                    onChange={(e) => setSenhas((s) => ({ ...s, [conta.id]: e.target.value }))}
                    className="pr-9 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrar((m) => ({ ...m, [conta.id]: !m[conta.id] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {mostrar[conta.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  onClick={() => handleSalvar(conta)}
                  disabled={!senhas[conta.id] || salvando[conta.id]}
                  className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                >
                  {salvando[conta.id] ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : salvo[conta.id] ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}