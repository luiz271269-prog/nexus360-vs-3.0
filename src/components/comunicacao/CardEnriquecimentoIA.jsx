import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, MapPin, Instagram as InstagramIcon, CheckCircle2, Building2, Mail, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const vazio = (v) => !v || String(v).trim() === '';

// Pré-análise local (SEM IA): detecta quais campos essenciais estão faltando
const camposEssenciais = (contact) => {
  const cp = contact?.campos_personalizados || {};
  return [
    { chave: 'empresa', label: 'Empresa', icon: Building2, falta: vazio(contact?.empresa) },
    { chave: 'ramo_atividade', label: 'Setor / Ramo', icon: Briefcase, falta: vazio(contact?.ramo_atividade) },
    { chave: 'email', label: 'E-mail', icon: Mail, falta: vazio(contact?.email) },
    { chave: 'localizacao', label: 'Localização (Maps)', icon: MapPin, falta: vazio(cp.localizacao_maps) },
    { chave: 'instagram', label: 'Instagram', icon: InstagramIcon, falta: vazio(cp.instagram) }
  ];
};

export default function CardEnriquecimentoIA({ contact, onUpdate }) {
  const [carregando, setCarregando] = React.useState(false);

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

      const vinculo = data?.vinculo_crm;
      if (vinculo?.vinculado) {
        toast.success(`🔗 Vinculado ao cliente: ${vinculo.cliente_nome}`);
      } else if (vinculo?.sugestoes?.length) {
        toast.info(`Encontrei ${vinculo.sugestoes.length} cliente(s) parecido(s) — confira o vínculo no painel.`);
      }

      if (data?.success && (data?.campos_preenchidos || []).length > 0) {
        toast.success(`✅ Cadastro atualizado: ${data.campos_preenchidos.join(', ')}`);
      } else if (!vinculo?.vinculado) {
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

  // Tudo preenchido → mostra confirmação + links rápidos (Maps / Instagram)
  if (faltantes.length === 0) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-green-200 bg-green-50 p-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-800 font-medium">Cadastro completo</span>
        </div>
        {(cp.localizacao_maps || cp.instagram_url) && (
          <div className="flex gap-2 mt-2 pt-2 border-t border-green-200">
            {cp.localizacao_maps && (
              <a href={cp.localizacao_maps} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] text-blue-600 hover:underline">
                <MapPin className="w-3 h-3" /> Ver no Maps
              </a>
            )}
            {cp.instagram_url && (
              <a href={cp.instagram_url} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] text-pink-600 hover:underline">
                <InstagramIcon className="w-3 h-3" /> {cp.instagram}
              </a>
            )}
          </div>
        )}
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

      {/* Mostrar links já encontrados (Maps / Instagram) */}
      {(cp.localizacao_maps || cp.instagram) && (
        <div className="flex gap-2 mt-2">
          {cp.localizacao_maps && (
            <a href={cp.localizacao_maps} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] text-blue-600 hover:underline">
              <MapPin className="w-3 h-3" /> Ver no Maps
            </a>
          )}
          {cp.instagram_url && (
            <a href={cp.instagram_url} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] text-pink-600 hover:underline">
              <InstagramIcon className="w-3 h-3" /> {cp.instagram}
            </a>
          )}
        </div>
      )}
    </div>
  );
}