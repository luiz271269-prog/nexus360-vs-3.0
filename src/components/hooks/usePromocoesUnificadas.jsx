import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Fonte ÚNICA de leitura de promoções para todo o app.
 *
 * Combina as DUAS fontes reais de armazenamento:
 *  1. Entidade Promotion (promoções oficiais)
 *  2. Mensagens etiquetadas como "promocao" (Message.categorias inclui 'promocao')
 *
 * Todos os pontos que listam promoções (seletor de anexar, dialog de vincular,
 * página de gestão) devem consumir este hook — assim há um único cache,
 * uma única lógica de normalização e nenhuma duplicação.
 *
 * @param {object} opts
 * @param {boolean} opts.apenasAtivas  Se true, só Promotions ativas (default true)
 * @param {boolean} opts.incluirEtiquetadas  Se true, inclui Message etiquetada (default true)
 * @param {boolean} opts.enabled  Liga/desliga a query
 */
export function usePromocoesUnificadas({ apenasAtivas = true, incluirEtiquetadas = true, enabled = true } = {}) {
  return useQuery({
    queryKey: ['promocoes-unificadas', apenasAtivas, incluirEtiquetadas],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const fontes = [
        apenasAtivas
          ? base44.entities.Promotion.filter({ ativo: true }, '-priority', 100)
          : base44.entities.Promotion.list('-priority', 100),
        incluirEtiquetadas
          ? base44.entities.Message.filter({ categorias: 'promocao' }, '-created_date', 50)
          : Promise.resolve([])
      ];

      const [promos, msgsEtiquetadas] = await Promise.all(fontes);

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
          const imagemCard = m.media_type === 'image'
            ? m.media_url
            : (m.metadata?.thumbnail_url || m.metadata?.jpegThumbnail || null);
          return {
            id: `msg_${m.id}`,
            _origem: 'mensagem',
            _message_id: m.id,
            _media_type: m.media_type,
            _media_url: m.media_url,
            _created_at: m.created_date || m.sent_at,
            titulo: tituloLimpo,
            descricao: m.media_caption || (m.content && !m.content.startsWith('[') ? m.content : ''),
            imagem_url: imagemCard,
            categoria: 'etiquetada',
            ativo: true,
            instagram_posted_at: m.metadata?.instagram_posted_at || null,
            instagram_permalink: m.metadata?.instagram_permalink || null,
            instagram_post_tipo: m.metadata?.instagram_post_tipo || null,
            instagram_posted_by_name: m.metadata?.instagram_posted_by_name || null
          };
        });

      const promosComData = (promos || []).map(p => ({ ...p, _origem: 'promotion', _created_at: p.created_date }));

      // Ordena tudo por data desc (mais recentes primeiro)
      return [...promosComData, ...msgsComoPromos].sort((a, b) => {
        const ta = new Date(a._created_at || 0).getTime();
        const tb = new Date(b._created_at || 0).getTime();
        return tb - ta;
      });
    }
  });
}