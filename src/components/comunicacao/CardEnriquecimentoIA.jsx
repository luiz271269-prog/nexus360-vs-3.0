import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, MapPin, Instagram as InstagramIcon, CheckCircle2, Building2, Mail, Briefcase, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const vazio = (v) => !v || String(v).trim() === '';

// Extrai o @handle do Instagram a partir de uma URL ou de um texto solto
const extrairHandle = (raw) => {
  if (!raw) return '';
  const m = String(raw).match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) return m[1].replace(/\/$/, '');
  return String(raw).replace('@', '').trim();
};

// Abre o perfil no Instagram: app nativo no celular (deep link),
// instagram.com no desktop (sessão já logada da NeuralTec) — pronto pra seguir.
const abrirInstagram = (handle) => {
  if (!handle) return;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    // Deep link abre direto no app do Instagram já logado no aparelho
    window.location.href = `instagram://user?username=${handle}`;
    // Fallback web caso o app não esteja instalado
    setTimeout(() => { window.open(`https://instagram.com/${handle}`, '_blank'); }, 800);
  } else {
    window.open(`https://instagram.com/${handle}`, '_blank');
  }
};

// Pré-análise local (SEM IA): detecta quais campos essenciais estão faltando
const camposEssenciais = (contact) => {
  const cp = contact?.campos_personalizados || {};
  return [
    { chave: 'empresa', label: 'Empresa', icon: Building2, falta: vazio(contact?.empresa) },
    { chave: 'ramo_atividade', label: 'Setor / Ramo', icon: Briefcase, falta: vazio(contact?.ramo_atividade) },
    { chave: 'email', label: 'E-mail', icon: Mail, falta: vazio(contact?.email) },
    { chave: 'localizacao', label: 'Localização (Maps)', icon: MapPin, falta: vazio(cp.localizacao_maps) },
    { chave: 'instagram_empresa', label: 'Instagram Empresa', icon: InstagramIcon, falta: vazio(cp.instagram_empresa) },
    { chave: 'instagram_contato', label: 'Instagram Contato', icon: InstagramIcon, falta: vazio(cp.instagram_contato) }
  ];
};

