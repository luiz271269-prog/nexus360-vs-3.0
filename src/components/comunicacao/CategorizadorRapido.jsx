import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CATEGORIAS_DISPONIVEIS = [
  { value: 'venda', label: '💰 Venda', color: 'bg-green-500' },
  { value: 'suporte', label: '🛠️ Suporte', color: 'bg-blue-500' },
  { value: 'urgente', label: '🚨 Urgente', color: 'bg-red-500' },
  { value: 'aguardando_pagamento', label: '💳 Aguardando Pagamento', color: 'bg-yellow-500' },
  { value: 'cotacao', label: '📋 Cotação', color: 'bg-purple-500' },
  { value: 'pos_venda', label: '✅ Pós-Venda', color: 'bg-indigo-500' },
  { value: 'duvida', label: '❓ Dúvida', color: 'bg-gray-500' },
  { value: 'reclamacao', label: '⚠️ Reclamação', color: 'bg-orange-500' }
];

export default function CategorizadorRapido({ thread, onUpdate }) {
  const [salvando, setSalvando] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [adicionandoNova, setAdicionandoNova] = useState(false);
  const categorias = thread?.categorias || [];

  const toggleCategoria = async (valor) => {
    if (salvando || !thread) return;

    setSalvando(true);
    try {
      const novasCategorias = categorias.includes(valor)
        ? categorias.filter(c => c !== valor)
        : [...categorias, valor];

      await base44.entities.MessageThread.update(thread.id, {
        categorias: novasCategorias
      });

      toast.success('Categoria atualizada');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[CategorizadorRapido] Erro:', error);
      toast.error('Erro ao atualizar categoria');
    } finally {
      setSalvando(false);
    }
  };

  const adicionarNovaCategoria = async () => {
    if (!novaCategoria.trim() || salvando || !thread) return;

    setSalvando(true);
    try {
      const categoriaNormalizada = novaCategoria.trim().toLowerCase().replace(/\s+/g, '_');
      
      if (categorias.includes(categoriaNormalizada)) {
        toast.warning('Categoria já existe nesta conversa');
        setNovaCategoria('');
        setAdicionandoNova(false);
        setSalvando(false);
        return;
      }

      const novasCategorias = [...categorias, categoriaNormalizada];

      await base44.entities.MessageThread.update(thread.id, {
        categorias: novasCategorias
      });

      toast.success('✅ Nova categoria adicionada!');
      setNovaCategoria('');
      setAdicionandoNova(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[CategorizadorRapido] Erro ao adicionar:', error);
      toast.error('Erro ao adicionar categoria');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 border-dashed hover:border-solid hover:bg-slate-50"
            disabled={salvando}
          >
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            {categorias.length > 0 ? `${categorias.length} categorizadas` : 'Adicionar'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Selecione as categorias</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Botão para adicionar nova categoria */}
          {!adicionandoNova ? (
            <div 
              className="px-2 py-2 cursor-pointer hover:bg-slate-50 rounded flex items-center gap-2 text-sm text-blue-600 font-medium"
              onClick={(e) => {
                e.stopPropagation();
                setAdicionandoNova(true);
              }}
            >
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xs">+</span>
              </div>
              <span>Nova categoria personalizada</span>
            </div>
          ) : (
            <div className="px-2 py-2 space-y-2">
              <input
                type="text"
                placeholder="Digite o nome..."
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') adicionarNovaCategoria();
                  if (e.key === 'Escape') {
                    setAdicionandoNova(false);
                    setNovaCategoria('');
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    adicionarNovaCategoria();
                  }}
                  disabled={!novaCategoria.trim() || salvando}
                  className="flex-1 h-7 text-xs"
                >
                  ✓ Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdicionandoNova(false);
                    setNovaCategoria('');
                  }}
                  className="h-7 text-xs"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}
          
          <DropdownMenuSeparator />
          
          {/* Categorias padrão */}
          {CATEGORIAS_DISPONIVEIS.map(cat => (
            <DropdownMenuCheckboxItem
              key={cat.value}
              checked={categorias.includes(cat.value)}
              onCheckedChange={() => toggleCategoria(cat.value)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                <span>{cat.label}</span>
              </div>
            </DropdownMenuCheckboxItem>
          ))}
          
          {/* Categorias personalizadas existentes */}
          {categorias.filter(cat => !CATEGORIAS_DISPONIVEIS.find(c => c.value === cat)).map(cat => (
            <DropdownMenuCheckboxItem
              key={cat}
              checked={true}
              onCheckedChange={() => toggleCategoria(cat)}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-400" />
                <span className="italic">🏷️ {cat.replace(/_/g, ' ')}</span>
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Badges visuais das categorias ativas */}
      {categorias.map(cat => {
        const config = CATEGORIAS_DISPONIVEIS.find(c => c.value === cat);
        
        return (
          <Badge 
            key={cat}
            className={`${config ? config.color : 'bg-slate-400'} text-white border-0 gap-1.5 cursor-pointer hover:opacity-80 transition-all shadow-md px-3 py-1.5 text-sm font-medium`}
            onClick={() => toggleCategoria(cat)}
            title="Clique para remover"
          >
            <span>{config ? config.label : `🏷️ ${cat.replace(/_/g, ' ')}`}</span>
            <X className="w-4 h-4 hover:scale-125 transition-transform" />
          </Badge>
        );
      })}
    </div>
  );
}

export { CATEGORIAS_DISPONIVEIS };