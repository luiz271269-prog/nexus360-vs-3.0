import React, { useEffect, useState } from 'react';
import { aprovarEmailPendente } from '@/functions/aprovarEmailPendente';
import { listarEmailsPendentes } from '@/functions/listarEmailsPendentes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Check, X, RefreshCw, Inbox, MailQuestion, Ban, Server } from 'lucide-react';
import PainelLeituraEmail from '@/components/emails/PainelLeituraEmail';
import SeletorCaixasEmail from '@/components/emails/SeletorCaixasEmail';

const URGENCIA_BADGE = {
  alta: 'bg-red-500 text-white',
  media: 'bg-amber-400 text-white',
  baixa: 'bg-slate-400 text-white',
};
const URGENCIA_LABEL = { alta: 'URGENT', media: 'ATENÇÃO', baixa: 'NORMAL' };

// Tipo de contato do remetente (vindo do CRM)
const TIPO_CONTATO_STYLE = {
  cliente: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  lead: 'bg-blue-100 text-blue-700 border-blue-200',
  fornecedor: 'bg-orange-100 text-orange-700 border-orange-200',
  parceiro: 'bg-purple-100 text-purple-700 border-purple-200',
  eventual: 'bg-teal-100 text-teal-700 border-teal-200',
  ex_cliente: 'bg-rose-100 text-rose-700 border-rose-200',
  novo: 'bg-slate-100 text-slate-600 border-slate-200',
  email: 'bg-slate-100 text-slate-600 border-slate-200',
  desconhecido: 'bg-slate-100 text-slate-500 border-slate-200',
};
const TIPO_CONTATO_LABEL = {
  cliente: 'Cliente', lead: 'Lead', fornecedor: 'Fornecedor', parceiro: 'Parceiro',
  eventual: 'Eventual', ex_cliente: 'Ex-cliente', novo: 'Novo', email: 'E-mail',
  desconhecido: 'Desconhecido',
};

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

// Extrai o domínio da caixa de destino (account_login)
const dominioDe = (login = '') => {
  const at = (login || '').toLowerCase().split('@');
  return at[1] || 'outros';
};

