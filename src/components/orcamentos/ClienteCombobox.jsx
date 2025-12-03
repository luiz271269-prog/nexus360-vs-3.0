import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Building2, User, Star } from 'lucide-react';
import { toast } from 'sonner';
import { buscarComSimilaridade } from '@/components/lib/searchUtils';

export default function ClienteCombobox({ value, onChange, onNovoCliente }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    carregarClientes();
  }, []);

  useEffect(() => {
    if (value) {
      const cliente = clientes.find(c => c.razao_social === value);
      if (cliente) {
        setTermoBusca(cliente.razao_social);
      }
    }
  }, [value, clientes]);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Cliente.list('-updated_date', 100);
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  // 🔍 BUSCA FUZZY COM RANQUEAMENTO
  const filteredClientes = buscarComSimilaridade(
    clientes,
    termoBusca,
    ['razao_social', 'nome_fantasia', 'cnpj']
  ).slice(0, 8); // Limitar a 8 resultados

  const handleInputChange = (e) => {
    const valor = e.target.value;
    setTermoBusca(valor);
    setShowSuggestions(true);
    setSelectedIndex(0);
    
    if (!valor) {
      onChange('');
    }
  };

  const handleSelect = (cliente) => {
    setTermoBusca(cliente.razao_social);
    onChange(cliente.razao_social);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredClientes.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredClientes.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredClientes[selectedIndex]) {
          handleSelect(filteredClientes[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-slate-600';
  };

  const getScoreIcon = (score) => {
    if (score >= 90) return '🎯';
    if (score >= 70) return '✨';
    if (score >= 50) return '💡';
    return '🔍';
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          type="text"
          value={termoBusca}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Digite para buscar cliente..."
          className="pl-10 pr-24 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500"
        />
        <Button
          type="button"
          onClick={onNovoCliente}
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white h-8 px-3"
        >
          <Plus className="w-4 h-4 mr-1" />
          Novo
        </Button>
      </div>

      {/* Sugestões com Score de Similaridade */}
      {showSuggestions && filteredClientes.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border-2 border-slate-700 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
          {filteredClientes.map((cliente, index) => {
            const score = cliente._searchScore || 0;
            const isExato = cliente._matchExato;
            const contemTodas = cliente._contemTodas;
            
            return (
              <button
                key={cliente.id}
                type="button"
                onClick={() => handleSelect(cliente)}
                className={`w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0 ${
                  index === selectedIndex ? 'bg-slate-700' : ''
                } ${isExato ? 'bg-gradient-to-r from-green-900/20 to-transparent' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isExato && <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                      <p className="font-semibold text-white text-sm truncate">
                        {cliente.razao_social}
                      </p>
                    </div>
                    
                    {cliente.nome_fantasia && cliente.nome_fantasia !== cliente.razao_social && (
                      <p className="text-xs text-slate-400 truncate mb-1">
                        <Building2 className="w-3 h-3 inline mr-1" />
                        {cliente.nome_fantasia}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {cliente.cnpj && (
                        <span className="truncate">{cliente.cnpj}</span>
                      )}
                      {cliente.vendedor_responsavel && (
                        <span className="flex items-center gap-1 truncate">
                          <User className="w-3 h-3" />
                          {cliente.vendedor_responsavel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score de Similaridade */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge 
                      variant="outline" 
                      className={`${getScoreColor(score)} border-current text-[10px] px-2 py-0.5`}
                    >
                      {getScoreIcon(score)} {Math.round(score)}%
                    </Badge>
                    {isExato && (
                      <span className="text-[9px] text-green-400 font-semibold">Match Exato</span>
                    )}
                    {!isExato && contemTodas && (
                      <span className="text-[9px] text-blue-400 font-semibold">Todas Palavras</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Estado vazio */}
      {showSuggestions && termoBusca && filteredClientes.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border-2 border-slate-700 rounded-xl shadow-2xl p-4 text-center">
          <p className="text-slate-400 text-sm mb-2">Nenhum cliente encontrado</p>
          <Button
            type="button"
            onClick={onNovoCliente}
            size="sm"
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar novo cliente
          </Button>
        </div>
      )}
    </div>
  );
}