import { useState, useEffect } from "react";
import { Cliente } from "@/entities/Cliente";
import { Vendedor } from "@/entities/Vendedor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, DollarSign, Loader2, Plus, Trash2, Package } from "lucide-react";
import VoiceInput from "../ui/VoiceInput";

export default function VendaForm({ venda, onSalvar, onCancelar }) {
  const [formData, setFormData] = useState(
    venda || {
      numero_pedido: "",
      cliente_nome: "",
      vendedor: "",
      data_venda: new Date().toISOString().slice(0, 10),
      valor_total: 0,
      status: "Pendente",
      tipo_venda: "Nova Venda",
      condicao_pagamento: "",
      produtos: [],
      descricao_produtos: "",
      observacoes: ""
    }
  );
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showProdutos, setShowProdutos] = useState(
    (venda?.produtos && Array.isArray(venda.produtos) && venda.produtos.length > 0) || false
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [clientesData, vendedoresData] = await Promise.all([
        Cliente.list(),
        Vendedor.list()
      ]);
      setClientes(clientesData);
      setVendedores(vendedoresData);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Recalcular valor total baseado nos produtos
  useEffect(() => {
    if (showProdutos && formData.produtos && Array.isArray(formData.produtos)) {
      const total = formData.produtos.reduce((acc, produto) => {
        return acc + (Number(produto.valor_total) || 0);
      }, 0);
      if (total !== formData.valor_total) {
        setFormData(prev => ({ ...prev, valor_total: total }));
      }
    }
  }, [formData.produtos, showProdutos]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const adicionarProduto = () => {
    const novoProduto = {
      nome: "",
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
      observacoes: ""
    };
    setFormData(prev => ({
      ...prev,
      produtos: [...(prev.produtos || []), novoProduto]
    }));
  };

  const atualizarProduto = (index, campo, valor) => {
    const novosProdutos = [...(formData.produtos || [])];
    novosProdutos[index] = { ...novosProdutos[index], [campo]: valor };
    
    // Recalcular valor total do produto se quantidade ou valor unitário mudaram
    if (campo === 'quantidade' || campo === 'valor_unitario') {
      const quantidade = Number(novosProdutos[index].quantidade) || 0;
      const valorUnitario = Number(novosProdutos[index].valor_unitario) || 0;
      novosProdutos[index].valor_total = quantidade * valorUnitario;
    }
    
    setFormData(prev => ({ ...prev, produtos: novosProdutos }));
  };

  const removerProduto = (index) => {
    const novosProdutos = formData.produtos.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, produtos: novosProdutos }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Limpar produtos vazios antes de salvar
    const produtosLimpos = showProdutos 
      ? (formData.produtos || []).filter(p => p.nome && p.nome.trim())
      : [];
    
    const dadosParaSalvar = {
      ...formData,
      produtos: produtosLimpos
    };
    
    onSalvar(dadosParaSalvar);
  };

  const handleVoiceTranscription = (result, metadata) => {
    if (typeof result === 'object') {
      Object.keys(result).forEach(campo => {
        if (formData.hasOwnProperty(campo) && result[campo]) {
          setFormData(prev => ({ ...prev, [campo]: result[campo] }));
        }
      });
    } else if (typeof result === 'string') {
      setFormData(prev => ({ 
        ...prev, 
        observacoes: prev.observacoes ? `${prev.observacoes}\n${result}` : result 
      }));
    }
  };

  const handleVoiceError = (error) => {
    console.error('Erro na transcrição:', error);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-200/50">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">
              {venda ? "Editar Venda" : "Registrar Nova Venda"}
            </h2>
            <VoiceInput
              onTranscription={handleVoiceTranscription}
              onError={handleVoiceError}
              contextType="form"
              contextData={{
                formFields: ["numero_pedido", "cliente_nome", "vendedor", "valor_total", "status", "descricao_produtos", "observacoes"],
                formType: "venda"
              }}
              placeholder="Fale os dados da venda"
              size="lg"
              className="ml-4"
            />
          </div>
          <p className="text-slate-600 text-sm mt-2">💡 Use o microfone para preencher os campos automaticamente falando</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow overflow-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="numero_pedido">Nº do Pedido</Label>
              <Input 
                id="numero_pedido" 
                name="numero_pedido" 
                value={formData.numero_pedido} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="data_venda">Data da Venda</Label>
              <Input 
                id="data_venda" 
                name="data_venda" 
                type="date" 
                value={formData.data_venda} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="cliente_nome">Cliente</Label>
              <Select onValueChange={(value) => handleSelectChange("cliente_nome", value)} value={formData.cliente_nome}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.razao_social}>
                      {c.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="vendedor">Vendedor</Label>
              <Select onValueChange={(value) => handleSelectChange("vendedor", value)} value={formData.vendedor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map(v => (
                    <SelectItem key={v.id} value={v.nome}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="condicao_pagamento">Condição de Pagamento</Label>
              <Input
                id="condicao_pagamento"
                name="condicao_pagamento"
                value={formData.condicao_pagamento}
                onChange={handleChange}
                placeholder="Ex: À vista, 30 dias, etc."
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select onValueChange={(value) => handleSelectChange("status", value)} value={formData.status}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Faturado">Faturado</SelectItem>
                  <SelectItem value="Entregue">Entregue</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggle para produtos detalhados */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-600" />
                <Label className="text-base font-semibold">Produtos da Venda</Label>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowProdutos(!showProdutos)}
                className="text-sm"
              >
                {showProdutos ? 'Usar descrição simples' : 'Detalhar produtos'}
              </Button>
            </div>

            {showProdutos ? (
              <div className="space-y-4">
                {formData.produtos && formData.produtos.map((produto, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-end p-3 bg-slate-50 rounded-lg">
                    <div className="col-span-4">
                      <Label className="text-xs">Nome do Produto</Label>
                      <Input
                        placeholder="Nome do produto"
                        value={produto.nome || ''}
                        onChange={(e) => atualizarProduto(index, 'nome', e.target.value)}
                        size="sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        type="number"
                        min="1"
                        value={produto.quantidade || 1}
                        onChange={(e) => atualizarProduto(index, 'quantidade', e.target.value)}
                        size="sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Valor Unit.</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={produto.valor_unitario || 0}
                        onChange={(e) => atualizarProduto(index, 'valor_unitario', e.target.value)}
                        size="sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Total</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={produto.valor_total || 0}
                        readOnly
                        className="bg-slate-100"
                        size="sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removerProduto(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={adicionarProduto}
                  className="w-full border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Produto
                </Button>
              </div>
            ) : (
              <div>
                <Label htmlFor="descricao_produtos">Descrição dos Produtos</Label>
                <Textarea
                  id="descricao_produtos"
                  name="descricao_produtos"
                  value={formData.descricao_produtos}
                  onChange={handleChange}
                  placeholder="Descreva os produtos/serviços desta venda..."
                  className="h-24"
                />
              </div>
            )}
          </div>

          {/* Valor total */}
          <div>
            <Label htmlFor="valor_total">Valor Total</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="valor_total"
                name="valor_total"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_total}
                onChange={handleChange}
                required
                className="pl-8"
                readOnly={showProdutos && formData.produtos && formData.produtos.length > 0}
              />
            </div>
            {showProdutos && formData.produtos && formData.produtos.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Valor calculado automaticamente baseado nos produtos
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              placeholder="Observações adicionais..."
              className="h-20"
            />
          </div>
        </form>

        <div className="p-6 border-t border-slate-200/50 flex justify-end gap-4 bg-slate-50/50">
          <Button onClick={onCancelar} variant="ghost" className="text-slate-700">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[180px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Venda
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}