export default function CaixaAprovacaoEmails() {
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(null);
  const [emailRejeitar, setEmailRejeitar] = useState(null);
  const [emailSelecionado, setEmailSelecionado] = useState(null);
  const [caixaAtiva, setCaixaAtiva] = useState('todas');

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

  const decidir = async (email_id, acao, bloquear_remetente = false) => {
    setProcessando(email_id);
    try {
      await aprovarEmailPendente({ email_id, acao, bloquear_remetente });
      if (acao === 'rejeitar' && bloquear_remetente) {
        const rem = pendentes.find((e) => e.id === email_id)?.remetente_email;
        setPendentes((prev) => prev.filter((e) => e.remetente_email !== rem));
      } else {
        setPendentes((prev) => prev.filter((e) => e.id !== email_id));
      }
      setEmailSelecionado((prev) => (prev?.id === email_id ? null : prev));
    } catch (e) {
      console.error('Erro ao decidir:', e);
    } finally {
      setProcessando(null);
    }
  };

  // Agrupa por domínio da caixa de destino (uma coluna por empresa)
  const grupos = {};
  for (const e of pendentes) {
    const dom = dominioDe(e.account_login);
    (grupos[dom] = grupos[dom] || []).push(e);
  }
  const todasColunas = Object.entries(grupos).sort((a, b) => b[1].length - a[1].length);

  // Caixas disponíveis para o seletor do topo (já filtradas por acesso no backend)
  const caixasDisponiveis = todasColunas.map(([dominio, lista]) => ({ dominio, total: lista.length }));

  // Aplica filtro da caixa ativa selecionada no topo
  const colunas = caixaAtiva === 'todas'
    ? todasColunas
    : todasColunas.filter(([dominio]) => dominio === caixaAtiva);

  return (
    <div className="space-y-3">
      {/* Barra de status */}
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

      {/* Seletor de caixas (filtra por domínio que o usuário tem acesso) */}
      {!loading && caixasDisponiveis.length > 1 && (
        <SeletorCaixasEmail
          caixas={caixasDisponiveis}
          ativa={caixaAtiva}
          onSelecionar={setCaixaAtiva}
        />
      )}

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
        <div className="flex gap-4 items-start">
        {/* Kanban: colunas horizontais por domínio */}
        <div className="flex gap-4 overflow-x-auto pb-3 kanban-scroll">
          {colunas.map(([dominio, lista]) => (
            <div key={dominio} className="flex-shrink-0 w-[320px] bg-slate-50 rounded-2xl border border-slate-200">
              {/* Cabeçalho da coluna */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 sticky top-0 bg-slate-50 rounded-t-2xl">
                <Server className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-700 text-sm truncate" title={dominio}>@{dominio}</span>
                <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                  {lista.length}
                </span>
              </div>

              {/* Cards da coluna */}
              <div className="p-2.5 space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto">
                {lista.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => setEmailSelecionado(e)}
                    className={`group relative bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-3 cursor-pointer ${emailSelecionado?.id === e.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-100'}`}
                  >
                    {/* Botão fechar (descartar visualmente da fila) */}
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setPendentes((prev) => prev.filter((x) => x.id !== e.id)); }}
                      title="Fechar (remover da lista sem decidir)"
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-start gap-2.5">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full ${corAvatar(e.remetente_email)} flex items-center justify-center text-white font-semibold text-xs shadow-sm`}>
                        {iniciais(e.remetente_nome, e.remetente_email)}
                      </div>

                      <div className="min-w-0 flex-1 pr-5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-[13px] truncate">
                            {e.remetente_nome || e.remetente_email}
                          </span>
                          {e.urgencia && (
                            <span
                              title={e.motivo_classificacao || ''}
                              className={`flex-shrink-0 text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full ${URGENCIA_BADGE[e.urgencia] || URGENCIA_BADGE.baixa}`}
                            >
                              {URGENCIA_LABEL[e.urgencia] || 'NORMAL'}
                            </span>
                          )}
                        </div>

                        <p className="font-semibold text-slate-800 text-[13px] mt-0.5 truncate">
                          {e.assunto || '(sem assunto)'}
                        </p>

                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {e.corpo_preview?.trim() || e.remetente_email}
                        </p>

                        {/* Tags: tipo de contato + setor */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded-full font-medium ${TIPO_CONTATO_STYLE[e.tipo_contato_remetente] || TIPO_CONTATO_STYLE.desconhecido}`}>
                            {TIPO_CONTATO_LABEL[e.tipo_contato_remetente] || 'Desconhecido'}
                          </Badge>
                          {e.setor_classificado && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full font-normal bg-slate-50 text-slate-500 border-slate-200">
                              {e.setor_classificado}
                            </Badge>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex gap-1.5 mt-2">
                          <Button
                            size="sm"
                            onClick={(ev) => { ev.stopPropagation(); decidir(e.id, 'aprovar'); }}
                            disabled={processando === e.id}
                            className="gap-1 h-7 px-2.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 flex-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(ev) => { ev.stopPropagation(); setEmailRejeitar(e); }}
                            disabled={processando === e.id}
                            className="gap-1 h-7 px-2.5 text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50 flex-1"
                          >
                            <X className="w-3.5 h-3.5" /> Rejeitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Painel de leitura do e-mail selecionado */}
        <div className="flex-1 min-w-[320px] sticky top-0 h-[calc(100vh-240px)]">
          <PainelLeituraEmail
            email={emailSelecionado}
            onFechar={() => setEmailSelecionado(null)}
            onAprovar={(id) => decidir(id, 'aprovar')}
            onRejeitar={(em) => setEmailRejeitar(em)}
            processando={processando}
          />
        </div>
        </div>
      )}

      {/* Diálogo de rejeição */}
      <AlertDialog open={!!emailRejeitar} onOpenChange={(o) => !o && setEmailRejeitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar este e-mail?</AlertDialogTitle>
            <AlertDialogDescription>
              Remetente: <strong>{emailRejeitar?.remetente_email}</strong>.<br />
              Escolha como deseja proceder. <span className="text-slate-500">Ao bloquear, os e-mails deste remetente são <strong>apagados de verdade no servidor Zimbra</strong> e ele não envia mais lixo para sua caixa.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <AlertDialogAction
              onClick={() => { const id = emailRejeitar.id; setEmailRejeitar(null); decidir(id, 'rejeitar', true); }}
              className="w-full gap-2 bg-red-600 hover:bg-red-700"
            >
              <Ban className="w-4 h-4" /> Bloquear e apagar no Zimbra
            </AlertDialogAction>
            <Button
              variant="outline"
              onClick={() => { const id = emailRejeitar.id; setEmailRejeitar(null); decidir(id, 'rejeitar', false); }}
              className="w-full"
            >
              Apenas rejeitar este e-mail
            </Button>
            <AlertDialogCancel className="w-full mt-0">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}