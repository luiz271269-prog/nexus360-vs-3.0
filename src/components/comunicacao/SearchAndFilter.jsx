import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, User, Users, AlertCircle, Phone, Tag } from 'lucide-react';
import { normalizarTelefone } from '../lib/phoneUtils';
import { CATEGORIAS_DISPONIVEIS } from './CategorizadorRapido';

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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Buscar ou adicionar contato..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {/* ✅ RESTAURADO: Botão para criar contato quando telefone detectado */}
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

      <Select value={filterScope} onValueChange={onFilterScopeChange}>
        <SelectTrigger>
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
          <SelectTrigger>
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

      {/* 🆕 FILTRO POR CANAL WHATSAPP - GRADE DE BADGES */}
      {integracoes.length > 1 && (
        <div className="w-full pt-2 border-t border-slate-200">
          <label className="text-xs text-slate-600 mb-2 block font-medium">Filtrar por canal:</label>
          <div className="flex flex-wrap gap-2">
            <Badge
              onClick={() => onSelectedIntegrationChange('all')}
              className={`cursor-pointer transition-all ${
                !selectedIntegrationId || selectedIntegrationId === 'all'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Phone className="w-3 h-3 mr-1" />
              Todos
            </Badge>
            {integracoes.map((integracao) => (
              <Badge
                key={integracao.id}
                onClick={() => onSelectedIntegrationChange(integracao.id)}
                className={`cursor-pointer transition-all ${
                  selectedIntegrationId === integracao.id
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                }`}
                title={`${integracao.numero_telefone}\n${integracao.status === 'conectado' ? '🟢 Conectado' : '🔴 Desconectado'}`}
                >
                {integracao.status === 'conectado' ? '🟢' : '🔴'} {integracao.nome_instancia}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}