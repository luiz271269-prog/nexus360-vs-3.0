import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, User, Users, AlertCircle, Phone, Tag, Check } from 'lucide-react';
import { normalizarTelefone } from '../lib/phoneUtils';
import { CATEGORIAS_DISPONIVEIS } from './CategorizadorRapido';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SearchAndFilter({
  searchTerm,
  onSearchChange,
  filterScope,
  onFilterScopeChange,
  selectedAttendantId,
  onSelectedAttendantChange,
  atendentes,
  isManager,
  novoContatoTelefone,
  onNovoContatoTelefoneChange,
  onCreateContact,
  integracoes = [],
  selectedIntegrationId,
  onSelectedIntegrationChange,
  selectedCategoria,
  onSelectedCategoriaChange
}) {
  // ✅ RESTAURADO: Detectar telefone automaticamente
  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      if (novoContatoTelefone) {
        onNovoContatoTelefoneChange('');
      }
      return;
    }

    const telefoneNormalizado = normalizarTelefone(searchTerm);
    
    if (telefoneNormalizado) {
      console.log('[SearchAndFilter] ✅ Telefone detectado:', telefoneNormalizado);
      if (telefoneNormalizado !== novoContatoTelefone) {
        onNovoContatoTelefoneChange(telefoneNormalizado);
      }
    } else {
      if (novoContatoTelefone) {
        onNovoContatoTelefoneChange('');
      }
    }
  }, [searchTerm, novoContatoTelefone, onNovoContatoTelefoneChange]);

  return (
    <div className="p-4 border-b border-slate-200 flex-shrink-0 space-y-3">
      {/* FILTROS NO TOPO - LADO A LADO */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterScope} onValueChange={onFilterScopeChange}>
          <SelectTrigger className="w-auto">
            <SelectValue placeholder="Escopo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="my">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" /> Minhas
              </div>
            </SelectItem>
            {isManager && (
              <>
                <SelectItem value="unassigned">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Não Atribuídas
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> Todas
                  </div>
                </SelectItem>
                {atendentes.length > 0 && (
                  <SelectItem value="specific_user">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" /> Por Atendente
                    </div>
                  </SelectItem>
                )}
              </>
            )}
          </SelectContent>
        </Select>

        {isManager && filterScope === 'specific_user' && (
          <Select
            value={selectedAttendantId || 'all_unfiltered'}
            onValueChange={onSelectedAttendantChange}
          >
            <SelectTrigger className="w-auto">
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_unfiltered">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" /> Todos
                </div>
              </SelectItem>
              <SelectItem value="unassigned_explicit">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Não Atribuídas
                </div>
              </SelectItem>
              {atendentes.map(att => (
                <SelectItem key={att.id} value={att.id}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" /> {att.full_name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {integracoes.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {selectedIntegrationId && selectedIntegrationId !== 'all'
                  ? integracoes.find(i => i.id === selectedIntegrationId)?.nome_instancia || 'Canal'
                  : 'Todos canais'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem
                onClick={() => onSelectedIntegrationChange('all')}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>Todos os canais</span>
                </div>
                {(!selectedIntegrationId || selectedIntegrationId === 'all') && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </DropdownMenuItem>
              {integracoes.map((integracao) => (
                <DropdownMenuItem
                  key={integracao.id}
                  onClick={() => onSelectedIntegrationChange(integracao.id)}
                  className="cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span>{integracao.status === 'conectado' ? '🟢' : '🔴'}</span>
                    <span>{integracao.nome_instancia}</span>
                  </div>
                  {selectedIntegrationId === integracao.id && (
                    <Check className="w-4 h-4 text-green-600" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {selectedCategoria && selectedCategoria !== 'all'
                ? CATEGORIAS_DISPONIVEIS.find(c => c.value === selectedCategoria)?.label || 'Categoria'
                : 'Todas categorias'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem
              onClick={() => onSelectedCategoriaChange('all')}
              className="cursor-pointer flex items-center justify-between"
            >
              <span>Todas as categorias</span>
              {(!selectedCategoria || selectedCategoria === 'all') && (
                <Check className="w-4 h-4 text-green-600" />
              )}
            </DropdownMenuItem>
            {CATEGORIAS_DISPONIVEIS.map((cat) => (
              <DropdownMenuItem
                key={cat.value}
                onClick={() => onSelectedCategoriaChange(cat.value)}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                  <span>{cat.label}</span>
                </div>
                {selectedCategoria === cat.value && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* BUSCA ABAIXO DOS FILTROS */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Buscar ou adicionar contato..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {novoContatoTelefone && (
          <Button
            onClick={onCreateContact}
            className="w-full mt-2 bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Criar Contato: {novoContatoTelefone}
          </Button>
        )}
      </div>
    </div>
  );
}