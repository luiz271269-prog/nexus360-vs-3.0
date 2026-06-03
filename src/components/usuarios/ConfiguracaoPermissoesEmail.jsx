import React, { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Espelho do padrão "Conexões WhatsApp Permitidas".
// Lista as EmailAccount cadastradas; o usuário marca Ver/Receber/Enviar
// e define a ⭐ caixa padrão de envio (e-mails NOVOS).
// Regra: a RESPOSTA sempre sai pela caixa que recebeu (já feito no enviarEmail).
export default function ConfiguracaoPermissoesEmail({ usuarioSelecionado, atualizarUsuario }) {
  const [contas, setContas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const lista = await base44.entities.EmailAccount.list('email_address', 500);
        setContas(lista || []);
      } catch {
        setContas([]);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

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
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
      {contas.map((conta) => {
        const perm = findPerm(conta.id);
        const habilitado = !!perm;

        return (
          <div key={conta.id} className="p-3 bg-white rounded-lg border border-indigo-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Checkbox checked={habilitado} onCheckedChange={() => toggleConta(conta)} />
                <Mail className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{conta.email_address}</span>
              </div>
              <Badge variant="outline" className="text-[9px] flex-shrink-0">{conta.provider}</Badge>
            </div>

            {habilitado && (
              <div className="space-y-3 pl-6 mt-2">
                <div className="flex gap-3 text-xs">
                  {[
                    { key: 'can_view', label: 'Ver' },
                    { key: 'can_receive', label: 'Receber' },
                    { key: 'can_send', label: 'Enviar' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1 cursor-pointer">
                      <Checkbox
                        checked={perm?.[key] !== false}
                        onCheckedChange={(v) => updatePerm(conta.id, key, v)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setDefaultSend(conta.id)}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-all ${
                    perm?.is_default_send
                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                      : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <Star className={`w-3 h-3 ${perm?.is_default_send ? 'fill-amber-400 text-amber-500' : ''}`} />
                  {perm?.is_default_send ? 'Caixa padrão de envio' : 'Definir como padrão de envio'}
                </button>
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