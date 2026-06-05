import React, { useEffect, useState } from 'react';
import { aprovarEmailPendente } from '@/functions/aprovarEmailPendente';
import { listarEmailsPendentes } from '@/functions/listarEmailsPendentes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, RefreshCw, Inbox, MailQuestion } from 'lucide-react';

const URGENCIA_STYLE = {
  alta: 'bg-red-100 text-red-700 border-red-200',
  media: 'bg-amber-100 text-amber-700 border-amber-200',
  baixa: 'bg-slate-100 text-slate-600 border-slate-200',
};
// Badge sólido estilo Gmail/Superhuman (pílula no canto do card)
const URGENCIA_BADGE = {
  alta: 'bg-red-500 text-white',
  media: 'bg-amber-400 text-white',
  baixa: 'bg-slate-400 text-white',
};
const URGENCIA_LABEL = { alta: 'URGENT', media: 'ATENÇÃO', baixa: 'NORMAL' };

// Cor determinística do avatar a partir do e-mail
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500',
];
const corAvatar = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const iniciais = (nome = '', email = '') => {
  const base = (nome || email || '?').trim();
  const partes = base.split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || base[0]?.toUpperCase() || '?';
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
    <div className="space-y-3">
      {/* Barra de status discreta */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MailQuestion className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-slate-700">Aguardando aprovação</span>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold">
            {pendentes.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={carregar} disabled={loading} className="gap-2 text-slate-500 hover:text-slate-700">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      ) : pendentes.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum e-mail aguardando aprovação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendentes.map((e) => (
            <div
              key={e.id}
              className="group bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-3"
            >
              <div className="flex items-start gap-2.5">
                {/* Avatar circular */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-full ${corAvatar(e.remetente_email)} flex items-center justify-center text-white font-semibold text-xs shadow-sm`}>
                  {iniciais(e.remetente_nome, e.remetente_email)}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Linha 1: nome + badge urgência + tempo */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-[13px] truncate">
                      {e.remetente_nome || e.remetente_email}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                      {e.urgencia && (
                        <span
                          title={e.motivo_classificacao || ''}
                          className={`text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full ${URGENCIA_BADGE[e.urgencia] || URGENCIA_BADGE.baixa}`}
                        >
                          {URGENCIA_LABEL[e.urgencia] || 'NORMAL'}
                        </span>
                      )}
                      {e.data_email && (
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">{e.data_email}</span>
                      )}
                    </div>
                  </div>

                  {/* Linha 2: assunto em destaque */}
                  <p className="font-semibold text-slate-800 text-[13px] mt-0.5 truncate">
                    {e.assunto || '(sem assunto)'}
                  </p>

                  {/* Linha 3: preview cinza */}
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {e.corpo_preview?.trim() || e.remetente_email}
                  </p>

                  {/* Tags + ações */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {e.setor_classificado && (
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded-full font-medium ${SETOR_STYLE[e.setor_classificado] || SETOR_STYLE.geral}`}>
                        {SETOR_LABEL[e.setor_classificado] || e.setor_classificado}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full font-normal bg-slate-50 text-slate-500 border-slate-200">
                      {e.account_login}
                    </Badge>

                    <div className="ml-auto flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => decidir(e.id, 'aprovar')}
                        disabled={processando === e.id}
                        className="gap-1 h-7 px-2.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="w-3.5 h-3.5" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decidir(e.id, 'rejeitar')}
                        disabled={processando === e.id}
                        className="gap-1 h-7 px-2.5 text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="w-3.5 h-3.5" /> Rejeitar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}