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
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Selecione as categorias</DropdownMenuLabel>
          <DropdownMenuSeparator />
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
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Badges visuais das categorias ativas */}
      {categorias.map(cat => {
        const config = CATEGORIAS_DISPONIVEIS.find(c => c.value === cat);
        if (!config) return null;
        
        return (
          <Badge 
            key={cat}
            className={`${config.color} text-white border-0 gap-1.5 cursor-pointer hover:opacity-80 transition-all shadow-md px-3 py-1.5 text-sm font-medium`}
            onClick={() => toggleCategoria(cat)}
            title="Clique para remover"
          >
            <span>{config.label}</span>
            <X className="w-4 h-4 hover:scale-125 transition-transform" />
          </Badge>
        );
      })}
    </div>
  );
}

export { CATEGORIAS_DISPONIVEIS };