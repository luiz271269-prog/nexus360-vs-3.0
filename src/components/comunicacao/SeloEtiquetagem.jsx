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
export default function SeloEtiquetagem({ message, categoriasDB = [] }) {
  const categorias = Array.isArray(message?.categorias) ? message.categorias : [];
  const etiquetasMeta = message?.metadata?.etiquetas_meta || {};

  // Sem etiqueta → selo de alerta chamativo
  if (categorias.length === 0) {
    return (
      <div className="flex items-center gap-1 mb-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
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
    <div className="flex flex-wrap items-center gap-1 mb-1">
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