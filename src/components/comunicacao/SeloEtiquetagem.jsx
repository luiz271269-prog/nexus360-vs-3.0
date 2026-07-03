import React from 'react';
import { format } from 'date-fns';
import { Tag, AlertTriangle } from 'lucide-react';
import { getCategoriaConfig } from './CategorizadorRapido';

/**
 * Selo de etiquetagem exibido no topo de cada bolha de mensagem.
 *
 * - Se a mensagem tem etiquetas (message.categorias): mostra cada uma com
 *   sua data/hora individual (lida de message.metadata.etiquetas_meta).
 * - Se NÃO tem etiqueta: mostra um selo de alerta ⚠️ amarelo lembrando de etiquetar.
 *
 * O timestamp por etiqueta é gravado em message.metadata.etiquetas_meta:
 *   { [nomeEtiqueta]: { em: ISOString, por: "Nome do atendente" } }
 */
export default function SeloEtiquetagem({ message, categoriasDB = [], isOwn = false }) {
  const categorias = Array.isArray(message?.categorias) ? message.categorias : [];
  const etiquetasMeta = message?.metadata?.etiquetas_meta || {};

  // Sem etiqueta → alerta APENAS em IMAGENS ENVIADAS, como badge destacado
  // no canto superior direito da bolha (não polui mensagens de texto).
  if (categorias.length === 0) {
    if (!isOwn || message?.media_type !== 'image') return null;
    return (
      <div className="absolute -top-2.5 right-2 z-10 pointer-events-none">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white border border-amber-600 shadow-md">
          <AlertTriangle className="w-3 h-3" />
          Não etiquetado
        </span>
      </div>
    );
  }

  const formatarQuando = (iso) => {
    if (!iso) return null;
    try {
      return format(new Date(iso), 'dd/MM HH:mm');
    } catch {
      return null;
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 mb-1 px-2 pt-2">
      {categorias.map((cat) => {
        const config = getCategoriaConfig(cat, categoriasDB);
        const meta = etiquetasMeta[cat];
        const quando = formatarQuando(meta?.em);
        return (
          <span
            key={cat}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
            title={meta?.por ? `Etiquetado por ${meta.por}${quando ? ` em ${quando}` : ''}` : undefined}
          >
            <Tag className="w-2.5 h-2.5 text-purple-600" />
            {config.label}
            {quando && <span className="text-slate-400">· {quando}</span>}
          </span>
        );
      })}
    </div>
  );
}