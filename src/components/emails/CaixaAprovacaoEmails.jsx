import React, { useEffect, useState } from 'react';
import { aprovarEmailPendente } from '@/functions/aprovarEmailPendente';
import { listarEmailsPendentes } from '@/functions/listarEmailsPendentes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, RefreshCw, Inbox, MailQuestion } from 'lucide-react';

export default function CaixaAprovacaoEmails() {
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const resp = await listarEmailsPendentes({});
      const data = resp?.data || resp;
      setPendentes(data?.pendentes || []);
    } catch (e) {
      console.error('Erro ao carregar pendentes:', e);
      setPendentes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const decidir = async (email_id, acao) => {
    setProcessando(email_id);
    try {
      await aprovarEmailPendente({ email_id, acao });
      setPendentes((prev) => prev.filter((e) => e.id !== email_id));
    } catch (e) {
      console.error('Erro ao decidir:', e);
    } finally {
      setProcessando(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MailQuestion className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-slate-800">Caixa de aprovação</span>
            <Badge variant="secondary">{pendentes.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={carregar} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : pendentes.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Nenhum e-mail aguardando aprovação.
          </div>
        ) : (
          <div className="divide-y">
            {pendentes.map((e) => (
              <div key={e.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">
                      {e.remetente_nome || e.remetente_email}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{e.remetente_email}</p>
                    <p className="text-sm text-slate-600 mt-1 truncate">{e.assunto || '(sem assunto)'}</p>
                    <p className="text-xs text-slate-400 mt-1">Caixa: {e.account_login} · {e.data_email}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => decidir(e.id, 'aprovar')}
                      disabled={processando === e.id}
                      className="gap-1 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decidir(e.id, 'rejeitar')}
                      disabled={processando === e.id}
                      className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" /> Rejeitar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}