import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Save, Calculator, ImagePlus, Loader2, Package, Clock } from 'lucide-react';
import SimuladorPrecificacao from '../precificacao/SimuladorPrecificacao';

const CATEGORIAS = ['Hardware', 'Software', 'Serviço', 'Consultoria', 'Manutenção', 'Outros', 'Celular', 'Fonte de Alimentação', 'HD SSD', 'Lente', 'Lente Macro', 'Monitor'];
const UNIDADES = ['unidade', 'metro', 'kg', 'litro', 'hora', 'mês', 'ano'];

export default function ProdutoFormModal({ produto, onSave, onClose }) {
  const fileInputRef = useRef(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    categoria: 'Outros',
    marca: '',
    modelo: '',
    unidade_medida: 'unidade',
    fornecedor: '',
    preco_custo: 0,
    preco_venda: 0,
    margem_lucro: 0,
    estoque_atual: 0,
    estoque_minimo: 1,
    moeda_original: 'BRL',
    observacoes: '',
    ativo: true,
    imagem_url: ''
  });

  useEffect(() => {
    if (produto) {
      setFormData(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.keys(prev).map(k => [k, produto[k] ?? prev[k]])
        )
      }));
    }
  }, [produto]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (['preco_custo', 'preco_venda', 'margem_lucro', 'estoque_atual', 'estoque_minimo'].includes(name)) {
      processedValue = value === '' ? '' : parseFloat(value);
      if (Number.isNaN(processedValue)) processedValue = 0;
    }

    setFormData(prev => {
      const next = { ...prev, [name]: processedValue };
      // Recalcula margem quando preços mudam
      if (name === 'preco_custo' || name === 'preco_venda') {
        const custo = parseFloat(next.preco_custo) || 0;
        const venda = parseFloat(next.preco_venda) || 0;
        if (custo > 0 && venda > 0) {
          next.margem_lucro = ((venda - custo) / venda) * 100;
        }
      }
      return next;
    });
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

  const handleImagemUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, imagem_url: file_url }));
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const payload = {
      ...formData,
      preco_custo: parseFloat(formData.preco_custo) || 0,
      preco_venda: parseFloat(formData.preco_venda) || 0,
      margem_lucro: parseFloat(formData.margem_lucro) || 0,
      estoque_atual: parseFloat(formData.estoque_atual) || 0,
      estoque_minimo: parseFloat(formData.estoque_minimo) || 0
    };
    onSave(payload);
  };

  const estoqueNum = parseFloat(formData.estoque_atual) || 0;
  const margemNum = parseFloat(formData.margem_lucro) || 0;

  const inputClass = "bg-slate-800 border-slate-600 focus:border-amber-500";

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-2 md:p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-700 text-white">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 bg-clip-text text-transparent">
              {produto ? 'Editar Produto' : 'Novo Produto'}
            </h2>
            {estoqueNum > 0 ? (
              <Badge className="bg-green-500/20 text-green-400 border border-green-500/40 gap-1">
                <Package className="w-3 h-3" /> Pronta Entrega
              </Badge>
            ) : (
              <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/40 gap-1">
                <Clock className="w-3 h-3" /> Sob Encomenda
              </Badge>
            )}
          </div>
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

            <TabsContent value="basico" className="p-3 md:p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Imagem + identificação */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 shrink-0 rounded-lg border-2 border-dashed border-slate-600 hover:border-amber-500 bg-slate-800/50 flex items-center justify-center overflow-hidden transition-colors"
                    title="Adicionar imagem"
                  >
                    {uploadingImg ? (
                      <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    ) : formData.imagem_url ? (
                      <img src={formData.imagem_url} alt="Produto" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus className="w-6 h-6 text-slate-500" />
                    )}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagemUpload} />
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome" className="text-slate-400">Nome do Produto *</Label>
                      <Input id="nome" name="nome" value={formData.nome} onChange={handleChange} required className={inputClass} />
                    </div>
                    <div>
                      <Label htmlFor="codigo" className="text-slate-400">Código (SKU) *</Label>
                      <Input id="codigo" name="codigo" value={formData.codigo} onChange={handleChange} required className={inputClass} />
                    </div>
                    <div>
                      <Label htmlFor="marca" className="text-slate-400">Marca</Label>
                      <Input id="marca" name="marca" value={formData.marca} onChange={handleChange} className={inputClass} />
                    </div>
                    <div>
                      <Label htmlFor="modelo" className="text-slate-400">Modelo</Label>
                      <Input id="modelo" name="modelo" value={formData.modelo} onChange={handleChange} className={inputClass} />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="descricao" className="text-slate-400">Descrição</Label>
                  <Textarea id="descricao" name="descricao" value={formData.descricao} onChange={handleChange} className={inputClass} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-400">Categoria</Label>
                    <Select value={formData.categoria} onValueChange={(v) => handleSelectChange('categoria', v)}>
                      <SelectTrigger className="bg-slate-800 border-slate-600">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600 text-white">
                        {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="fornecedor" className="text-slate-400">Fornecedor</Label>
                    <Input id="fornecedor" name="fornecedor" value={formData.fornecedor} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <Label className="text-slate-400">Unidade de Medida</Label>
                    <Select value={formData.unidade_medida} onValueChange={(v) => handleSelectChange('unidade_medida', v)}>
                      <SelectTrigger className="bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600 text-white">
                        {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preços */}
                <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-slate-400">Moeda Origem</Label>
                      <Select value={formData.moeda_original} onValueChange={(v) => handleSelectChange('moeda_original', v)}>
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
                      <Label htmlFor="preco_custo" className="text-slate-400">Preço de Custo *</Label>
                      <Input id="preco_custo" name="preco_custo" type="number" step="0.01" min="0" value={formData.preco_custo} onChange={handleChange} required className={inputClass} />
                    </div>
                    <div>
                      <Label htmlFor="preco_venda" className="text-slate-400">Preço de Venda (R$) *</Label>
                      <Input id="preco_venda" name="preco_venda" type="number" step="0.01" min="0" value={formData.preco_venda} onChange={handleChange} required className={inputClass} />
                    </div>
                    <div>
                      <Label htmlFor="margem_lucro" className="text-slate-400">Margem (%)</Label>
                      <Input
                        id="margem_lucro" name="margem_lucro" type="number" step="0.01"
                        value={margemNum.toFixed(2)} readOnly
                        className={`bg-slate-700/50 border-slate-600 font-semibold ${margemNum < 0 ? 'text-red-400' : margemNum < 15 ? 'text-amber-400' : 'text-green-400'}`}
                      />
                    </div>
                  </div>
                  {margemNum < 0 && (
                    <p className="text-xs text-red-400">⚠️ Preço de venda abaixo do custo — margem negativa.</p>
                  )}
                </div>

                {/* Estoque */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estoque_atual" className="text-slate-400">Estoque Atual</Label>
                    <Input id="estoque_atual" name="estoque_atual" type="number" min="0" value={formData.estoque_atual} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <Label htmlFor="estoque_minimo" className="text-slate-400">Estoque Mínimo (alerta)</Label>
                    <Input id="estoque_minimo" name="estoque_minimo" type="number" min="0" value={formData.estoque_minimo} onChange={handleChange} className={inputClass} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="observacoes" className="text-slate-400">Observações</Label>
                  <Textarea id="observacoes" name="observacoes" value={formData.observacoes} onChange={handleChange} rows={2} className={inputClass} />
                </div>

                <div className="flex items-center gap-3 bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                  <Switch checked={!!formData.ativo} onCheckedChange={(v) => handleSelectChange('ativo', v)} />
                  <div>
                    <p className="text-sm font-medium">{formData.ativo ? 'Produto ativo' : 'Produto inativo'}</p>
                    <p className="text-xs text-slate-400">Produtos inativos não aparecem para venda</p>
                  </div>
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

            <TabsContent value="precificacao" className="p-3 md:p-6">
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