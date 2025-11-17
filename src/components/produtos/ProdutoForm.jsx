import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Save } from "lucide-react";

export default function ProdutoForm({ produto, onSave, onClose }) {
  const [formData, setFormData] = useState(produto || {
    codigo: "",
    nome: "",
    descricao: "",
    categoria: "Outros",
    unidade_medida: "unidade",
    preco_custo: 0,
    preco_venda: 0,
    margem_lucro: 0,
    estoque_atual: 0,
    estoque_minimo: 1,
    fornecedor: "",
    observacoes: "",
    ativo: true,
    imagem_url: ""
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Calcular margem de lucro automaticamente
    if (formData.preco_custo > 0 && formData.preco_venda > 0) {
      const margem = ((formData.preco_venda - formData.preco_custo) / formData.preco_custo) * 100;
      setFormData(prev => ({ ...prev, margem_lucro: Math.round(margem * 100) / 100 }));
    }
  }, [formData.preco_custo, formData.preco_venda]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Converter strings para números
    const dataToSave = {
      ...formData,
      preco_custo: Number(formData.preco_custo) || 0,
      preco_venda: Number(formData.preco_venda) || 0,
      margem_lucro: Number(formData.margem_lucro) || 0,
      estoque_atual: Number(formData.estoque_atual) || 0,
      estoque_minimo: Number(formData.estoque_minimo) || 1
    };

    await onSave(dataToSave);
    setLoading(false);
  };

  const handleChange = (campo, valor) => {
    setFormData(prev => ({ ...prev, [campo]: valor }));
  };

  const categorias = ["Hardware", "Software", "Serviço", "Consultoria", "Manutenção", "Outros"];
  const unidades = ["unidade", "metro", "kg", "litro", "hora", "mês", "ano"];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            {produto ? "Editar Produto" : "Novo Produto"}
          </h2>
          <Button onClick={onClose} size="icon" variant="ghost">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 border-b pb-2">Informações Básicas</h3>
              
              <div>
                <Label>Código do Produto *</Label>
                <Input 
                  value={formData.codigo} 
                  onChange={(e) => handleChange("codigo", e.target.value)}
                  placeholder="Ex: PROD001"
                  required 
                />
              </div>

              <div>
                <Label>Nome do Produto *</Label>
                <Input 
                  value={formData.nome} 
                  onChange={(e) => handleChange("nome", e.target.value)}
                  placeholder="Ex: Notebook Dell Inspiron"
                  required 
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea 
                  value={formData.descricao} 
                  onChange={(e) => handleChange("descricao", e.target.value)}
                  placeholder="Descrição detalhada do produto..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={formData.categoria} onValueChange={(v) => handleChange("categoria", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(categoria => (
                        <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Unidade de Medida</Label>
                  <Select value={formData.unidade_medida} onValueChange={(v) => handleChange("unidade_medida", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map(unidade => (
                        <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Preços e Estoque */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 border-b pb-2">Preços e Estoque</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preço de Custo (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={formData.preco_custo} 
                    onChange={(e) => handleChange("preco_custo", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Preço de Venda (R$) *</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={formData.preco_venda} 
                    onChange={(e) => handleChange("preco_venda", e.target.value)}
                    required 
                  />
                </div>
              </div>

              {formData.margem_lucro > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    <strong>Margem de Lucro:</strong> {formData.margem_lucro}%
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Estoque Atual</Label>
                  <Input 
                    type="number"
                    value={formData.estoque_atual} 
                    onChange={(e) => handleChange("estoque_atual", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Estoque Mínimo</Label>
                  <Input 
                    type="number"
                    value={formData.estoque_minimo} 
                    onChange={(e) => handleChange("estoque_minimo", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Fornecedor</Label>
                <Input 
                  value={formData.fornecedor} 
                  onChange={(e) => handleChange("fornecedor", e.target.value)}
                  placeholder="Nome do fornecedor principal"
                />
              </div>

              <div>
                <Label>URL da Imagem</Label>
                <Input 
                  value={formData.imagem_url} 
                  onChange={(e) => handleChange("imagem_url", e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  checked={formData.ativo}
                  onCheckedChange={(checked) => handleChange("ativo", checked)}
                />
                <Label>Produto Ativo</Label>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <Textarea 
              value={formData.observacoes} 
              onChange={(e) => handleChange("observacoes", e.target.value)}
              placeholder="Observações adicionais sobre o produto..."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" onClick={onClose} variant="ghost">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white">
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Salvando..." : "Salvar Produto"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}