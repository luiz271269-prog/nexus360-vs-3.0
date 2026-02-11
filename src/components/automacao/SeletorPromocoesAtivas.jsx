import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Sparkles, 
  Image as ImageIcon, 
  Copy, 
  Loader2,
  CheckCircle2 
} from 'lucide-react';
import { toast } from 'sonner';

export default function SeletorPromocoesAtivas({ onSelecionarPromocao, onClose }) {
  const [promocoes, setPromocoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarPromocoesAtivas();
  }, []);

  const carregarPromocoesAtivas = async () => {
    try {
      setLoading(true);
      const promos = await base44.entities.Promotion.filter(
        { ativo: true },
        '-created_date',
        50
      );
      setPromocoes(promos);
    } catch (error) {
      console.error('[SeletorPromocoesAtivas] Erro ao carregar promoções:', error);
      toast.error('Erro ao carregar promoções');
    } finally {
      setLoading(false);
    }
  };

  const handleSelecionar = async (promo) => {
    if (!promo.image_url) {
      toast.error('Esta promoção não tem imagem configurada');
      return;
    }

    try {
      // Baixar a imagem da URL
      toast.info('📥 Preparando imagem da promoção...');
      
      const response = await fetch(promo.image_url);
      const blob = await response.blob();
      
      // Criar File object da imagem
      const fileName = `promocao-${promo.id}.${blob.type.split('/')[1] || 'jpg'}`;
      const file = new File([blob], fileName, { type: blob.type });
      
      // Criar preview URL
      const previewUrl = URL.createObjectURL(blob);
      
      // Passar para o componente pai
      onSelecionarPromocao({
        file,
        previewUrl,
        caption: promo.mensagem || promo.titulo || '',
        promocao: promo
      });
      
      toast.success('✅ Imagem da promoção carregada!');
      onClose();
    } catch (error) {
      console.error('[SeletorPromocoesAtivas] Erro ao carregar imagem:', error);
      toast.error('Erro ao carregar imagem da promoção');
    }
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 w-80 max-h-96 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold text-sm">Promoções Ativas</h3>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Lista de Promoções */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Carregando promoções...</p>
          </div>
        ) : promocoes.length === 0 ? (
          <div className="py-8 text-center">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">Nenhuma promoção ativa</p>
            <p className="text-xs text-slate-400 mt-1">Crie promoções na aba Automação</p>
          </div>
        ) : (
          <div className="space-y-2">
            {promocoes.map((promo) => (
              <button
                key={promo.id}
                onClick={() => handleSelecionar(promo)}
                className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all group"
              >
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  {promo.image_url ? (
                    <div className="relative flex-shrink-0">
                      <img
                        src={promo.image_url}
                        alt={promo.titulo}
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 group-hover:border-purple-300"
                      />
                      <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/10 rounded-lg transition-colors flex items-center justify-center">
                        <Copy className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800 truncate mb-1 group-hover:text-purple-700">
                      {promo.titulo}
                    </h4>
                    {promo.mensagem && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {promo.mensagem}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      {promo.image_url && (
                        <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                          ✓ Imagem
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {promo.tipo_gatilho || 'manual'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer com dica */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
        <p className="text-xs text-slate-500 text-center">
          💡 Clique em uma promoção para usar sua imagem
        </p>
      </div>
    </div>
  );
}