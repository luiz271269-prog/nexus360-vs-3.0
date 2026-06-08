import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Mail, Server, Clock, Loader2 } from 'lucide-react';
import { buscarCorpoEmailImap } from '@/functions/buscarCorpoEmailImap';

const URGENCIA_BADGE = {
  alta: 'bg-red-500 text-white',
  media: 'bg-amber-400 text-white',
  baixa: 'bg-slate-400 text-white',
};
const URGENCIA_LABEL = { alta: 'URGENTE', media: 'ATENÇÃO', baixa: 'NORMAL' };

// Painel lateral de leitura do e-mail selecionado
export default function PainelLeituraEmail({ email, onFechar, onAprovar, onRejeitar, processando }) {
  const [corpo, setCorpo] = useState('');
  const [carregandoCorpo, setCarregandoCorpo] = useState(false);
  const [erroCorpo, setErroCorpo] = useState('');

  // Carrega o corpo completo do servidor IMAP ao selecionar um e-mail
  useEffect(() => {
    if (!email?.id) return;
    let ativo = true;
    setCorpo('');
    setErroCorpo('');
    // Se já veio corpo persistido, usa direto
    if (email.corpo_preview && email.corpo_preview.trim().length > 0) {
      setCorpo(email.corpo_preview);
      return;
    }
    setCarregandoCorpo(true);
    buscarCorpoEmailImap({ email_id: email.id })
      .then((res) => {
        if (!ativo) return;
        const data = res?.data || res;
        if (data?.ok) setCorpo(data.corpo || '');
        else setErroCorpo(data?.error || 'Falha ao carregar o conteúdo.');
      })
      .catch((e) => { if (ativo) setErroCorpo(e?.message || 'Falha ao carregar o conteúdo.'); })
      .finally(() => { if (ativo) setCarregandoCorpo(false); });
    return () => { ativo = false; };
  }, [email?.id]);

  if (!email) {
    return (
      <div className="h-full w-full flex-1 min-w-0 flex flex-col items-center justify-center text-slate-300 bg-white md:rounded-2xl border border-slate-100">
        <Mail className="w-14 h-14 mb-3 opacity-30" />
        <p className="text-sm text-slate-400">Selecione um e-mail para ler o conteúdo</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex-1 min-w-0 flex flex-col bg-white md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-slate-900 text-base truncate">
              {email.assunto || '(sem assunto)'}
            </h2>
            {email.urgencia && (
              <span className={`flex-shrink-0 text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full ${URGENCIA_BADGE[email.urgencia] || URGENCIA_BADGE.baixa}`}>
                {URGENCIA_LABEL[email.urgencia] || 'NORMAL'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 font-medium mt-1 truncate">
            {email.remetente_nome || email.remetente_email}
          </p>
          <p className="text-xs text-slate-400 truncate">{email.remetente_email}</p>
        </div>
        <button
          onClick={onFechar}
          title="Fechar"
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-slate-50 text-xs text-slate-400 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <Server className="w-3.5 h-3.5" /> {email.account_login}
        </span>
        {email.data_email && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {email.data_email}
          </span>
        )}
        {email.setor_classificado && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full bg-slate-50 text-slate-500 border-slate-200">
            {email.setor_classificado}
          </Badge>
        )}
      </div>

      {/* Corpo */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {carregandoCorpo ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando conteúdo do e-mail...
          </div>
        ) : erroCorpo ? (
          <p className="text-sm text-red-500">{erroCorpo}</p>
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {corpo?.trim() || 'Sem conteúdo disponível.'}
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
        <Button
          onClick={() => onAprovar(email.id)}
          disabled={processando === email.id}
          className="gap-1.5 flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          <Check className="w-4 h-4" /> Aprovar
        </Button>
        <Button
          variant="outline"
          onClick={() => onRejeitar(email)}
          disabled={processando === email.id}
          className="gap-1.5 flex-1 text-red-600 border-red-200 hover:bg-red-50"
        >
          <X className="w-4 h-4" /> Rejeitar
        </Button>
      </div>
    </div>
  );
}