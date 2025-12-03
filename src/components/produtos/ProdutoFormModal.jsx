
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Save, Calculator } from 'lucide-react';
import SimuladorPrecificacao from '../precificacao/SimuladorPrecificacao';

export default function ProdutoFormModal({ produto, onSave, onClose }) {
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    categoria: 'Outros',
    fornecedor: '',
    preco_custo: 0,
    preco_venda: 0,
    margem_lucro: 0,
    estoque_atual: 0,
    moeda_original: 'BRL'
  });

  useEffect(() => {
    if (produto) {
      setFormData({
        codigo: produto.codigo || '',
        nome: produto.nome || '',
        descricao: produto.descricao || '',
        categoria: produto.categoria || 'Outros',
        fornecedor: produto.fornecedor || '',
        preco_custo: produto.preco_custo || 0,
        preco_venda: produto.preco_venda || 0,
        margem_lucro: produto.margem_lucro || 0,
        estoque_atual: produto.estoque_atual || 0,
        moeda_original: produto.moeda_original || 'BRL'
      });
    }
  }, [produto]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;
    
    // Processamento especial para campos numéricos
    if (['preco_custo', 'preco_venda', 'margem_lucro', 'estoque_atual'].includes(name)) {
      processedValue = parseFloat(value) || 0;
    }
    
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    
    // Calcular margem automaticamente quando preços mudarem
    if (name === 'preco_custo' || name === 'preco_venda') {
      const custo = name === 'preco_custo' ? processedValue : formData.preco_custo;
      const venda = name === 'preco_venda' ? processedValue : formData.preco_venda;
      
      if (custo > 0 && venda > 0) {
        const margem = ((venda - custo) / venda) * 100;
        setFormData(prev => ({ ...prev, margem_lucro: margem }));
      }
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePriceUpdate = (precos) => {
    setFormData(prev => ({
      ...prev,
      preco_custo: precos.preco_custo || 0,
      preco_venda: precos.preco_venda || 0,
      margem_lucro: precos.margem_lucro || 0
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  // Função helper para formatar números com segurança
  const formatNumber = (value, decimals = 2) => {
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700 text-white">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 bg-clip-text text-transparent">{produto ? 'Editar Produto' : 'Novo Produto'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-700">
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 p-1">
              <TabsTrigger value="basico" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">Dados Básicos</TabsTrigger>
              <TabsTrigger value="precificacao" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                <Calculator className="w-4 h-4 mr-2" />
                Precificação
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="basico" className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome" className="text-slate-400">Nome do Produto</Label>
                    <Input id="nome" name="nome" value={formData.nome} onChange={handleChange} required className="bg-slate-800 border-slate-600 focus:border-amber-500" />
                  </div>
                  <div>
                    <Label htmlFor="codigo" className="text-slate-400">Código (SKU)</Label>
                    <Input id="codigo" name="codigo" value={formData.codigo} onChange={handleChange} required className="bg-slate-800 border-slate-600 focus:border-amber-500" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="descricao" className="text-slate-400">Descrição</Label>
                  <Textarea id="descricao" name="descricao" value={formData.descricao} onChange={handleChange} className="bg-slate-800 border-slate-600 focus:border-amber-500" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="categoria" className="text-slate-400">Categoria</Label>
                    <Select name="categoria" value={formData.categoria} onValueChange={(value) => handleSelectChange('categoria', value)}>
                      <SelectTrigger className="bg-slate-800 border-slate-600">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600 text-white">
                        <SelectItem value="Hardware">Hardware</SelectItem>
                        <SelectItem value="Software">Software</SelectItem>
                        <SelectItem value="Serviço">Serviço</SelectItem>
                        <SelectItem value="Consultoria">Consultoria</SelectItem>
                        <SelectItem value="Manutenção">Manutenção</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                        <SelectItem value="Celular">Celular</SelectItem>
                        <SelectItem value="Fonte de Alimentação">Fonte de Alimentação</SelectItem>
                        <SelectItem value="HD SSD">HD SSD</SelectItem>
                        <SelectItem value="Lente">Lente</SelectItem>
                        <SelectItem value="Lente Macro">Lente Macro</SelectItem>
                        <SelectItem value="Monitor">Monitor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="fornecedor" className="text-slate-400">Fornecedor (Marca)</Label>
                    <Input id="fornecedor" name="fornecedor" value={formData.fornecedor} onChange={handleChange} className="bg-slate-800 border-slate-600 focus:border-amber-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="moeda_original" className="text-slate-400">Moeda Origem</Label>
                    <Select name="moeda_original" value={formData.moeda_original} onValueChange={(value) => handleSelectChange('moeda_original', value)}>
                      <SelectTrigger className="bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600 text-white">
                        <SelectItem value="BRL">Real (BRL)</SelectItem>
                        <SelectItem value="USD">Dólar (USD)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="preco_custo" className="text-slate-400">Preço de Custo</Label>
                    <Input id="preco_custo" name="preco_custo" type="number" step="0.01" value={formatNumber(formData.preco_custo)} onChange={handleChange} required className="bg-slate-800 border-slate-600 focus:border-amber-500" />
                  </div>
                  <div>
                    <Label htmlFor="preco_venda" className="text-slate-400">Preço de Venda (R$)</Label>
                    <Input id="preco_venda" name="preco_venda" type="number" step="0.01" value={formatNumber(formData.preco_venda)} onChange={handleChange} required className="bg-slate-800 border-slate-600 focus:border-amber-500" />
                  </div>
                  <div>
                    <Label htmlFor="margem_lucro" className="text-slate-400">Margem (%)</Label>
                    <Input id="margem_lucro" name="margem_lucro" type="number" step="0.01" value={formatNumber(formData.margem_lucro)} onChange={handleChange} readOnly className="bg-slate-700/50 border-slate-600" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="estoque_atual" className="text-slate-400">Estoque Atual</Label>
                  <Input id="estoque_atual" name="estoque_atual" type="number" value={formData.estoque_atual || 0} onChange={handleChange} className="bg-slate-800 border-slate-600 focus:border-amber-500" />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700 mt-4">
                  <Button type="button" variant="outline" onClick={onClose} className="border-slate-600 hover:bg-slate-700">Cancelar</Button>
                  <Button type="submit" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90">
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Produto
                  </Button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="precificacao" className="p-6">
              <SimuladorPrecificacao 
                produto={formData}
                onPriceUpdate={handlePriceUpdate}
              />
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700 mt-4">
                <Button type="button" variant="outline" onClick={onClose} className="border-slate-600 hover:bg-slate-700">Cancelar</Button>
                <Button onClick={handleSubmit} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar com Preços Calculados
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
