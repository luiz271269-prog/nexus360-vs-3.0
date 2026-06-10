import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { instagramPostarPromocao } from '@/functions/instagramPostarPromocao';
import { instagramPublicarCarrossel } from '@/functions/instagramPublicarCarrossel';
import { Button } from '@/components/ui/button';
import { Instagram, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Botão Postar/Repostar no Instagram para um item da Visão Combinada.
 * - Promoção oficial → instagramPostarPromocao (grava rastreio na Promotion)
 * - Mensagem etiquetada → instagramPublicarCarrossel (post avulso da imagem)
 */
export default function BotaoPostarInstagram({ item }) {
  const [posting, setPosting] = useState(false);
  const queryClient = useQueryClient();

  const isVideo = item._media_type === 'video' || item.tipo_midia === 'video';
  const mediaUrl = item._media_url || item.imagem_url;
  if (!mediaUrl) return null;

  const jaPostada = !!item.instagram_posted_at;
  const tipoPost = item.instagram_post_tipo
    || (item._origem === 'promotion' ? (item.tipo_midia === 'video' ? 'reels' : 'imagem') : null);

  const postar = async (e) => {
    e.stopPropagation();

    // Controle de deduplicação: confirma antes de repostar
    let force = false;
    if (jaPostada) {
      const dataPost = new Date(item.instagram_posted_at).toLocaleString('pt-BR');
      if (!window.confirm(`⚠️ Esta promoção já foi publicada em ${dataPost}.\n\nDeseja publicar NOVAMENTE no Instagram?`)) {
        return;
      }
      force = true;
    }

    setPosting(true);
    try {
      let res;
      if (item._origem === 'promotion') {
        res = await instagramPostarPromocao({ promotion_id: item.id, force });
      } else {
        const caption = `🔥 ${item.titulo || 'Oferta NeuralTec'}\n\n📲 Chama no direct ou WhatsApp!\n#neuraltec #tecnologia #ofertas`;
        res = await instagramPublicarCarrossel(
          isVideo
            ? { video_url: mediaUrl, caption, message_id: item._message_id, force }
            : { image_urls: [mediaUrl], caption, message_id: item._message_id, force }
        );
      }
      if (res.data?.success) {
        toast.success(`✅ Publicado no Instagram!`, {
          action: res.data.permalink ? {
            label: 'Ver post',
            onClick: () => window.open(res.data.permalink, '_blank')
          } : undefined
        });
        queryClient.invalidateQueries({ queryKey: ['promocoes-unificadas'] });
      } else {
        toast.error(res.data?.motivo || res.data?.error || 'Erro ao publicar');
      }
    } catch (error) {
      const msg = error?.response?.data?.error || error.message;
      toast.error(`Erro: ${msg}`);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-slate-100">
      {jaPostada && (
        <div className="flex items-center gap-1 mb-1.5 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 w-fit">
          ✅ Publicado{tipoPost ? ` (${tipoPost})` : ''} em {new Date(item.instagram_posted_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={postar}
        disabled={posting}
        className="h-7 text-xs flex-1 border-pink-300 text-pink-700 hover:bg-pink-50"
      >
        {posting ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : (
          <Instagram className="w-3 h-3 mr-1" />
        )}
        {posting ? 'Publicando...' : jaPostada ? 'Repostar' : 'Postar no Instagram'}
      </Button>
      {item.instagram_permalink && (
        <a
          href={item.instagram_permalink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-pink-600 hover:border-pink-300"
          title="Ver publicação no Instagram"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
      </div>
    </div>
  );
}