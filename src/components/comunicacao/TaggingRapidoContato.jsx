import { useState, useEffect, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// ✅ Memoização para evitar re-renders
const TaggingRapidoContatoMemo = ({ contactId, etiquetasAtuais = [], etiquetasDisponiveis = [], onTagsUpdated }) => {
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setEtiquetasSelecionadas(etiquetasAtuais || []);
  }, [etiquetasAtuais]);

  const handleToggleTag = (tagId) => {
    setEtiquetasSelecionadas(prev => 
      prev.includes(tagId)
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await base44.entities.Contact.update(contactId, { tags: etiquetasSelecionadas });
      toast.success('✅ Etiquetas atualizadas');
      if (onTagsUpdated) onTagsUpdated(etiquetasSelecionadas);
    } catch (error) {
      console.error('[TaggingRapido] Erro ao salvar:', error);
      toast.error('Erro ao salvar etiquetas');
    } finally {
      setSalvando(false);
    }
  };

  const getTagInfo = useMemo(() => (tagId) => {
    return etiquetasDisponiveis.find(e => e.id === tagId || e.nome === tagId);
  }, [etiquetasDisponiveis]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-8 w-8 p-0"
          title="Etiquetar contato"
        >
          <Tag className="w-4 h-4 text-slate-500 hover:text-slate-700" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0">
        <div className="bg-white rounded-lg shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800">Etiquetas</h4>
            <button 
              onClick={handleSalvar}
              disabled={salvando}
              className="text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50"
            >
              {salvando ? '⏳' : '✓'} Salvar
            </button>
          </div>

          {/* Etiquetas selecionadas */}
          {etiquetasSelecionadas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {etiquetasSelecionadas.map(tagId => {
                const tagInfo = getTagInfo(tagId);
                return (
                  <Badge 
                    key={tagId}
                    className="text-xs cursor-pointer flex items-center gap-1"
                    onClick={() => handleToggleTag(tagId)}
                  >
                    {tagInfo?.nome || tagId}
                    <X className="w-2.5 h-2.5" />
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Lista de etiquetas disponíveis */}
          <div className="max-h-64 overflow-y-auto border-t pt-3 space-y-1.5">
            {etiquetasDisponiveis.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma etiqueta disponível</p>
            ) : (
              etiquetasDisponiveis.map(tag => (
                <label 
                  key={tag.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={etiquetasSelecionadas.includes(tag.id) || etiquetasSelecionadas.includes(tag.nome)}
                    onChange={() => handleToggleTag(tag.id || tag.nome)}
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{tag.nome}</p>
                    <p className="text-xs text-slate-500">
                      {tag.classe_abc && `${tag.classe_abc} • `}
                      Score: {tag.peso_qualificacao || 0}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}