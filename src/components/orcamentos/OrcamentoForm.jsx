import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Loader2 } from "lucide-react";

export default function OrcamentoForm({ orcamento, onSave, onClose }) {
  const [formData, setFormData] = useState({
    numero_orcamento: "",
    cliente_nome: "",
    vendedor: "",
    data_orcamento: new Date().toISOString().slice(0, 10),
    valor_total: 0,
    status: "Em Aberto",
    probabilidade: "Média",
    prazo_validade: "",
    condicao_pagamento: "",
    produtos: [],
    observacoes: ""
  });
  
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]); // users como vendedores
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const carregarDadosApoio = async () => {
      try {
        const [clientesData, usersData] = await Promise.all([
          base44.entities.Cliente.list(),
          base44.entities.User.list()
        ]);
        setClientes(clientesData);
        // Filtrar users que são vendedores
        setUsuarios(usersData.filter(u => u.codigo || u.attendant_sector === 'vendas'));
      } catch (error) {
        console.error("Erro ao carregar dados de apoio:", error);
      }
    };
    carregarDadosApoio();

    if (orcamento) {
      setFormData({
        ...orcamento,
        data_orcamento: orcamento.data_orcamento ? new Date(orcamento.data_orcamento).toISOString().slice(0, 10) : "",
        prazo_validade: orcamento.prazo_validade ? new Date(orcamento.prazo_validade).toISOString().slice(0, 10) : "",
        produtos: orcamento.produtos || []
      });
    }
  }, [orcamento]);

  useEffect(() => {
    const total = formData.produtos.reduce((acc, produto) => acc + (Number(produto.valor_total) || 0), 0);
    setFormData(prev => ({ ...prev, valor_total: total }));
  }, [formData.produtos]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProdutoChange = (index, e) => {
    const { name, value } = e.target;
    const novosProdutos = [...formData.produtos];
    novosProdutos[index][name] = value;
    if (name === 'quantidade' || name === 'valor_unitario') {
      const qtd = Number(novosProdutos[index].quantidade) || 0;
      const valor = Number(novosProdutos[index].valor_unitario) || 0;
      novosProdutos[index].valor_total = qtd * valor;
    }
    setFormData(prev => ({ ...prev, produtos: novosProdutos }));
  };

  const adicionarProduto = () => {
    setFormData(prev => ({
      ...prev,
      produtos: [...prev.produtos, { nome: "", quantidade: 1, valor_unitario: 0, valor_total: 0 }]
    }));
  };

  const removerProduto = (index) => {
    setFormData(prev => ({ ...prev, produtos: formData.produtos.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        valor_total: Number(formData.valor_total),
        produtos: formData.produtos.map(p => ({
          ...p,
          quantidade: Number(p.quantidade),
          valor_unitario: Number(p.valor_unitario),
          valor_total: Number(p.valor_total)
        }))
      };
      if (orcamento) {
        await base44.entities.Orcamento.update(orcamento.id, dataToSave);
      } else {
        await base44.entities.Orcamento.create(dataToSave);
      }
      onSave();
    } catch (error) {
      console.error("Erro ao salvar orçamento:", error);
      alert("Erro ao salvar orçamento.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-700 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{orcamento ? "Editar Orçamento" : "Novo Orçamento"}</h2>
          <Button onClick={onClose} variant="ghost" size="icon" className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="cliente_nome" className="text-slate-300">Cliente</Label>
              <Select name="cliente_nome" onValueChange={(value) => handleSelectChange('cliente_nome', value)} value={formData.cliente_nome}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600 text-white">
                  {clientes.map(c => <SelectItem key={c.id} value={c.razao_social}>{c.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="vendedor" className="text-slate-300">Responsável</Label>
              <Select name="vendedor" onValueChange={(value) => handleSelectChange('vendedor', value)} value={formData.vendedor}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600 text-white">
                  {usuarios.map(u => <SelectItem key={u.id} value={u.full_name || u.email}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="numero_orcamento" className="text-slate-300">Nº Orçamento</Label>
              <Input type="text" name="numero_orcamento" value={formData.numero_orcamento} onChange={handleChange} className="bg-slate-700 border-slate-600 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label className="text-slate-300">Data</Label>
              <Input type="date" name="data_orcamento" value={formData.data_orcamento} onChange={handleChange} className="bg-slate-700 border-slate-600 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Validade</Label>
              <Input type="date" name="prazo_validade" value={formData.prazo_validade} onChange={handleChange} className="bg-slate-700 border-slate-600 text-white" />
            </div>
            <div>
              <Label className="text-slate-300">Cond. Pagamento</Label>
              <Input type="text" name="condicao_pagamento" value={formData.condicao_pagamento} onChange={handleChange} className="bg-slate-700 border-slate-600 text-white" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-slate-300">Status</Label>
              <Select name="status" onValueChange={(value) => handleSelectChange('status', value)} value={formData.status}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white"><SelectValue/></SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600 text-white">
                  <SelectItem value="Em Aberto">Em Aberto</SelectItem>
                  <SelectItem value="Aprovado">Aprovado</SelectItem>
                  <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                  <SelectItem value="Vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Probabilidade</Label>
              <Select name="probabilidade" onValueChange={(value) => handleSelectChange('probabilidade', value)} value={formData.probabilidade}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white"><SelectValue/></SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600 text-white">
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Produtos/Serviços</h3>
            <div className="space-y-3">
              {formData.produtos.map((produto, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-700/50 rounded-lg">
                  <div className="col-span-4">
                    <Input type="text" name="nome" placeholder="Nome do Produto" value={produto.nome} onChange={(e) => handleProdutoChange(index, e)} className="bg-slate-700 border-slate-600 text-white h-9" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" name="quantidade" placeholder="Qtd" value={produto.quantidade} onChange={(e) => handleProdutoChange(index, e)} className="bg-slate-700 border-slate-600 text-white h-9" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" step="0.01" name="valor_unitario" placeholder="Vl. Unit." value={produto.valor_unitario} onChange={(e) => handleProdutoChange(index, e)} className="bg-slate-700 border-slate-600 text-white h-9" />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" step="0.01" name="valor_total" placeholder="Vl. Total" value={produto.valor_total} readOnly className="bg-slate-900 border-slate-700 text-white h-9" />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removerProduto(index)} className="text-red-500 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={adicionarProduto} className="mt-3 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700">
              <Plus className="w-4 h-4 mr-2" /> Adicionar Produto
            </Button>
          </div>
          
          <div>
            <Label className="text-slate-300">Observações</Label>
            <Textarea name="observacoes" value={formData.observacoes} onChange={handleChange} className="bg-slate-700 border-slate-600 text-white" />
          </div>
        </form>
        
        <div className="p-6 border-t border-slate-700 flex justify-between items-center bg-slate-800/50">
          <div className="text-white">
            <span className="text-slate-400">Valor Total:</span>
            <span className="text-2xl font-bold ml-2 text-amber-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.valor_total)}
            </span>
          </div>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white font-semibold min-w-[120px]">
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Salvar Orçamento'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}