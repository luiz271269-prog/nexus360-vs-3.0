import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const fmtMoeda = (v) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Lista os clientes que tiveram faturamento (NFes do Neural Fin) mas ainda
 * NÃO existem na entidade Cliente do CRM. Permite cadastrá-los rapidamente.
 */
export default function ClientesNaoCadastrados({ clientes = [], onCadastrar }) {
  const [aberto, setAberto] = useState(false);
  const [cadastrando, setCadastrando] = useState(null); // nome em processamento
  const totalFaturado = clientes.reduce((s, c) => s + (c.totalFaturado || 0), 0);
  const visiveis = aberto ? clientes : clientes.slice(0, 6);

  const handleClick = async (c) => {
    setCadastrando(c.nome);
    try {
      await onCadastrar({ nome: c.nome, vendedor: c.vendedor });
    } finally {
      setCadastrando(null);
    }
  };

  return (
    <Card className="shadow-lg border-2 border-amber-200/70 bg-amber-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 text-slate-800">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            {clientes.length} clientes faturaram mas não estão cadastrados
          </span>
          <Badge className="bg-amber-600 hover:bg-amber-700">{fmtMoeda(totalFaturado)}</Badge>
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">
          Têm notas fiscais emitidas no Neural Fin, porém ainda não existem na base de clientes. Cadastre para unificar a gestão.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {visiveis.map((c, i) => (
            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.nome}</p>
                <p className="text-xs text-slate-400 truncate">
                  {c.vendedor || "Sem responsável"} · {c.qtdNotas} NF · {fmtMoeda(c.totalFaturado)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={cadastrando === c.nome}
                className="shrink-0 ml-2 h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => handleClick(c)}
              >
                {cadastrando === c.nome ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                Cadastrar
              </Button>
            </div>
          ))}
        </div>

        {clientes.length > 6 && (
          <Button variant="link" className="mt-3 text-amber-700" onClick={() => setAberto(!aberto)}>
            {aberto ? (
              <><ChevronUp className="w-4 h-4 mr-1" /> Mostrar menos</>
            ) : (
              <><ChevronDown className="w-4 h-4 mr-1" /> Ver todos os {clientes.length}</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}