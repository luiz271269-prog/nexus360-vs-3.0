import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CATEGORIAS_FIXAS = [
  { nome: 'venda', label: 'Venda', emoji: '💰', cor: 'bg-green-500', tipo: 'fixa', tipos_contato_aplicaveis: ['lead', 'cliente'], filas_aplicaveis: ['vendas'] },
  { nome: 'suporte', label: 'Suporte', emoji: '🛠️', cor: 'bg-blue-500', tipo: 'fixa', tipos_contato_aplicaveis: ['cliente'], filas_aplicaveis: ['assistencia'] },
  { nome: 'urgente', label: 'Urgente', emoji: '🚨', cor: 'bg-red-500', tipo: 'fixa', tipos_contato_aplicaveis: [], filas_aplicaveis: [] },
  { nome: 'aguardando_pagamento', label: 'Aguardando Pagamento', emoji: '💳', cor: 'bg-yellow-500', tipo: 'fixa', tipos_contato_aplicaveis: ['cliente'], filas_aplicaveis: ['financeiro', 'vendas'] },
  { nome: 'cotacao', label: 'Cotação', emoji: '📋', cor: 'bg-purple-500', tipo: 'fixa', tipos_contato_aplicaveis: ['lead', 'cliente', 'fornecedor'], filas_aplicaveis: ['vendas', 'fornecedor'] },
  { nome: 'pos_venda', label: 'Pós-Venda', emoji: '✅', cor: 'bg-indigo-500', tipo: 'fixa', tipos_contato_aplicaveis: ['cliente'], filas_aplicaveis: ['vendas', 'assistencia'] },
  { nome: 'duvida', label: 'Dúvida', emoji: '❓', cor: 'bg-gray-500', tipo: 'fixa', tipos_contato_aplicaveis: [], filas_aplicaveis: [] },
  { nome: 'reclamacao', label: 'Reclamação', emoji: '⚠️', cor: 'bg-orange-500', tipo: 'fixa', tipos_contato_aplicaveis: ['cliente'], filas_aplicaveis: [] }
];

export default function CategorizadorRapido({ thread, contato = null, onUpdate }) {
  const [salvando, setSalvando] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [adicionandoNova, setAdicionandoNova] = useState(false);
  const categorias = thread?.categorias || [];
  const queryClient = useQueryClient();
  
  // Proteção: não renderizar se thread não existir
  if (!thread) {
    return null;
  }
  
  // Contexto do contato para filtragem inteligente
  const tipoContato = contato?.tipo_contato || 'novo';
  const filaAtual = thread.sector_id || 'geral';

  // Buscar categorias dinâmicas do banco
  const { data: categoriasDB = [] } = useQuery({
    queryKey: ['categorias-mensagens'],
    queryFn: () => base44.entities.CategoriasMensagens.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  // Combinar categorias fixas + dinâmicas
  const todasCategoriasBase = [...CATEGORIAS_FIXAS, ...categoriasDB.map(cat => ({
    nome: cat.nome,
    label: cat.label,
    emoji: cat.emoji || '🏷️',
    cor: cat.cor || 'bg-slate-400',
    tipo: cat.tipo,
    tipos_contato_aplicaveis: cat.tipos_contato_aplicaveis || [],
    filas_aplicaveis: cat.filas_aplicaveis || []
  }))];
  
  // Filtrar categorias aplicáveis ao contexto atual
  const todasCategorias = todasCategoriasBase.filter(cat => {
    // Categorias urgente e dúvida sempre disponíveis
    if (cat.nome === 'urgente' || cat.nome === 'duvida') return true;
    
    // Se não tem restrição, disponível para todos
    const tiposOk = !cat.tipos_contato_aplicaveis || cat.tipos_contato_aplicaveis.length === 0 || cat.tipos_contato_aplicaveis.includes(tipoContato);
    const filasOk = !cat.filas_aplicaveis || cat.filas_aplicaveis.length === 0 || cat.filas_aplicaveis.includes(filaAtual);
    
    return tiposOk && filasOk;
  });

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
      const labelOriginal = novaCategoria.trim();
      
      if (categorias.includes(categoriaNormalizada)) {
        toast.warning('Categoria já existe nesta conversa');
        setNovaCategoria('');
        setAdicionandoNova(false);
        setSalvando(false);
        return;
      }

      // Verificar se categoria já existe no banco
      const existente = categoriasDB.find(c => c.nome === categoriaNormalizada);
      
      if (!existente) {
        // Criar nova categoria no banco
        await base44.entities.CategoriasMensagens.create({
          nome: categoriaNormalizada,
          label: labelOriginal,
          emoji: '🏷️',
          cor: 'bg-slate-400',
          tipo: 'personalizada',
          ativa: true,
          uso_count: 1
        });
        
        queryClient.invalidateQueries({ queryKey: ['categorias-mensagens'] });
      } else {
        // Incrementar contador de uso
        await base44.entities.CategoriasMensagens.update(existente.id, {
          uso_count: (existente.uso_count || 0) + 1
        });
      }

      // Adicionar categoria à thread
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
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Badges compactos das categorias ativas - ao lado do nome */}
      {categorias.slice(0, 3).map(cat => {
        const config = todasCategorias.find(c => c.nome === cat);
        return (
          <Badge 
            key={cat}
            className={`${config?.cor || 'bg-slate-400'} text-white border-0 px-1.5 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80`}
            onClick={() => toggleCategoria(cat)}
            title={`${config?.label || cat} - Clique para remover`}
          >
            {config?.emoji || '🏷️'}
          </Badge>
        );
      })}
      {categorias.length > 3 && (
        <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px]">
          +{categorias.length - 3}
        </Badge>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer transition-colors border border-dashed border-slate-300 hover:border-solid"
            disabled={salvando}
            title="Adicionar categoria"
          >
            <Tag className="w-3 h-3 text-slate-500" />
          </button>
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
          
          {/* Todas as categorias (fixas + dinâmicas) */}
          {todasCategorias.map(cat => (
            <DropdownMenuCheckboxItem
              key={cat.nome}
              checked={categorias.includes(cat.nome)}
              onCheckedChange={() => toggleCategoria(cat.nome)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${cat.cor}`} />
                <span>{cat.emoji} {cat.label}</span>
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

    </div>
  );
}

// Exportar para uso em filtros
export const getCategoriaConfig = (nome, categoriasDB = []) => {
  const fixa = CATEGORIAS_FIXAS.find(c => c.nome === nome);
  if (fixa) return { value: fixa.nome, label: `${fixa.emoji} ${fixa.label}`, color: fixa.cor };
  
  const dinamica = categoriasDB.find(c => c.nome === nome);
  if (dinamica) return { value: dinamica.nome, label: `${dinamica.emoji || '🏷️'} ${dinamica.label}`, color: dinamica.cor || 'bg-slate-400' };
  
  return { value: nome, label: `🏷️ ${nome.replace(/_/g, ' ')}`, color: 'bg-slate-400' };
};

export { CATEGORIAS_FIXAS };