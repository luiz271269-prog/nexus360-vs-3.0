import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Phone, Briefcase, Loader2 } from "lucide-react";

// Lista os Contatos (pessoas) vinculados a este Cliente (empresa).
// Reforça visualmente o princípio: a empresa é o vínculo-mãe e pode ter
// vários contatos — compras, financeiro, técnico, etc.
export default function ContatosDaEmpresa({ clienteId }) {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clienteId) return;
    let ativo = true;
    setLoading(true);
    base44.entities.Contact.filter({ cliente_id: clienteId }, '-updated_date', 50)
      .then((res) => { if (ativo) setContatos(res || []); })
      .catch(() => { if (ativo) setContatos([]); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [clienteId]);

  if (!clienteId) return null;

  return (
    <div className="bg-black/30 rounded-lg border border-blue-500/30 p-2 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-3.5 h-3.5 text-blue-400" />
        <h3 className="text-blue-300 font-bold text-[11px]">
          Contatos desta empresa {contatos.length > 0 && `(${contatos.length})`}
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-[11px] py-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
        </div>
      ) : contatos.length === 0 ? (
        <p className="text-gray-500 text-[11px] py-1">
          Nenhum contato vinculado ainda. Os contatos (compras, financeiro, técnico)
          aparecem aqui quando associados a esta empresa.
        </p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {contatos.map((c) => (
            <div key={c.id} className="flex items-center gap-2 bg-white/5 rounded px-2 py-1">
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-medium truncate">{c.nome}</p>
                <div className="flex items-center gap-2 text-gray-400 text-[10px]">
                  {c.telefone && (
                    <span className="flex items-center gap-1 truncate">
                      <Phone className="w-2.5 h-2.5" /> {c.telefone}
                    </span>
                  )}
                  {c.cargo && (
                    <span className="flex items-center gap-1 truncate">
                      <Briefcase className="w-2.5 h-2.5" /> {c.cargo}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}