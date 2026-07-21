import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Plus, Trash2, ArrowLeft, UserCheck, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AdicionarClientesListaDialog from "./AdicionarClientesListaDialog";

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
 * Painel de Listas do Vendedor — cria listas nomeadas de clientes por vendedor,
 * adiciona/remove clientes e permite atribuir a responsabilidade dos clientes
 * da lista ao vendedor dono (grava usuario_id + vendedor_responsavel).
 */
export default function ListasVendedorPanel({ usuarioAtual, vendedores = [], clientes = [], onViewDetails }) {
  const queryClient = useQueryClient();
  const isGestor = ['admin', 'gerente', 'coordenador'].includes(usuarioAtual?.attendant_role) || usuarioAtual?.role === 'admin';

  const [showCriar, setShowCriar] = useState(false);
  const [novaLista, setNovaLista] = useState({ nome: '', vendedor_id: '', cor: 'blue' });
  const [listaAberta, setListaAberta] = useState(null);
  const [showAdicionar, setShowAdicionar] = useState(false);

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
      await base44.entities.ListaVendedor.create({
        nome: novaLista.nome.trim(),
        vendedor_id: vendedorId,
        vendedor_nome: resolverVendedorNome(vendedorId) || usuarioAtual?.full_name,
        cor: novaLista.cor,
        cliente_ids: []
      });
      toast.success('Lista criada!');
      setNovaLista({ nome: '', vendedor_id: '', cor: 'blue' });
      setShowCriar(false);
      await invalidar();
    } catch (e) {
      console.error('Erro ao criar lista:', e);
      toast.error('Erro ao criar lista');
    }
  };

  const handleExcluir = async (lista) => {
    if (!confirm(`Excluir a lista "${lista.nome}"? Os clientes não serão apagados.`)) return;
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

  const handleAdicionarClientes = async (ids) => {
    try {
      const atualizados = [...new Set([...(listaAberta.cliente_ids || []), ...ids])];
      await base44.entities.ListaVendedor.update(listaAberta.id, { cliente_ids: atualizados });
      setListaAberta({ ...listaAberta, cliente_ids: atualizados });
      setShowAdicionar(false);
      toast.success(`${ids.length} cliente(s) adicionado(s)!`);
      await invalidar();
    } catch (e) {
      console.error('Erro ao adicionar clientes:', e);
      toast.error('Erro ao adicionar clientes');
    }
  };

  const handleRemoverCliente = async (clienteId) => {
    try {
      const atualizados = (listaAberta.cliente_ids || []).filter(id => id !== clienteId);
      await base44.entities.ListaVendedor.update(listaAberta.id, { cliente_ids: atualizados });
      setListaAberta({ ...listaAberta, cliente_ids: atualizados });
      await invalidar();
    } catch (e) {
      console.error('Erro ao remover cliente:', e);
      toast.error('Erro ao remover cliente');
    }
  };

  const handleAtribuirResponsavel = async () => {
    const ids = listaAberta?.cliente_ids || [];
    if (ids.length === 0) { toast.error('Lista vazia'); return; }
    const nomeVendedor = listaAberta.vendedor_nome || resolverVendedorNome(listaAberta.vendedor_id);
    if (!confirm(`Atribuir ${ids.length} cliente(s) da lista para ${nomeVendedor}?`)) return;
    try {
      await base44.entities.Cliente.bulkUpdate(
        ids.map(id => ({ id, usuario_id: listaAberta.vendedor_id, vendedor_responsavel: nomeVendedor }))
      );
      toast.success(`${ids.length} cliente(s) atribuído(s) a ${nomeVendedor}!`);
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
    } catch (e) {
      console.error('Erro ao atribuir responsável:', e);
      toast.error('Erro ao atribuir clientes');
    }
  };

  // ── DETALHE DE UMA LISTA ──
  if (listaAberta) {
    const clientesDaLista = clientes.filter(c => (listaAberta.cliente_ids || []).includes(c.id));
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setListaAberta(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Badge className={`${CORES[listaAberta.cor] || CORES.blue} border`}>{listaAberta.nome}</Badge>
            <span className="text-sm text-slate-500">
              {listaAberta.vendedor_nome} · {clientesDaLista.length} cliente(s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowAdicionar(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Adicionar clientes
            </Button>
            <Button size="sm" variant="outline" onClick={handleAtribuirResponsavel}>
              <UserCheck className="w-4 h-4 mr-1" /> Atribuir ao vendedor
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleExcluir(listaAberta)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Card className="shadow-lg border-2 border-slate-200/50">
          <CardContent className="p-0">
            {clientesDaLista.length === 0 ? (
              <p className="text-center py-12 text-slate-500">Lista vazia. Clique em "Adicionar clientes".</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Empresa</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Responsável</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Telefone</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesDaLista.map(c => (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <button
                            className="font-medium text-blue-700 hover:underline text-left"
                            onClick={() => onViewDetails?.(c)}
                          >
                            {c.razao_social || c.nome_fantasia}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{c.vendedor_responsavel || '—'}</td>
                        <td className="px-4 py-3"><Badge variant="outline">{c.status || '—'}</Badge></td>
                        <td className="px-4 py-3 text-slate-700">{c.telefone || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="icon" variant="ghost" onClick={() => handleRemoverCliente(c.id)} title="Remover da lista">
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <AdicionarClientesListaDialog
          open={showAdicionar}
          onClose={() => setShowAdicionar(false)}
          lista={listaAberta}
          clientes={clientes}
          onConfirm={handleAdicionarClientes}
        />
      </div>
    );
  }

  // ── VISÃO GERAL DAS LISTAS ──
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
          <p className="text-sm text-slate-500">Crie listas de trabalho para organizar clientes por vendedor.</p>
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
              {listasDoVendedor.map(l => (
                <button
                  key={l.id}
                  onClick={() => setListaAberta(l)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all hover:scale-105 hover:shadow ${CORES[l.cor] || CORES.blue}`}
                >
                  {l.nome}
                  <span className="ml-2 text-xs opacity-70">({(l.cliente_ids || []).length})</span>
                </button>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}