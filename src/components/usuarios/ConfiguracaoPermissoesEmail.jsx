import React, { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Star, Mail, KeyRound, Check, Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { salvarSenhaEmailAccount } from '@/functions/salvarSenhaEmailAccount';

// Espelho do padrão "Conexões WhatsApp Permitidas".
// Lista as EmailAccount cadastradas; o usuário marca Ver/Receber/Enviar
// e define a ⭐ caixa padrão de envio (e-mails NOVOS).
// Regra: a RESPOSTA sempre sai pela caixa que recebeu (já feito no enviarEmail).
export default function ConfiguracaoPermissoesEmail({ usuarioSelecionado, atualizarUsuario }) {
  const [contas, setContas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [senhas, setSenhas] = useState({});
  const [mostrar, setMostrar] = useState({});
  const [salvando, setSalvando] = useState({});
  const [salvo, setSalvo] = useState({});

  const carregarContas = async () => {
    try {
      const lista = await base44.entities.EmailAccount.list('email_address', 500);
      setContas(lista || []);
    } catch {
      setContas([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarContas(); }, []);

  const salvarSenha = async (conta) => {
    const senha = senhas[conta.id];
    if (!senha) return;
    setSalvando((s) => ({ ...s, [conta.id]: true }));
    try {
      await salvarSenhaEmailAccount({ email_account_id: conta.id, password: senha });
      setSalvo((s) => ({ ...s, [conta.id]: true }));
      setSenhas((s) => ({ ...s, [conta.id]: '' }));
      setTimeout(() => setSalvo((s) => ({ ...s, [conta.id]: false })), 2500);
      carregarContas();
    } catch (e) {
      alert('Erro ao salvar senha: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSalvando((s) => ({ ...s, [conta.id]: false }));
    }
  };

  const perms = usuarioSelecionado.email_accounts || [];
  const findPerm = (id) => perms.find((p) => p.email_account_id === id);

  const toggleConta = (conta) => {
    const habilitado = !!findPerm(conta.id);
    let novas;
    if (habilitado) {
      novas = perms.filter((p) => p.email_account_id !== conta.id);
    } else {
      novas = [
        ...perms,
        {
          email_account_id: conta.id,
          login: conta.email_address,
          tipo_conector: conta.provider,
          ativo: true,
          can_view: true,
          can_receive: true,
          can_send: true,
          is_default_send: false,
        },
      ];
    }
    atualizarUsuario('email_accounts', novas);
  };

  const updatePerm = (id, campo, valor) => {
    const novas = perms.map((p) => (p.email_account_id === id ? { ...p, [campo]: valor } : p));
    atualizarUsuario('email_accounts', novas);
  };

  const setDefaultSend = (id) => {
    // Só uma caixa padrão por usuário
    const novas = perms.map((p) => ({ ...p, is_default_send: p.email_account_id === id }));
    atualizarUsuario('email_accounts', novas);
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando caixas...
      </div>
    );
  }

  if (contas.length === 0) {
    return (
      <p className="text-xs text-slate-500 text-center py-4">
        Nenhuma caixa de e-mail cadastrada no sistema.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
      {contas.map((conta) => {
        const perm = findPerm(conta.id);
        const habilitado = !!perm;

        return (
          <div key={conta.id} className={`px-2 py-1.5 bg-white rounded-md border border-indigo-200 ${habilitado ? '' : ''}`}>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 min-w-0 cursor-pointer">
                <Checkbox checked={habilitado} onCheckedChange={() => toggleConta(conta)} className="h-3.5 w-3.5" />
                <Mail className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                <span className="text-xs font-medium truncate">{conta.email_address}</span>
              </label>
              <Badge variant="outline" className="text-[8px] px-1 py-0 flex-shrink-0">{conta.provider}</Badge>
            </div>

            {habilitado && (
              <div className="space-y-1.5 pl-5 mt-1.5">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  {[
                    { key: 'can_view', label: 'Ver' },
                    { key: 'can_receive', label: 'Receber' },
                    { key: 'can_send', label: 'Enviar' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1 cursor-pointer">
                      <Checkbox
                        checked={perm?.[key] !== false}
                        onCheckedChange={(v) => updatePerm(conta.id, key, v)}
                        className="h-3.5 w-3.5"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setDefaultSend(conta.id)}
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all ${
                    perm?.is_default_send
                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                      : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <Star className={`w-3 h-3 ${perm?.is_default_send ? 'fill-amber-400 text-amber-500' : ''}`} />
                  {perm?.is_default_send ? 'Caixa padrão de envio' : 'Definir como padrão de envio'}
                </button>

                {conta.provider === 'zimbra' && (
                  <div className="pt-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <KeyRound className="w-3 h-3 text-slate-400" />
                      <span className="text-[11px] text-slate-500">
                        Senha da caixa {conta.password_encrypted ? '(salva)' : '(não cadastrada)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <Input
                          type={mostrar[conta.id] ? 'text' : 'password'}
                          placeholder={conta.password_encrypted ? 'Alterar senha' : 'Digite a senha'}
                          value={senhas[conta.id] || ''}
                          onChange={(e) => setSenhas((s) => ({ ...s, [conta.id]: e.target.value }))}
                          className="h-8 pr-8 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrar((m) => ({ ...m, [conta.id]: !m[conta.id] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {mostrar[conta.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => salvarSenha(conta)}
                        disabled={!senhas[conta.id] || salvando[conta.id]}
                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3"
                      >
                        {salvando[conta.id] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : salvo[conta.id] ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          'Salvar'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
        ℹ️ A <strong>resposta</strong> sempre sai pela caixa que recebeu o e-mail. A ⭐ caixa padrão é usada apenas para e-mails <strong>novos</strong>.
      </p>
    </div>
  );
}