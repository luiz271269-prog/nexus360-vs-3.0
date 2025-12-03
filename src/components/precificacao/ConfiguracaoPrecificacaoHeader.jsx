import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, DollarSign, TrendingUp, Truck, Percent } from 'lucide-react';

export default function ConfiguracaoPrecificacaoHeader({ config, onConfigChange }) {

  const handleChange = (key, value, isNumeric = false) => {
    onConfigChange((prev) => ({
      ...prev,
      [key]: isNumeric ? parseFloat(value) || 0 : value
    }));
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 backdrop-blur border border-slate-700/50 rounded-xl shadow-2xl">
      {/* Título com Gradiente Futurista */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-lg shadow-lg">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 bg-clip-text text-transparent">
          Configuração de Precificação
        </h2>
      </div>

      {/* Grade Horizontal Moderna */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Fornecedor */}
        <div className="lg:col-span-2">
          <Label className="text-xs font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent leading-none flex items-center gap-1 mb-2">
            <span className="text-cyan-400">🏢</span> Fornecedor
          </Label>
          <Input
            placeholder="Nome do Fornecedor"
            value={config.fornecedor}
            onChange={(e) => handleChange('fornecedor', e.target.value)}
            className="h-8 text-xs px-2 py-1 bg-slate-800/50 border-cyan-500/30 focus:border-cyan-400 focus:ring-cyan-400/50 text-white placeholder:text-slate-400" />
        </div>

        {/* Taxa Câmbio USD */}
        <div>
          <Label className="text-xs font-semibold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent leading-none flex items-center gap-1 mb-2">
            <DollarSign className="w-3 h-3 text-emerald-400" />USD
          </Label>
          <Input
            type="number"
            step="0.01"
            value={config.taxaCambio}
            onChange={(e) => handleChange('taxaCambio', e.target.value, true)}
            className="h-8 text-xs px-2 py-1 w-16 bg-slate-800/50 border-emerald-500/30 focus:border-emerald-400 focus:ring-emerald-400/50 text-white font-mono text-center" />
        </div>

        {/* Frete % */}
        <div>
          <Label className="text-xs font-semibold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent leading-none flex items-center gap-1 mb-2">
            <Truck className="w-3 h-3 text-blue-400" />Frete%
          </Label>
          <Input
            type="number"
            value={config.percentualFrete}
            onChange={(e) => handleChange('percentualFrete', e.target.value, true)}
            className="h-8 text-xs px-2 py-1 w-16 bg-slate-800/50 border-blue-500/30 focus:border-blue-400 focus:ring-blue-400/50 text-white font-mono text-center" />
        </div>

        {/* Impostos % */}
        <div>
          <Label className="text-xs font-semibold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent leading-none flex items-center gap-1 mb-2">
            <Percent className="w-3 h-3 text-red-400" />Imp%
          </Label>
          <Input
            type="number"
            value={config.percentualImpostos}
            onChange={(e) => handleChange('percentualImpostos', e.target.value, true)}
            className="h-8 text-xs px-2 py-1 w-16 bg-slate-800/50 border-red-500/30 focus:border-red-400 focus:ring-red-400/50 text-white font-mono text-center" />
        </div>

        {/* Custo Operacional % */}
        <div>
          <Label className="text-xs font-semibold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent leading-none mb-2">
            C.Op%
          </Label>
          <Input
            type="number"
            value={config.custoOperacional}
            onChange={(e) => handleChange('custoOperacional', e.target.value, true)}
            className="h-8 text-xs px-2 py-1 w-16 bg-slate-800/50 border-violet-500/30 focus:border-violet-400 focus:ring-violet-400/50 text-white font-mono text-center" />
        </div>

        {/* Margem % */}
        <div>
          <Label className="text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent leading-none flex items-center gap-1 mb-2">
            <TrendingUp className="w-3 h-3 text-amber-400" />Mg%
          </Label>
          <Input
            type="number"
            value={config.margemLucro}
            onChange={(e) => handleChange('margemLucro', e.target.value, true)}
            className="h-8 text-xs px-2 py-1 w-16 bg-slate-800/50 border-amber-500/30 focus:border-amber-400 focus:ring-amber-400/50 text-white font-mono text-center" />
        </div>

        {/* Link da Página */}
        <div>
          <Label className="text-xs font-semibold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent leading-none flex items-center gap-1 mb-2">
            <span className="text-teal-400">🔗</span> Link
          </Label>
          <Input
            placeholder="URL"
            value={config.linkPagina}
            onChange={(e) => handleChange('linkPagina', e.target.value)}
            className="h-8 text-xs px-2 py-1 bg-slate-800/50 border-teal-500/30 focus:border-teal-400 focus:ring-teal-400/50 text-white placeholder:text-slate-400" />
        </div>
      </div>
    </div>);
}