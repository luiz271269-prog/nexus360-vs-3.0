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
import { Tag, Plus, Trash2, Loader2, MessageSquare, Search } from "lucide-react";
import { toast } from "sonner";
import { normalizarSlugEtiqueta } from "../lib/normalizarEtiqueta";

const CORES = [
  'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500',
  'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500',
];

const FORM_INICIAL = { nome: '', label: '', emoji: '🏷️', cor: 'bg-slate-400', descricao: '' };

/**
 * Gerenciador das CATEGORIAS de conversa (CategoriasMensagens → MessageThread.categorias).
 * Esta é a etiquetagem de conversa REAL em produção (usada pelo CategorizadorRapido no chat
 * e ouvida pela automação sincronizarEtiquetaOrcamento).
 * Criação restrita a admin / gerente / coordenador. Anti-duplicado por slug canônico.
 */
export default function GerenciadorCategoriasConversa({ usuarioAtual }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);

  const isAdmin = usuarioAtual?.role === 'admin';
  const podeCriar = isAdmin || ['gerente', 'coordenador'].includes(usuarioAtual?.attendant_role);

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['categorias-mensagens'],
    queryFn: () => base44.entities.CategoriasMensagens.filter({}, 'nome'),
    staleTime: 60 * 1000,
  });

  const categoriasFiltradas = useMemo(() => {
    if (!busca) return categorias;
    const b = busca.toLowerCase();
    return categorias.filter(c => c.label?.toLowerCase().includes(b) || c.nome?.toLowerCase().includes(b));
  }, [categorias, busca]);

  const salvarMutation = useMutation({
    mutationFn: async ({ id, ...data }) => {
      if (id) return base44.entities.CategoriasMensagens.update(id, data);
      return base44.entities.CategoriasMensagens.create({ ...data, ativa: true, uso_count: 0, tipo: 'personalizada' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias-mensagens'] });
      toast.success('✅ Categoria salva!');
      setModalAberto(false);
      setEditando(null);
      setForm(FORM_INICIAL);
    },
    onError: () => toast.error('Erro ao salvar categoria'),
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.CategoriasMensagens.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias-mensagens'] });
      toast.success('Categoria removida');
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const abrirNovo = () => { setEditando(null); setForm(FORM_INICIAL); setModalAberto(true); };
  const abrirEdicao = (cat) => { setEditando(cat); setForm({ ...FORM_INICIAL, ...cat }); setModalAberto(true); };

  const handleSalvar = () => {
    if (!form.label.trim()) { toast.error('Nome da categoria é obrigatório'); return; }
    const slug = normalizarSlugEtiqueta(form.nome || form.label);

    if (!editando) {
      if (!podeCriar) { toast.error('❌ Apenas admin, gerente ou coordenador podem criar categorias'); return; }
      const dup = categorias.find(c =>
        normalizarSlugEtiqueta(c.nome) === slug || normalizarSlugEtiqueta(c.label) === slug
      );
      if (dup) { toast.warning(`Já existe categoria equivalente: ${dup.emoji || '🏷️'} ${dup.label}`); return; }
    }

    salvarMutation.mutate({ id: editando?.id, ...form, nome: slug });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Etiquetas de Conversa</h3>
          <Badge variant="secondary" className="text-xs">{categorias.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8 h-9 w-44" />
          </div>
          {podeCriar && (
            <Button onClick={abrirNovo} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nova Etiqueta
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : categoriasFiltradas.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-10">Nenhuma etiqueta encontrada</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {categoriasFiltradas.map(cat => (
            <Card key={cat.id} className="p-3 flex items-center justify-between hover:shadow-md transition-shadow">
              <button onClick={() => abrirEdicao(cat)} className="flex items-center gap-2 text-left flex-1 min-w-0">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white ${cat.cor || 'bg-slate-400'}`}>{cat.emoji || '🏷️'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{cat.label}</p>
                  <p className="text-[11px] text-slate-400">{cat.uso_count || 0} usos · {cat.tipo === 'fixa' ? 'fixa' : 'personalizada'}</p>
                </div>
              </button>
              {isAdmin && (
                <button
                  onClick={() => { if (confirm(`Excluir categoria "${cat.label}"?`)) deletarMutation.mutate(cat.id); }}
                  className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" />
              {editando ? 'Editar Categoria' : 'Nova Etiqueta de Conversa'}
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