import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, DollarSign, TrendingUp, Truck, Percent } from 'lucide-react';

export default function ConfiguracaoPrecificacaoPainel({ config, onConfigChange }) {
  
  const handleChange = (key, value, isNumeric = false) => {
    onConfigChange(prev => ({
      ...prev,
      [key]: isNumeric ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <Card className="bg-white/90 backdrop-blur border-slate-200 shadow-lg">
      <CardHeader className="p-3">
        <CardTitle className="flex items-center gap-2 text-slate-800 text-sm">
          <Calculator className="w-4 h-4 text-amber-500" />
          Config. Precificação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3">
        {/* Fornecedor e Link - Compacto */}
        <div className="grid grid-cols-1 gap-2">
          <div>
            <Label className="text-xs">Fornecedor</Label>
            <Input
              placeholder="Nome do fornecedor"
              value={config.fornecedor}
              onChange={(e) => handleChange('fornecedor', e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Link da Página</Label>
            <Input
              placeholder="https://..."
              value={config.linkPagina}
              onChange={(e) => handleChange('linkPagina', e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        </div>
        
        {/* Câmbio */}
        <div className="bg-slate-50 rounded p-2 border">
          <h4 className="font-semibold text-xs flex items-center gap-1 mb-2">
            <DollarSign className="w-3 h-3 text-green-600"/>Câmbio
          </h4>
          <div>
            <Label className="text-xs">Taxa USD → BRL</Label>
            <Input
              type="number"
              step="0.01"
              value={config.taxaCambio}
              onChange={(e) => handleChange('taxaCambio', e.target.value, true)}
              className="h-6 text-xs"
            />
          </div>
        </div>

        {/* Frete */}
        <div className="bg-slate-50 rounded p-2 border">
          <h4 className="font-semibold text-xs flex items-center gap-1 mb-2">
            <Truck className="w-3 h-3 text-blue-600"/>Frete
          </h4>
          <div>
            <Label className="text-xs">Frete Internacional (%)</Label>
            <Input
              type="number"
              value={config.percentualFrete}
              onChange={(e) => handleChange('percentualFrete', e.target.value, true)}
              className="h-6 text-xs"
            />
          </div>
        </div>

        {/* Impostos e Custos */}
        <div className="bg-slate-50 rounded p-2 border">
          <h4 className="font-semibold text-xs flex items-center gap-1 mb-2">
            <Percent className="w-3 h-3 text-red-600"/>Impostos & Custos
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Impostos (%)</Label>
              <Input
                type="number"
                value={config.percentualImpostos}
                onChange={(e) => handleChange('percentualImpostos', e.target.value, true)}
                className="h-6 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">C. Operacional (%)</Label>
              <Input
                type="number"
                value={config.custoOperacional}
                onChange={(e) => handleChange('custoOperacional', e.target.value, true)}
                className="h-6 text-xs"
              />
            </div>
          </div>
        </div>
        
        {/* Margem */}
        <div className="bg-slate-50 rounded p-2 border">
          <h4 className="font-semibold text-xs flex items-center gap-1 mb-2">
            <TrendingUp className="w-3 h-3 text-purple-600"/>Margem
          </h4>
          <div>
            <Label className="text-xs">Margem de Lucro (%)</Label>
            <Input
              type="number"
              value={config.margemLucro}
              onChange={(e) => handleChange('margemLucro', e.target.value, true)}
              className="h-6 text-xs"
            />
          </div>
        </div>

      </CardContent>
    </Card>
  );
}