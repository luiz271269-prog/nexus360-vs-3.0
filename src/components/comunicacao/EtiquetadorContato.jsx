import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, X, Loader2 } from "lucide-react";
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

// Etiquetas fixas para contatos
const ETIQUETAS_FIXAS_CONTATO = [
  { nome: 'vip', label: 'VIP', emoji: '⭐', cor: 'bg-yellow-500', tipo: 'fixa' },
  { nome: 'prioridade', label: 'Prioridade', emoji: '🔥', cor: 'bg-red-500', tipo: 'fixa' },
  { nome: 'novo', label: 'Novo', emoji: '🆕', cor: 'bg-green-500', tipo: 'fixa' },
  { nome: 'recompra', label: 'Recompra', emoji: '🔄', cor: 'bg-blue-500', tipo: 'fixa' },
  { nome: 'inativo', label: 'Inativo', emoji: '💤', cor: 'bg-gray-500', tipo: 'fixa' },
  { nome: 'potencial', label: 'Potencial', emoji: '💎', cor: 'bg-purple-500', tipo: 'fixa' },
  { nome: 'negociando', label: 'Negociando', emoji: '🤝', cor: 'bg-indigo-500', tipo: 'fixa' },
  { nome: 'fidelizado', label: 'Fidelizado', emoji: '💚', cor: 'bg-emerald-500', tipo: 'fixa' }
];

