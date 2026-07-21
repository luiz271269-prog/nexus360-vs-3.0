import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, UserCheck, X, Printer, Upload, Users, Building2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import AdicionarClientesListaDialog from "./AdicionarClientesListaDialog";
import AdicionarContatosListaDialog from "./AdicionarContatosListaDialog";
import ImportarListaDialog from "./ImportarListaDialog";

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

/**
 * Visão detalhada de uma ListaVendedor: clientes, contatos e itens importados,
 * com adição, importação de arquivo, remoção, atribuição em massa e impressão.
 */
export default function ListaDetalheView({ lista, setLista, onVoltar, onExcluir, clientes = [], vendedores = [], onViewDetails }) {
  const queryClient = useQueryClient();
  const [showAddClientes, setShowAddClientes] = useState(false);
  const [showAddContatos, setShowAddContatos] = useState(false);
  const [showImportar, setShowImportar] = useState(false);

  const clientesDaLista = clientes.filter(c => (lista.cliente_ids || []).includes(c.id));
  const contatoIds = lista.contato_ids || [];
  const itensImportados = lista.itens_importados || [];

  const { data: contatosDaLista = [] } = useQuery({
    queryKey: ['contatosLista', lista.id, contatoIds.join(',')],
    queryFn: () => base44.entities.Contact.filter({ id: { $in: contatoIds } }),
    enabled: contatoIds.length > 0,
    refetchOnWindowFocus: false
  });

  const salvar = async (dados) => {
    await base44.entities.ListaVendedor.update(lista.id, dados);
    setLista({ ...lista, ...dados });
    await queryClient.invalidateQueries({ queryKey: ['listasVendedor'] });
  };

  const handleAdicionarClientes = async (ids) => {
    await salvar({ cliente_ids: [...new Set([...(lista.cliente_ids || []), ...ids])] });
    setShowAddClientes(false);
    toast.success(`${ids.length} cliente(s) adicionado(s)!`);
  };

  const handleAdicionarContatos = async (ids) => {
    await salvar({ contato_ids: [...new Set([...contatoIds, ...ids])] });
    setShowAddContatos(false);
    toast.success(`${ids.length} contato(s) adicionado(s)!`);
  };

  const handleImportar = async (clienteIdsEncontrados, naoEncontrados) => {
    await salvar({
      cliente_ids: [...new Set([...(lista.cliente_ids || []), ...clienteIdsEncontrados])],
      itens_importados: [...itensImportados, ...naoEncontrados]
    });
    setShowImportar(false);
    toast.success(`Importação concluída: ${clienteIdsEncontrados.length} vinculado(s), ${naoEncontrados.length} item(ns) avulso(s).`);
  };

  const handleRemoverCliente = (id) => salvar({ cliente_ids: (lista.cliente_ids || []).filter(x => x !== id) });
  const handleRemoverContato = (id) => salvar({ contato_ids: contatoIds.filter(x => x !== id) });
  const handleRemoverImportado = (idx) => salvar({ itens_importados: itensImportados.filter((_, i) => i !== idx) });

  const handleAtribuirResponsavel = async () => {
    const ids = lista.cliente_ids || [];
    if (ids.length === 0) { toast.error('Nenhum cliente na lista'); return; }
    const nomeVendedor = lista.vendedor_nome || vendedores.find(v => String(v.value) === String(lista.vendedor_id))?.label || '';
    if (!confirm(`Atribuir ${ids.length} cliente(s) da lista para ${nomeVendedor}?`)) return;
    try {
      await base44.entities.Cliente.bulkUpdate(
        ids.map(id => ({ id, usuario_id: lista.vendedor_id, vendedor_responsavel: nomeVendedor }))
      );
      toast.success(`${ids.length} cliente(s) atribuído(s) a ${nomeVendedor}!`);
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
    } catch (e) {
      console.error('Erro ao atribuir:', e);
      toast.error('Erro ao atribuir clientes');
    }
  };

  const handleImprimir = () => {
    const linhas = [
      ...clientesDaLista.map(c => `<tr><td>Cliente</td><td>${c.razao_social || c.nome_fantasia || ''}</td><td>${c.telefone || ''}</td><td>${c.cidade || ''}</td><td>${c.vendedor_responsavel || ''}</td></tr>`),
      ...contatosDaLista.map(c => `<tr><td>Contato</td><td>${c.nome || ''}${c.empresa ? ' — ' + c.empresa : ''}</td><td>${c.telefone || ''}</td><td></td><td></td></tr>`),
      ...itensImportados.map(i => `<tr><td>Importado</td><td>${i.nome || ''}</td><td>${i.telefone || ''}</td><td>${i.cidade || ''}</td><td>${i.cnpj || ''}</td></tr>`)
    ].join('');

    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>${lista.nome}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p.sub { color: #64748b; font-size: 13px; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
        th { background: #f1f5f9; }
      </style></head><body>
      <h1>📋 ${lista.nome}</h1>
      <p class="sub">Vendedor: ${lista.vendedor_nome || ''} · ${clientesDaLista.length} cliente(s), ${contatosDaLista.length} contato(s), ${itensImportados.length} importado(s) · Gerado em ${new Date().toLocaleString('pt-BR')}</p>
      <table>
        <thead><tr><th>Tipo</th><th>Nome / Empresa</th><th>Telefone</th><th>Cidade</th><th>Info</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const totalItens = clientesDaLista.length + contatosDaLista.length + itensImportados.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onVoltar}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Badge className={`${CORES[lista.cor] || CORES.blue} border`}>{lista.nome}</Badge>
          <span className="text-sm text-slate-500">{lista.vendedor_nome} · {totalItens} item(ns)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setShowAddClientes(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Building2 className="w-4 h-4 mr-1" /> + Clientes
          </Button>
          <Button size="sm" onClick={() => setShowAddContatos(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Users className="w-4 h-4 mr-1" /> + Contatos
          </Button>
          <Button size="sm" onClick={() => setShowImportar(true)} className="bg-green-600 hover:bg-green-700 text-white">
            <Upload className="w-4 h-4 mr-1" /> Importar
          </Button>
          <Button size="sm" variant="outline" onClick={handleImprimir}>
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
          <Button size="sm" variant="outline" onClick={handleAtribuirResponsavel}>
            <UserCheck className="w-4 h-4 mr-1" /> Atribuir
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onExcluir(lista)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="shadow-lg border-2 border-slate-200/50">
        <CardContent className="p-0">
          {totalItens === 0 ? (
            <p className="text-center py-12 text-slate-500">Lista vazia. Adicione clientes, contatos ou importe um arquivo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Nome / Empresa</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Telefone</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Info</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesDaLista.map(c => (
                    <tr key={`cli-${c.id}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3"><Badge className="bg-blue-100 text-blue-800">Cliente</Badge></td>
                      <td className="px-4 py-3">
                        <button className="font-medium text-blue-700 hover:underline text-left" onClick={() => onViewDetails?.(c)}>
                          {c.razao_social || c.nome_fantasia}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{c.telefone || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{c.vendedor_responsavel || '—'}{c.cidade ? ` · ${c.cidade}` : ''}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => handleRemoverCliente(c.id)} title="Remover da lista">
                          <X className="w-4 h-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {contatosDaLista.map(c => (
                    <tr key={`con-${c.id}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3"><Badge className="bg-teal-100 text-teal-800">Contato</Badge></td>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.nome}{c.empresa ? <span className="text-xs text-slate-500 font-normal"> — {c.empresa}</span> : null}</td>
                      <td className="px-4 py-3 text-slate-700">{c.telefone || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{c.tipo_contato || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => handleRemoverContato(c.id)} title="Remover da lista">
                          <X className="w-4 h-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {itensImportados.map((i, idx) => (
                    <tr key={`imp-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/50 bg-amber-50/30">
                      <td className="px-4 py-3"><Badge className="bg-amber-100 text-amber-800"><FileSpreadsheet className="w-3 h-3 mr-1" />Importado</Badge></td>
                      <td className="px-4 py-3 font-medium text-slate-800">{i.nome || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{i.telefone || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{i.cnpj || ''}{i.cidade ? ` · ${i.cidade}` : ''}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => handleRemoverImportado(idx)} title="Remover da lista">
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
        open={showAddClientes}
        onClose={() => setShowAddClientes(false)}
        lista={lista}
        clientes={clientes}
        onConfirm={handleAdicionarClientes}
      />
      <AdicionarContatosListaDialog
        open={showAddContatos}
        onClose={() => setShowAddContatos(false)}
        lista={lista}
        onConfirm={handleAdicionarContatos}
      />
      <ImportarListaDialog
        open={showImportar}
        onClose={() => setShowImportar(false)}
        lista={lista}
        clientes={clientes}
        onConfirm={handleImportar}
      />
    </div>
  );
}