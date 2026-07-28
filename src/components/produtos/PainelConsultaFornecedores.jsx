import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Calculator, Store } from "lucide-react";

const LOJAS = [
  { id: "matriz", nome: "Às Vezes Tem (Matriz)", url: "https://asvezestem.com.br/produtos/" },
  { id: "tubarao", nome: "Tubarão", url: "https://asvezestemtubarao.com.br/" },
  { id: "garopaba", nome: "Garopaba", url: "https://asvezestemgaropaba.com.br/eletronicos/" },
  { id: "criciuma", nome: "Criciúma", url: "https://asvezestemcriciuma.com.br/eletronicos/" },
];

const MARGEM = 1.5; // % de margem de venda

export default function PainelConsultaFornecedores() {
  const [lojaAtiva, setLojaAtiva] = useState(LOJAS[0]);
  const [precoFornecedor, setPrecoFornecedor] = useState("");

  const precoNum = parseFloat(String(precoFornecedor).replace(",", ".")) || 0;
  const precoVenda = precoNum * (1 + MARGEM / 100);

  return (
    <div className="flex flex-col h-full gap-3 p-3">
      {/* Barra de lojas + calculadora */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 bg-white/80 border-2 border-orange-200 rounded-xl p-3 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Store className="w-5 h-5 text-orange-500 flex-shrink-0" />
          {LOJAS.map((loja) => (
            <Button
              key={loja.id}
              size="sm"
              variant={lojaAtiva.id === loja.id ? "default" : "outline"}
              className={lojaAtiva.id === loja.id
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white h-8 text-xs"
                : "border-orange-300 h-8 text-xs"}
              onClick={() => setLojaAtiva(loja)}
            >
              {loja.nome}
            </Button>
          ))}
          <a href={lojaAtiva.url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="h-8 text-xs text-orange-600 gap-1">
              <ExternalLink className="w-3.5 h-3.5" /> Abrir em nova aba
            </Button>
          </a>
        </div>

        {/* Calculadora de margem 1.5% */}
        <div className="flex items-center gap-2 lg:ml-auto bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg px-3 py-1.5">
          <Calculator className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <Label className="text-xs text-slate-600 whitespace-nowrap">Preço fornecedor R$</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={precoFornecedor}
            onChange={(e) => setPrecoFornecedor(e.target.value)}
            placeholder="0,00"
            className="w-24 h-8 text-sm bg-white"
          />
          <span className="text-xs text-slate-500 whitespace-nowrap">+ {MARGEM}% =</span>
          <span className="font-bold text-emerald-700 text-sm whitespace-nowrap">
            {precoVenda > 0
              ? precoVenda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "R$ 0,00"}
          </span>
        </div>
      </div>

      {/* Site do fornecedor embutido */}
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border-2 border-orange-200 shadow-lg bg-white">
        <iframe
          key={lojaAtiva.id}
          src={lojaAtiva.url}
          title={`Fornecedor ${lojaAtiva.nome}`}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      <p className="text-[11px] text-slate-400 flex-shrink-0">
        💡 Se o site não carregar aqui (bloqueio do fornecedor), use o botão "Abrir em nova aba".
      </p>
    </div>
  );
}