export default function EtiquetadorContato({ contato, onUpdate, compact = false }) {
  const [salvando, setSalvando] = useState(false);
  const [novaEtiqueta, setNovaEtiqueta] = useState('');
  const [adicionandoNova, setAdicionandoNova] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const etiquetas = contato?.tags || [];
  const queryClient = useQueryClient();

  // Buscar etiquetas dinâmicas do banco
  const { data: etiquetasDB = [] } = useQuery({
    queryKey: ['etiquetas-contato'],
    queryFn: () => base44.entities.EtiquetaContato.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  // Combinar etiquetas fixas + dinâmicas
  const todasEtiquetas = [...ETIQUETAS_FIXAS_CONTATO, ...etiquetasDB.map(etq => ({
    nome: etq.nome,
    label: etq.label,
    emoji: etq.emoji || '🏷️',
    cor: etq.cor || 'bg-slate-400',
    tipo: etq.tipo
  }))];

  const toggleEtiqueta = async (valor, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (salvando || !contato) return;

    setSalvando(true);
    try {
      const novasEtiquetas = etiquetas.includes(valor)
        ? etiquetas.filter(e => e !== valor)
        : [...etiquetas, valor];

      await base44.entities.Contact.update(contato.id, {
        tags: novasEtiquetas
      });

      const config = todasEtiquetas.find(e => e.nome === valor);
      toast.success(`${config?.emoji || '🏷️'} ${novasEtiquetas.includes(valor) ? 'Etiqueta adicionada' : 'Etiqueta removida'}`);
      
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[EtiquetadorContato] Erro:', error);
      toast.error('Erro ao atualizar etiqueta');
    } finally {
      setSalvando(false);
    }
  };

  const adicionarNovaEtiqueta = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!novaEtiqueta.trim() || salvando || !contato) return;

    setSalvando(true);
    try {
      const etiquetaNormalizada = novaEtiqueta.trim().toLowerCase().replace(/\s+/g, '_');
      const labelOriginal = novaEtiqueta.trim();
      
      if (etiquetas.includes(etiquetaNormalizada)) {
        toast.warning('Etiqueta já existe neste contato');
        setNovaEtiqueta('');
        setAdicionandoNova(false);
        setSalvando(false);
        return;
      }

      // Verificar se etiqueta já existe no banco
      const existente = etiquetasDB.find(e => e.nome === etiquetaNormalizada);
      
      if (!existente) {
        // Criar nova etiqueta no banco
        await base44.entities.EtiquetaContato.create({
          nome: etiquetaNormalizada,
          label: labelOriginal,
          emoji: '🏷️',
          cor: 'bg-slate-400',
          tipo: 'personalizada',
          ativa: true,
          uso_count: 1
        });
        
        queryClient.invalidateQueries({ queryKey: ['etiquetas-contato'] });
      } else {
        // Incrementar contador de uso
        await base44.entities.EtiquetaContato.update(existente.id, {
          uso_count: (existente.uso_count || 0) + 1
        });
      }

      // Adicionar etiqueta ao contato
      const novasEtiquetas = [...etiquetas, etiquetaNormalizada];
      await base44.entities.Contact.update(contato.id, {
        tags: novasEtiquetas
      });

      toast.success('✅ Nova etiqueta criada e adicionada!');
      setNovaEtiqueta('');
      setAdicionandoNova(false);
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[EtiquetadorContato] Erro ao adicionar:', error);
      toast.error('Erro ao adicionar etiqueta');
    } finally {
      setSalvando(false);
    }
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
      <DropdownMenuTrigger asChild onClick={handleMenuClick}>
        {compact ? (
          <button
            className="p-1 rounded-full hover:bg-slate-100 transition-colors"
            disabled={salvando}
            onClick={handleMenuClick}
          >
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <Tag className="w-4 h-4 text-slate-500 hover:text-purple-600" />
            )}
          </button>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 border-dashed hover:border-solid hover:bg-slate-50"
            disabled={salvando}
            onClick={handleMenuClick}
          >
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            {etiquetas.length > 0 ? `${etiquetas.length} etiquetas` : 'Etiquetar'}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" onClick={handleMenuClick}>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Etiquetas do Contato</span>
          {etiquetas.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {etiquetas.length}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Botão para adicionar nova etiqueta */}
        {!adicionandoNova ? (
          <div 
            className="px-2 py-2 cursor-pointer hover:bg-slate-50 rounded flex items-center gap-2 text-sm text-purple-600 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              setAdicionandoNova(true);
            }}
          >
            <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-purple-600 font-bold text-xs">+</span>
            </div>
            <span>Nova etiqueta personalizada</span>
          </div>
        ) : (
          <div className="px-2 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="Digite o nome..."
              value={novaEtiqueta}
              onChange={(e) => setNovaEtiqueta(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') adicionarNovaEtiqueta(e);
                if (e.key === 'Escape') {
                  setAdicionandoNova(false);
                  setNovaEtiqueta('');
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={adicionarNovaEtiqueta}
                disabled={!novaEtiqueta.trim() || salvando}
                className="flex-1 h-7 text-xs bg-purple-600 hover:bg-purple-700"
              >
                {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Criar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setAdicionandoNova(false);
                  setNovaEtiqueta('');
                }}
                className="h-7 text-xs"
              >
                ✕
              </Button>
            </div>
          </div>
        )}
        
        <DropdownMenuSeparator />
        
        {/* Etiquetas atuais do contato */}
        {etiquetas.length > 0 && (
          <>
            <div className="px-2 py-1">
              <span className="text-xs text-slate-500 font-medium">Etiquetas ativas:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {etiquetas.map(etq => {
                  const config = todasEtiquetas.find(e => e.nome === etq);
                  return (
                    <Badge 
                      key={etq}
                      className={`${config?.cor || 'bg-slate-400'} text-white border-0 text-xs cursor-pointer hover:opacity-80`}
                      onClick={(e) => toggleEtiqueta(etq, e)}
                      title="Clique para remover"
                    >
                      {config?.emoji || '🏷️'} {config?.label || etq.replace(/_/g, ' ')}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  );
                })}
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        
        {/* Todas as etiquetas disponíveis */}
        <div className="max-h-48 overflow-y-auto">
          {todasEtiquetas.map(etq => (
            <DropdownMenuCheckboxItem
              key={etq.nome}
              checked={etiquetas.includes(etq.nome)}
              onCheckedChange={() => toggleEtiqueta(etq.nome)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${etq.cor}`} />
                <span>{etq.emoji} {etq.label}</span>
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Exportar para uso em filtros
export const getEtiquetaContatoConfig = (nome, etiquetasDB = []) => {
  const fixa = ETIQUETAS_FIXAS_CONTATO.find(e => e.nome === nome);
  if (fixa) return { value: fixa.nome, label: `${fixa.emoji} ${fixa.label}`, color: fixa.cor, emoji: fixa.emoji };
  
  const dinamica = etiquetasDB.find(e => e.nome === nome);
  if (dinamica) return { value: dinamica.nome, label: `${dinamica.emoji || '🏷️'} ${dinamica.label}`, color: dinamica.cor || 'bg-slate-400', emoji: dinamica.emoji || '🏷️' };
  
  return { value: nome, label: `🏷️ ${nome.replace(/_/g, ' ')}`, color: 'bg-slate-400', emoji: '🏷️' };
};

export { ETIQUETAS_FIXAS_CONTATO };