export default function CardEnriquecimentoIA({ contact, onUpdate }) {
  const [carregando, setCarregando] = React.useState(false);

  // Vínculo automático com o CRM (100% interno, SEM IA): roda ao abrir os
  // detalhes do contato. Só dispara se ainda não há cliente vinculado e há
  // dados para casar (empresa/nome/telefone). Não gasta créditos de IA.
  React.useEffect(() => {
    if (!contact?.id) return;
    if (contact.cliente_id) return;
    const temDadosParaCasar = contact.empresa || contact.nome || contact.telefone || contact.telefone_canonico;
    if (!temDadosParaCasar) return;

    let cancelado = false;
    (async () => {
      try {
        const resp = await base44.functions.invoke('vincularClienteAutomatico', { contact_id: contact.id });
        const data = resp?.data;
        if (cancelado) return;
        if (data?.vinculado) {
          toast.success(`🔗 Vinculado ao cliente: ${data.cliente_nome}`);
          if (onUpdate) await onUpdate();
        }
      } catch (_) { /* best-effort, silencioso */ }
    })();

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id]);

  if (!contact) return null;

  const campos = camposEssenciais(contact);
  const faltantes = campos.filter((c) => c.falta);
  const cp = contact.campos_personalizados || {};

  // É fidelizado se tem qualquer atendente fidelizado definido
  const isFidelizado = !!(
    contact.atendente_fidelizado_vendas ||
    contact.atendente_fidelizado_assistencia ||
    contact.atendente_fidelizado_fornecedor ||
    contact.is_cliente_fidelizado
  );

  // Regra de exibição (B): só mostra o enriquecimento por IA para
  // contatos fidelizados OU do tipo "cliente". Demais tipos não exibem.
  const podeEnriquecer = isFidelizado || contact.tipo_contato === 'cliente';
  if (!podeEnriquecer) return null;

  const handleEnriquecer = async () => {
    setCarregando(true);
    try {
      const resp = await base44.functions.invoke('enriquecerContatoComIA', { contact_id: contact.id });
      const data = resp?.data;

      if (data?.success && (data?.campos_preenchidos || []).length > 0) {
        toast.success(`✅ Cadastro atualizado: ${data.campos_preenchidos.join(', ')}`);
      } else {
        toast.info(data?.reason || 'A IA não encontrou novos dados confiáveis.');
      }

      // Sempre recarrega o contato — garante que o card e os campos reflitam o banco
      // (corrige o "Faltam N campos" fantasma quando os dados já existiam).
      if (onUpdate) await onUpdate();
    } catch (error) {
      toast.error('Erro ao consultar a IA: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleIgEmpresa = extrairHandle(cp.instagram_empresa || cp.instagram_empresa_url);
  const handleIgContato = extrairHandle(cp.instagram_contato || cp.instagram_contato_url);
  const temInstagram = !!(handleIgEmpresa || handleIgContato);

  // Botões grandes e indutivos de Maps / Instagram (reutilizados nos dois estados).
  // Quando houver os DOIS Instagrams (empresa + contato), mostra 2 botões separados.
  const BotoesAcesso = () => (
    <div className="flex flex-col gap-2">
      {cp.localizacao_maps && (
        <a
          href={cp.localizacao_maps}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all"
        >
          <MapPin className="w-4 h-4" /> Ver no Maps
        </a>
      )}
      {(handleIgEmpresa || handleIgContato) && (
        <div className="flex gap-2">
          {handleIgEmpresa && (
            <button
              type="button"
              onClick={() => abrirInstagram(handleIgEmpresa)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-2 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-sm transition-all"
            >
              <InstagramIcon className="w-4 h-4" /> {handleIgContato ? 'Empresa' : 'Instagram'}
            </button>
          )}
          {handleIgContato && (
            <button
              type="button"
              onClick={() => abrirInstagram(handleIgContato)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-2 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-sm transition-all"
            >
              <InstagramIcon className="w-4 h-4" /> {handleIgEmpresa ? 'Contato' : 'Instagram'}
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Tudo preenchido → confirmação + botões grandes + 3º botão "Reatualizar com IA"
  if (faltantes.length === 0) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-green-200 bg-green-50 p-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-800 font-medium">Cadastro completo</span>
        </div>
        {(cp.localizacao_maps || temInstagram) && (
          <div className="mt-2.5 pt-2.5 border-t border-green-200">
            <BotoesAcesso />
          </div>
        )}
        <button
          type="button"
          onClick={handleEnriquecer}
          disabled={carregando}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
        >
          {carregando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {carregando ? 'Reatualizando...' : 'Reatualizar com IA'}
        </button>
      </div>
    );
  }

  return (
    <div className={`mx-4 mb-3 rounded-xl border p-3 ${isFidelizado ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className={`w-4 h-4 ${isFidelizado ? 'text-purple-600' : 'text-slate-500'}`} />
        <span className="text-xs font-semibold text-slate-700">
          {isFidelizado ? 'Contato fidelizado — ' : ''}Faltam {faltantes.length} {faltantes.length === 1 ? 'campo' : 'campos'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {faltantes.map((c) => (
          <span key={c.chave} className="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 text-slate-600 rounded-full px-2 py-0.5">
            <c.icon className="w-3 h-3" /> {c.label}
          </span>
        ))}
      </div>

      <Button
        onClick={handleEnriquecer}
        disabled={carregando}
        size="sm"
        className={`w-full ${isFidelizado ? 'bg-purple-600 hover:bg-purple-700' : 'bg-slate-700 hover:bg-slate-800'} text-white`}
      >
        {carregando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {carregando ? 'Buscando dados...' : 'Atualizar com IA'}
      </Button>

      {/* Botões grandes dos dados já encontrados (Maps / Instagram) */}
      {(cp.localizacao_maps || temInstagram) && (
        <div className="mt-2.5">
          <BotoesAcesso />
        </div>
      )}
    </div>
  );
}