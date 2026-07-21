import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Plus, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ListaDetalheView from "./ListaDetalheView";

const CORES = {
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
  pink: 'bg-pink-100 text-pink-800 border-pink-300',
  teal: 'bg-teal-100 text-teal-800 border-teal-300',
  red: 'bg-red-100 text-red-800 border-red-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300'
};
const CORES_OPCOES = Object.keys(CORES);

/**
 * Painel de Listas do Vendedor — cria e gerencia listas de trabalho
 * (clientes, contatos e itens importados) por vendedor.
 */
export default function ListasVendedorPanel({ usuarioAtual, vendedores = [], clientes = [], onViewDetails }) {
  const queryClient = useQueryClient();
  const isGestor = ['admin', 'gerente', 'coordenador'].includes(usuarioAtual?.attendant_role) || usuarioAtual?.role === 'admin';

  const [showCriar, setShowCriar] = useState(false);
  const [novaLista, setNovaLista] = useState({ nome: '', vendedor_id: '', cor: 'blue' });
  const [listaAberta, setListaAberta] = useState(null);

  const { data: listas = [], isLoading } = useQuery({
    queryKey: ['listasVendedor'],
    queryFn: () => base44.entities.ListaVendedor.list('-updated_date', 200),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['listasVendedor'] });

  const resolverVendedorNome = (userId) =>
    vendedores.find(v => String(v.value) === String(userId))?.label || '';

  const handleCriar = async () => {
    if (!novaLista.nome.trim()) { toast.error('Informe o nome da lista'); return; }
    const vendedorId = isGestor ? (novaLista.vendedor_id || usuarioAtual?.id) : usuarioAtual?.id;
    try {
      const criada = await base44.entities.ListaVendedor.create({
        nome: novaLista.nome.trim(),
        vendedor_id: vendedorId,
        vendedor_nome: resolverVendedorNome(vendedorId) || usuarioAtual?.full_name,
        cor: novaLista.cor,
        cliente_ids: [],
        contato_ids: [],
        itens_importados: []
      });
      toast.success('Lista criada!');
      setNovaLista({ nome: '', vendedor_id: '', cor: 'blue' });
      setShowCriar(false);
      await invalidar();
      setListaAberta(criada);
    } catch (e) {
      console.error('Erro ao criar lista:', e);
      toast.error('Erro ao criar lista');
    }
  };

  const handleExcluir = async (lista) => {
    if (!confirm(`Excluir a lista "${lista.nome}"? Os clientes/contatos não serão apagados.`)) return;
    try {
      await base44.entities.ListaVendedor.delete(lista.id);
      toast.success('Lista excluída');
      setListaAberta(null);
      await invalidar();
    } catch (e) {
      console.error('Erro ao excluir lista:', e);
      toast.error('Erro ao excluir lista');
    }
  };

  if (listaAberta) {
    return (
      <ListaDetalheView
        lista={listaAberta}
        setLista={setListaAberta}
        onVoltar={() => setListaAberta(null)}
        onExcluir={handleExcluir}
        clientes={clientes}
        vendedores={vendedores}
        onViewDetails={onViewDetails}
      />
    );
  }

  const listasVisiveis = listas.filter(l => l.ativa !== false);
  const grupos = listasVisiveis.reduce((acc, l) => {
    const chave = l.vendedor_nome || 'Sem vendedor';
    (acc[chave] = acc[chave] || []).push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-700 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-blue-600" /> Listas de Trabalho
        </h3>
        <Button size="sm" onClick={() => setShowCriar(!showCriar)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Nova Lista
        </Button>
      </div>

      {showCriar && (
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-slate-600">Nome da lista</label>
              <Input
                value={novaLista.nome}
                onChange={(e) => setNovaLista(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Top 30, Estratégicos..."
              />
            </div>
            {isGestor && (
              <div className="min-w-[180px]">
                <label className="text-xs font-semibold text-slate-600">Vendedor</label>
                <Select value={novaLista.vendedor_id} onValueChange={(v) => setNovaLista(p => ({ ...p, vendedor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Eu mesmo" /></SelectTrigger>
                  <SelectContent>
                    {vendedores.map(v => (
                      <SelectItem key={v.value} value={String(v.value)}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="min-w-[120px]">
              <label className="text-xs font-semibold text-slate-600">Cor</label>
              <Select value={novaLista.cor} onValueChange={(v) => setNovaLista(p => ({ ...p, cor: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CORES_OPCOES.map(c => (
                    <SelectItem key={c} value={c}>
                      <span className={`inline-block w-3 h-3 rounded-full mr-2 ${CORES[c].split(' ')[0]}`} />{c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCriar} className="bg-green-600 hover:bg-green-700 text-white">Criar</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : listasVisiveis.length === 0 ? (
        <div className="text-center py-16 bg-white/80 rounded-xl border-2 border-slate-200/50">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Nenhuma lista criada ainda.</p>
          <p className="text-sm text-slate-500">Crie listas de trabalho para organizar clientes e contatos por vendedor.</p>
        </div>
      ) : (
        Object.entries(grupos).map(([vendedorNome, listasDoVendedor]) => (
          <Card key={vendedorNome} className="shadow-lg border-2 border-slate-200/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-green-600" /> {vendedorNome}
                <Badge variant="outline" className="ml-1">{listasDoVendedor.length} lista(s)</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {listasDoVendedor.map(l => {
                const total = (l.cliente_ids || []).length + (l.contato_ids || []).length + (l.itens_importados || []).length;
                return (
                  <button
                    key={l.id}
                    onClick={() => setListaAberta(l)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all hover:scale-105 hover:shadow ${CORES[l.cor] || CORES.blue}`}
                  >
                    {l.nome}
                    <span className="ml-2 text-xs opacity-70">({total})</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}