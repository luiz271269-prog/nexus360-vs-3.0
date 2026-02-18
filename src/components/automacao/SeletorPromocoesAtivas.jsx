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
  const [selecionadas, setSelecionadas] = useState([]);

  useEffect(() => {
    carregarPromocoesAtivas();
  }, []);

  const carregarPromocoesAtivas = async () => {
    try {
      setLoading(true);
      const promos = await base44.entities.Promotion.filter(
        { ativo: true },
        '-priority',
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

  const toggleSelecao = (promoId) => {
    setSelecionadas(prev => 
      prev.includes(promoId) 
        ? prev.filter(id => id !== promoId)
        : [...prev, promoId]
    );
  };

  const handleEnviarSelecionadas = async () => {
    if (selecionadas.length === 0) {
      toast.error('Selecione pelo menos uma promoção');
      return;
    }

    const promosSelecionadas = promocoes.filter(p => selecionadas.includes(p.id));
    
    for (const promo of promosSelecionadas) {
      if (!promo.image_url) {
        toast.error(`${promo.titulo} não tem imagem configurada`);
        continue;
      }

      try {
        toast.info(`📥 Preparando ${promo.titulo}...`);
        
        const response = await fetch(promo.image_url);
        const blob = await response.blob();
        
        const fileName = `promocao-${promo.id}.${blob.type.split('/')[1] || 'jpg'}`;
        const file = new File([blob], fileName, { type: blob.type });
        const previewUrl = URL.createObjectURL(blob);
        
        onSelecionarPromocao({
          file,
          previewUrl,
          caption: promo.mensagem || promo.titulo || '',
          promocao: promo
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error('[SeletorPromocoesAtivas] Erro:', error);
        toast.error(`Erro ao carregar ${promo.titulo}`);
      }
    }
    
    toast.success(`✅ ${selecionadas.length} promoção(ões) carregadas!`);
    onClose();
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 w-[420px] max-h-[500px] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold">Promoções Ativas</h3>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Lista de Promoções */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600">Carregando promoções...</p>
          </div>
        ) : promocoes.length === 0 ? (
          <div className="py-12 text-center">
            <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Nenhuma promoção ativa</p>
            <p className="text-xs text-slate-400 mt-1">Crie promoções na aba Automação</p>
          </div>
        ) : (
          <div className="space-y-3">
            {promocoes.map((promo) => {
              const isSelected = selecionadas.includes(promo.id);
              return (
              <button
                key={promo.id}
                onClick={() => toggleSelecao(promo.id)}
                className={`w-full text-left rounded-xl border-2 transition-all group overflow-hidden ${
                  isSelected 
                    ? 'border-orange-500 bg-orange-50 shadow-lg' 
                    : 'border-slate-200 hover:border-orange-400 hover:shadow-lg bg-white'
                }`}
              >
                {/* Imagem Grande com Checkbox */}
                {promo.image_url ? (
                  <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
                    <img
                      src={promo.image_url}
                      alt={promo.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Checkbox */}
                    <div className="absolute top-3 right-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        isSelected 
                          ? 'bg-orange-500' 
                          : 'bg-white/90 group-hover:bg-white'
                      }`}>
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-400" />
                        )}
                      </div>
                    </div>
                    {/* Overlay ao hover */}
                    <div className={`absolute inset-0 transition-opacity ${
                      isSelected ? 'bg-orange-500/20' : 'bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100'
                    }`}>
                      {!isSelected && (
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                          <span className="text-white font-medium text-sm flex items-center gap-2">
                            <Copy className="w-4 h-4" />
                            Clique para selecionar
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-slate-400" />
                    <div className="absolute top-3 right-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        isSelected ? 'bg-orange-500' : 'bg-white'
                      }`}>
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Info */}
                <div className="p-3">
                  <h4 className="text-sm font-bold text-slate-900 mb-1 group-hover:text-orange-600 transition-colors">
                    {promo.titulo}
                  </h4>
                  {promo.mensagem && (
                    <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                      {promo.mensagem}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {promo.image_url && (
                      <Badge className="text-xs bg-green-500 text-white">
                        ✓ Com Imagem
                      </Badge>
                    )}
                    {promo.categoria && (
                      <Badge variant="outline" className="text-xs">
                        {promo.categoria}
                      </Badge>
                    )}
                    {promo.preco && (
                      <Badge className="text-xs bg-blue-500 text-white">
                        R$ {parseFloat(promo.preco).toFixed(2)}
                      </Badge>
                    )}
                    {promo.expires_at && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                        Até {new Date(promo.expires_at).toLocaleDateString('pt-BR')}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
            })}
          </div>
        )}
      </div>

      {/* Footer com contador e botão de envio */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-200">
        {selecionadas.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-700 font-medium">
              {selecionadas.length} selecionada(s)
            </p>
            <Button
              onClick={handleEnviarSelecionadas}
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Enviar Selecionadas
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-700 text-center font-medium">
            💡 Clique nas promoções para selecioná-las
          </p>
        )}
      </div>
    </div>
  );
}