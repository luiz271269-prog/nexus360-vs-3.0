import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save } from "lucide-react";
import { LOJAS_FORNECEDOR, configDaLoja } from "./precificacaoFornecedor";

export default function ModalConfigPrecificacaoLojas({ aberto, configs, cotacaoSite, onSalvar, onClose }) {
  const [local, setLocal] = useState(configs || {});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (aberto) setLocal(configs || {}); }, [aberto, configs]);

  const setCampo = (lojaId, campo, valor) =>
    setLocal((prev) => ({
      ...prev,
      [lojaId]: { ...configDaLoja(prev, lojaId), [campo]: parseFloat(String(valor).replace(",", ".")) || 0 },
    }));

  const salvar = async () => {
    setSalvando(true);
    await onSalvar(local);
    setSalvando(false);
    onClose();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Precificação por loja</DialogTitle>
        </DialogHeader>

        {cotacaoSite && (
          <p className="text-xs text-slate-500">
            Cotação publicada hoje pela Visão VIP: <strong>R$ {cotacaoSite}</strong> por dólar.
          </p>
        )}

        <div className="space-y-3">
          {LOJAS_FORNECEDOR.map((loja) => {
            const cfg = configDaLoja(local, loja.id);
            return (
              <div key={loja.id} className="border-2 border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-slate-800 text-sm">{loja.nome}</span>
                  <Badge variant="outline" className="text-[10px]">{loja.moeda}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px] text-slate-500">Dólar (R$)</Label>
                    <Input
                      value={cfg.dolar}
                      onChange={(e) => setCampo(loja.id, "dolar", e.target.value)}
                      disabled={loja.moeda !== "USD"}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Frete (R$)</Label>
                    <Input value={cfg.frete} onChange={(e) => setCampo(loja.id, "frete", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Margem (%)</Label>
                    <Input value={cfg.margem} onChange={(e) => setCampo(loja.id, "margem", e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} className="gap-1.5 bg-orange-500 hover:bg-orange-600">
            <Save className="w-4 h-4" /> Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}