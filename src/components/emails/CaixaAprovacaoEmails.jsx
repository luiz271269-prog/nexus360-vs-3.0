import React, { useEffect, useState } from 'react';
import { aprovarEmailPendente } from '@/functions/aprovarEmailPendente';
import { listarEmailsPendentes } from '@/functions/listarEmailsPendentes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, RefreshCw, Inbox, MailQuestion } from 'lucide-react';

const URGENCIA_STYLE = {
  alta: 'bg-red-100 text-red-700 border-red-200',
  media: 'bg-amber-100 text-amber-700 border-amber-200',
  baixa: 'bg-slate-100 text-slate-600 border-slate-200',
};
const SETOR_STYLE = {
  vendas: 'bg-blue-100 text-blue-700 border-blue-200',
  financeiro: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  assistencia: 'bg-purple-100 text-purple-700 border-purple-200',
  fornecedor: 'bg-orange-100 text-orange-700 border-orange-200',
  geral: 'bg-slate-100 text-slate-600 border-slate-200',
};
const SETOR_LABEL = {
  vendas: 'Vendas', financeiro: 'Financeiro', assistencia: 'Assistência',
  fornecedor: 'Fornecedor', geral: 'Geral',
};

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
                    {(e.urgencia || e.setor_classificado) && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5" title={e.motivo_classificacao || ''}>
                        {e.urgencia && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${URGENCIA_STYLE[e.urgencia] || URGENCIA_STYLE.baixa}`}>
                            {e.urgencia === 'alta' ? '🔴 Alta' : e.urgencia === 'media' ? '🟡 Média' : '⚪ Baixa'}
                          </Badge>
                        )}
                        {e.setor_classificado && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SETOR_STYLE[e.setor_classificado] || SETOR_STYLE.geral}`}>
                            {SETOR_LABEL[e.setor_classificado] || e.setor_classificado}
                          </Badge>
                        )}
                      </div>
                    )}
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