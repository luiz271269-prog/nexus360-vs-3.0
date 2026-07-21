import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus } from "lucide-react";

/**
 * Dialog para buscar e selecionar clientes a adicionar em uma ListaVendedor.
 * Mostra apenas clientes que ainda não estão na lista.
 */
export default function AdicionarClientesListaDialog({ open, onClose, lista, clientes = [], onConfirm }) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState([]);

  const jaNaLista = new Set(lista?.cliente_ids || []);
  const disponiveis = clientes.filter(c => !jaNaLista.has(c.id));
  const filtrados = busca
    ? disponiveis.filter(c => {
        const q = busca.toLowerCase();
        return (
          c.razao_social?.toLowerCase().includes(q) ||
          c.nome_fantasia?.toLowerCase().includes(q) ||
          c.cnpj?.includes(q)
        );
      })
    : disponiveis;

  const toggle = (id) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleConfirmar = () => {
    if (selecionados.length === 0) return;
    onConfirm(selecionados);
    setSelecionados([]);
    setBusca("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelecionados([]); setBusca(""); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar clientes à "{lista?.nome}"</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, fantasia ou CNPJ..."
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1 border rounded-lg p-2">
          {filtrados.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Nenhum cliente disponível.</p>
          ) : (
            filtrados.slice(0, 100).map(c => (
              <label
                key={c.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                <Checkbox
                  checked={selecionados.includes(c.id)}
                  onCheckedChange={() => toggle(c.id)}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {c.razao_social || c.nome_fantasia}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {c.vendedor_responsavel ? `Resp.: ${c.vendedor_responsavel}` : 'Sem responsável'}
                    {c.cidade ? ` · ${c.cidade}` : ''}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirmar}
            disabled={selecionados.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar {selecionados.length > 0 ? `(${selecionados.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}