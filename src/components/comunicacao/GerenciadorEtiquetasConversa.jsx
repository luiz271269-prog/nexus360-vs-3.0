import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tag, Plus, Trash2, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { normalizarSlugEtiqueta } from "../lib/normalizarEtiqueta";

const SETORES = [
  { value: 'geral', label: 'Geral (todos)', cor: 'bg-slate-500' },
  { value: 'vendas', label: 'Vendas', cor: 'bg-green-600' },
  { value: 'assistencia', label: 'Assistência', cor: 'bg-orange-500' },
  { value: 'financeiro', label: 'Financeiro', cor: 'bg-amber-500' },
  { value: 'fornecedor', label: 'Fornecedor', cor: 'bg-purple-500' },
  { value: 'compras', label: 'Compras', cor: 'bg-blue-600' },
];

const CORES = [
  'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500',
  'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500',
];

const FORM_INICIAL = { nome: '', label: '', emoji: '🏷️', cor: 'bg-slate-500', setor: 'geral', descricao: '' };

/**
 * Gerenciador das etiquetas de CONVERSA, organizadas por setor.
 * Criação restrita a admin / gerente / coordenador. Anti-duplicado por slug canônico.
 */
export default function GerenciadorEtiquetasConversa({ usuarioAtual }) {
  const queryClient = useQueryClient();
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);

  const isAdmin = usuarioAtual?.role === 'admin';
  const podeCriarEtiqueta = isAdmin || ['gerente', 'coordenador'].includes(usuarioAtual?.attendant_role);

  const { data: etiquetas = [], isLoading } = useQuery({
    queryKey: ['etiquetas-conversa'],
    queryFn: () => base44.entities.EtiquetaConversa.filter({}, 'ordem'),
    staleTime: 60 * 1000,
  });

  const etiquetasFiltradas = useMemo(() => {
    if (filtroSetor === 'todos') return etiquetas;
    return etiquetas.filter(e => e.setor === filtroSetor);
  }, [etiquetas, filtroSetor]);

  const salvarMutation = useMutation({
    mutationFn: async ({ id, ...data }) => {
      if (id) return base44.entities.EtiquetaConversa.update(id, data);
      return base44.entities.EtiquetaConversa.create({ ...data, ativa: true, uso_count: 0 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etiquetas-conversa'] });
      toast.success('✅ Etiqueta salva!');
      setModalAberto(false);
      setEditando(null);
      setForm(FORM_INICIAL);
    },
    onError: () => toast.error('Erro ao salvar etiqueta'),
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.EtiquetaConversa.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etiquetas-conversa'] });
      toast.success('Etiqueta removida');
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const abrirNovo = () => { setEditando(null); setForm(FORM_INICIAL); setModalAberto(true); };
  const abrirEdicao = (etq) => { setEditando(etq); setForm({ ...FORM_INICIAL, ...etq }); setModalAberto(true); };

  const handleSalvar = () => {
    if (!form.label.trim()) { toast.error('Nome da etiqueta é obrigatório'); return; }
    const slug = normalizarSlugEtiqueta(form.nome || form.label);

    if (!editando) {
      if (!podeCriarEtiqueta) { toast.error('❌ Apenas admin, gerente ou coordenador podem criar etiquetas'); return; }
      const dup = etiquetas.find(e =>
        normalizarSlugEtiqueta(e.nome) === slug || normalizarSlugEtiqueta(e.label) === slug
      );
      if (dup) { toast.warning(`Já existe etiqueta equivalente: ${dup.emoji || '🏷️'} ${dup.label}`); return; }
    }

    salvarMutation.mutate({ id: editando?.id, ...form, nome: slug });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Etiquetas de Conversa por Setor</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtroSetor} onValueChange={setFiltroSetor}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {SETORES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {podeCriarEtiqueta && (
            <Button onClick={abrirNovo} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nova Etiqueta
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-4">
          {SETORES.filter(s => filtroSetor === 'todos' || s.value === filtroSetor).map(setor => {
            const doSetor = etiquetasFiltradas.filter(e => e.setor === setor.value);
            if (doSetor.length === 0) return null;
            return (
              <div key={setor.value}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-3 h-3 rounded-full ${setor.cor}`} />
                  <span className="text-sm font-semibold text-slate-600">{setor.label}</span>
                  <Badge variant="secondary" className="text-xs">{doSetor.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {doSetor.map(etq => (
                    <Card key={etq.id} className="p-3 flex items-center justify-between hover:shadow-md transition-shadow">
                      <button onClick={() => abrirEdicao(etq)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white ${etq.cor}`}>{etq.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{etq.label}</p>
                          <p className="text-[11px] text-slate-400">{etq.uso_count || 0} usos</p>
                        </div>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => { if (confirm(`Excluir etiqueta "${etq.label}"?`)) deletarMutation.mutate(etq.id); }}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" />
              {editando ? 'Editar Etiqueta' : 'Nova Etiqueta de Conversa'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <div>
                <label className="text-xs text-slate-500">Emoji</label>
                <Input value={form.emoji} onChange={(e) => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={2} className="text-center" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Nome</label>
                <Input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Aguardando Pagamento" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Setor</label>
              <Select value={form.setor} onValueChange={(v) => setForm(f => ({ ...f, setor: v }))} disabled={!!editando}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SETORES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Cor</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {CORES.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, cor: c }))}
                    className={`w-7 h-7 rounded-lg ${c} ${form.cor === c ? 'ring-2 ring-offset-2 ring-slate-800' : ''}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Descrição (opcional)</label>
              <Input value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvarMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {salvarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}