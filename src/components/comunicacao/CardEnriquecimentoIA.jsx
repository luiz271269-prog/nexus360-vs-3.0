import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, MapPin, Instagram as InstagramIcon, CheckCircle2, Building2, Mail, Briefcase, RefreshCw, Pencil, Check, X } from 'lucide-react';
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
  // Edição manual inline: qual campo está aberto ('maps' | 'ig_empresa' | 'ig_contato' | null) e o valor digitado
  const [editando, setEditando] = React.useState(null);
  const [valorEdicao, setValorEdicao] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);

  // Salva a correção manual de Maps/Instagram direto no contato (SEM IA).
  // Permite trocar quando a IA acertou o perfil errado ou o endereço errado.
  const salvarCorrecao = async (campo, valor) => {
    const v = String(valor || '').trim();
    setSalvando(true);
    try {
      const cpAtual = contact.campos_personalizados || {};
      const novosCampos = { ...cpAtual };

      if (campo === 'maps') {
        novosCampos.localizacao_maps = v;
      } else if (campo === 'ig_empresa') {
        const h = extrairHandle(v);
        novosCampos.instagram_empresa = h ? `@${h}` : '';
        novosCampos.instagram_empresa_url = h ? `https://instagram.com/${h}` : '';
      } else if (campo === 'ig_contato') {
        const h = extrairHandle(v);
        novosCampos.instagram_contato = h ? `@${h}` : '';
        novosCampos.instagram_contato_url = h ? `https://instagram.com/${h}` : '';
      }

      await base44.entities.Contact.update(contact.id, { campos_personalizados: novosCampos });
      toast.success('✅ Corrigido');
      setEditando(null);
      setValorEdicao('');
      if (onUpdate) await onUpdate();
    } catch (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (campo, valorAtual) => {
    setEditando(campo);
    setValorEdicao(valorAtual || '');
  };

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

  // Campo de edição inline reutilizável: input + salvar + cancelar
  const CampoEdicao = ({ campo, placeholder }) => (
    <div className="flex items-center gap-1.5 w-full">
      <Input
        autoFocus
        value={valorEdicao}
        onChange={(e) => setValorEdicao(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') salvarCorrecao(campo, valorEdicao);
          if (e.key === 'Escape') { setEditando(null); setValorEdicao(''); }
        }}
        placeholder={placeholder}
        className="h-8 text-xs"
        disabled={salvando}
      />
      <button
        type="button"
        onClick={() => salvarCorrecao(campo, valorEdicao)}
        disabled={salvando}
        className="flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        title="Salvar"
      >
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={() => { setEditando(null); setValorEdicao(''); }}
        disabled={salvando}
        className="flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600"
        title="Cancelar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  // Botãozinho de lápis para corrigir manualmente um item
  const BotaoCorrigir = ({ campo, valorAtual }) => (
    <button
      type="button"
      onClick={() => abrirEdicao(campo, valorAtual)}
      className="flex-shrink-0 w-9 inline-flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all"
      title="Corrigir manualmente"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );

  // Botões grandes e indutivos de Maps / Instagram (reutilizados nos dois estados).
  // Quando houver os DOIS Instagrams (empresa + contato), mostra 2 botões separados.
  // Cada item tem um lápis "Corrigir" para trocar manualmente quando a IA errou.
  const BotoesAcesso = () => (
    <div className="flex flex-col gap-2">
      {/* Maps */}
      {editando === 'maps' ? (
        <CampoEdicao campo="maps" placeholder="Cole o link do Google Maps" />
      ) : cp.localizacao_maps && (
        <div className="flex gap-1.5">
          <a
            href={cp.localizacao_maps}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all"
          >
            <MapPin className="w-4 h-4" /> Ver no Maps
          </a>
          <BotaoCorrigir campo="maps" valorAtual={cp.localizacao_maps} />
        </div>
      )}

      {/* Instagram Empresa */}
      {editando === 'ig_empresa' ? (
        <CampoEdicao campo="ig_empresa" placeholder="@perfil ou link da empresa" />
      ) : handleIgEmpresa && (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => abrirInstagram(handleIgEmpresa)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-2 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-sm transition-all"
          >
            <InstagramIcon className="w-4 h-4" /> {handleIgContato ? 'Empresa' : 'Instagram'} (@{handleIgEmpresa})
          </button>
          <BotaoCorrigir campo="ig_empresa" valorAtual={cp.instagram_empresa} />
        </div>
      )}

      {/* Instagram Contato */}
      {editando === 'ig_contato' ? (
        <CampoEdicao campo="ig_contato" placeholder="@perfil ou link do contato" />
      ) : handleIgContato && (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => abrirInstagram(handleIgContato)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-2 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-sm transition-all"
          >
            <InstagramIcon className="w-4 h-4" /> {handleIgEmpresa ? 'Contato' : 'Instagram'} (@{handleIgContato})
          </button>
          <BotaoCorrigir campo="ig_contato" valorAtual={cp.instagram_contato} />
        </div>
      )}

      {/* Adicionar manualmente o que ainda não existe */}
      {(!cp.localizacao_maps && editando !== 'maps') && (
        <button type="button" onClick={() => abrirEdicao('maps', '')} className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 rounded-lg px-3 py-1.5">
          <MapPin className="w-3.5 h-3.5" /> Adicionar Maps manualmente
        </button>
      )}
      {(!handleIgEmpresa && editando !== 'ig_empresa') && (
        <button type="button" onClick={() => abrirEdicao('ig_empresa', '')} className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 rounded-lg px-3 py-1.5">
          <InstagramIcon className="w-3.5 h-3.5" /> Adicionar Instagram da empresa
        </button>
      )}
      {(!handleIgContato && editando !== 'ig_contato') && (
        <button type="button" onClick={() => abrirEdicao('ig_contato', '')} className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 rounded-lg px-3 py-1.5">
          <InstagramIcon className="w-3.5 h-3.5" /> Adicionar Instagram do contato
        </button>
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
        <div className="mt-2.5 pt-2.5 border-t border-green-200">
          <BotoesAcesso />
        </div>
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

      {/* Botões grandes dos dados já encontrados + correção/adição manual (Maps / Instagram) */}
      <div className="mt-2.5">
        <BotoesAcesso />
      </div>
    </div>
  );
}