import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Loader2 } from "lucide-react";

/**
 * Dialog para buscar e selecionar Contatos (Contact) a adicionar em uma ListaVendedor.
 */
export default function AdicionarContatosListaDialog({ open, onClose, lista, onConfirm }) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState([]);

  const { data: contatos = [], isLoading } = useQuery({
    queryKey: ['contatosParaLista'],
    queryFn: () => base44.entities.Contact.list('-updated_date', 1000),
    enabled: open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const jaNaLista = new Set(lista?.contato_ids || []);
  const disponiveis = contatos.filter(c => !jaNaLista.has(c.id));
  const filtrados = busca
    ? disponiveis.filter(c => {
        const q = busca.toLowerCase();
        return (
          c.nome?.toLowerCase().includes(q) ||
          c.empresa?.toLowerCase().includes(q) ||
          c.telefone?.includes(busca)
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
          <DialogTitle>Adicionar contatos à "{lista?.nome}"</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, empresa ou telefone..."
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1 border rounded-lg p-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Nenhum contato disponível.</p>
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
                  <p className="text-sm font-medium text-slate-800 truncate">{c.nome}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {c.empresa || 'Sem empresa'}{c.telefone ? ` · ${c.telefone}` : ''}
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
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar {selecionados.length > 0 ? `(${selecionados.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}