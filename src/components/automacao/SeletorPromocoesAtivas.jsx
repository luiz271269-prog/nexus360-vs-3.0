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
      // Carrega em paralelo: Promotions ativas + mensagens etiquetadas como "promocao"
      const [promos, msgsEtiquetadas] = await Promise.all([
        base44.entities.Promotion.filter({ ativo: true }, '-priority', 50),
        base44.entities.Message.filter({ categorias: 'promocao' }, '-created_date', 50)
      ]);

      // Normaliza mensagens etiquetadas para o mesmo "shape" das promoções
      const iconePorTipo = {
        video: '🎥 Vídeo etiquetado',
        audio: '🎤 Áudio etiquetado',
        document: '📄 Documento etiquetado',
        image: '🖼️ Imagem etiquetada',
        sticker: '🎨 Sticker etiquetado'
      };
      const msgsComoPromos = (msgsEtiquetadas || [])
        .filter(m => m.media_url || (m.content && !m.content.startsWith('[')))
        .map(m => {
          const tituloLimpo = m.content && !m.content.startsWith('[')
            ? m.content.substring(0, 60)
            : (iconePorTipo[m.media_type] || 'Mensagem etiquetada');
          // Imagem do card: usa imagem direto ou thumbnail de vídeo
          const imagemCard = m.media_type === 'image'
            ? m.media_url
            : (m.metadata?.thumbnail_url || m.metadata?.jpegThumbnail || null);
          return {
            id: `msg_${m.id}`,
            _origem: 'mensagem',
            _message_id: m.id,
            _media_type: m.media_type,
            _media_url: m.media_url,
            titulo: tituloLimpo,
            descricao: m.media_caption || (m.content && !m.content.startsWith('[') ? m.content : ''),
            imagem_url: imagemCard,
            categoria: 'etiquetada',
            ativo: true
          };
        });

      // Promoções primeiro, depois etiquetadas
      setPromocoes([...(promos || []), ...msgsComoPromos]);
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
      // URL da mídia: imagem da Promotion OU mídia da mensagem etiquetada (qualquer tipo)
      const mediaUrl = promo.imagem_url || promo._media_url;
      if (!mediaUrl) {
        toast.error(`${promo.titulo} não tem mídia configurada`);
        continue;
      }

      try {
        toast.info(`📥 Preparando ${promo.titulo}...`);
        
        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        
        const ext = blob.type.split('/')[1] || 'bin';
        const fileName = `promocao-${promo.id}.${ext}`;
        const file = new File([blob], fileName, { type: blob.type });
        const previewUrl = URL.createObjectURL(blob);
        
        onSelecionarPromocao({
          file,
          previewUrl,
          caption: promo.descricao || promo.titulo || '',
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
                {/* Mídia: Vídeo / Áudio / Documento / Imagem */}
                {promo._origem === 'mensagem' && promo._media_type === 'video' && promo._media_url ? (
                  <div className="relative w-full bg-black overflow-hidden">
                    <video
                      src={promo._media_url}
                      controls
                      preload="metadata"
                      poster={promo.imagem_url || undefined}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full max-h-64 object-contain bg-black"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelecao(promo.id);
                      }}
                      className="absolute top-3 right-3 z-20"
                      title={isSelected ? 'Desselecionar' : 'Selecionar'}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg border-2 ${isSelected ? 'bg-orange-500 border-orange-500' : 'bg-white border-white hover:border-orange-400'}`}>
                        {isSelected ? <CheckCircle2 className="w-5 h-5 text-white" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-400" />}
                      </div>
                    </button>
                  </div>
                ) : promo._origem === 'mensagem' && promo._media_type === 'audio' && promo._media_url ? (
                  <div className="relative w-full bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-6 flex items-center gap-3">
                    <span className="text-3xl">🎤</span>
                    <audio
                      src={promo._media_url}
                      controls
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-10"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelecao(promo.id);
                      }}
                      className="absolute top-3 right-3 z-20"
                      title={isSelected ? 'Desselecionar' : 'Selecionar'}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg border-2 ${isSelected ? 'bg-orange-500 border-orange-500' : 'bg-white border-white hover:border-orange-400'}`}>
                        {isSelected ? <CheckCircle2 className="w-5 h-5 text-white" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-400" />}
                      </div>
                    </button>
                  </div>
                ) : promo._origem === 'mensagem' && promo._media_type === 'document' && promo._media_url ? (
                  <div className="relative w-full bg-blue-50 p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">📄</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{promo.titulo}</p>
                      <a
                        href={promo._media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Abrir documento ↗
                      </a>
                    </div>
                    <div className="absolute top-3 right-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-lg ${isSelected ? 'bg-orange-500' : 'bg-white'}`}>
                        {isSelected ? <CheckCircle2 className="w-5 h-5 text-white" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-400" />}
                      </div>
                    </div>
                  </div>
                ) : promo.imagem_url ? (
                  <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
                    <img
                      src={promo.imagem_url}
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
                  <div className="relative w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-2">
                    <span className="text-5xl">
                      {promo._media_type === 'video' ? '🎥'
                        : promo._media_type === 'audio' ? '🎤'
                        : promo._media_type === 'document' ? '📄'
                        : promo._media_type === 'sticker' ? '🎨'
                        : '🖼️'}
                    </span>
                    {promo._origem === 'mensagem' && (
                      <span className="text-xs text-slate-600 font-medium">
                        {promo._media_type === 'video' ? 'Vídeo' : promo._media_type === 'audio' ? 'Áudio' : promo._media_type === 'document' ? 'Documento' : 'Mídia'}
                      </span>
                    )}
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
                  {promo.descricao && (
                    <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                      {promo.descricao}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {promo._origem === 'mensagem' && (
                      <Badge className="text-xs bg-blue-500 text-white">
                        📨 Etiquetada
                      </Badge>
                    )}
                    {promo.imagem_url && (
                      <Badge className="text-xs bg-green-500 text-white">
                        ✓ Com Imagem
                      </Badge>
                    )}
                    {promo.categoria && promo._origem !== 'mensagem' && (
                      <Badge variant="outline" className="text-xs">
                        {promo.categoria}
                      </Badge>
                    )}
                    {promo.price_info && (
                      <Badge className="text-xs bg-blue-500 text-white">
                        {promo.price_info}
                      </Badge>
                    )}
                    {promo.validade && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                        Até {new Date(promo.validade).toLocaleDateString('pt-BR')}
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