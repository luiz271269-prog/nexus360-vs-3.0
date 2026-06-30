import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Instagram, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { gerarLegendaInstagram } from '@/functions/gerarLegendaInstagram';
import { toast } from 'sonner';

/**
 * Modal de pré-visualização: gera por IA uma legenda profissional do produto,
 * permite editar, e publica no Instagram com a legenda aprovada.
 *
 * Props:
 *  - open, onOpenChange
 *  - item: item da Visão Combinada (título, descrição, preço, imagem)
 *  - mediaUrl, isVideo
 *  - publishing: bool (publicação em andamento, controlado pelo pai)
 *  - onPublish(caption): chamado ao confirmar — o pai executa a publicação
 */
export default function ModalLegendaInstagram({
  open, onOpenChange, item, mediaUrl, isVideo, publishing, onPublish
}) {
  const [caption, setCaption] = useState('');
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    setGerando(true);
    try {
      const res = await gerarLegendaInstagram({
        titulo: item.titulo,
        descricao: item.descricao_curta || item.descricao || '',
        price_info: item.price_info || '',
        validade: item.validade || '',
        imagem_url: mediaUrl,
        tipo_midia: isVideo ? 'video' : 'imagem'
      });
      if (res.data?.success) {
        setCaption(res.data.caption);
      } else {
        toast.error(res.data?.error || 'Falha ao gerar legenda');
      }
    } catch (error) {
      toast.error(`Erro ao gerar legenda: ${error?.response?.data?.error || error.message}`);
    } finally {
      setGerando(false);
    }
  };

  // Gera automaticamente ao abrir
  useEffect(() => {
    if (open) {
      setCaption('');
      gerar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5 text-pink-600" />
            Publicar no Instagram
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {mediaUrl && !isVideo && (
            <img
              src={mediaUrl}
              alt={item.titulo}
              className="w-full max-h-52 object-contain rounded-lg border border-slate-200 bg-slate-50"
            />
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              Legenda gerada por IA
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={gerar}
              disabled={gerando || publishing}
              className="h-7 text-xs text-purple-700 hover:bg-purple-50"
            >
              {gerando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Gerar de novo
            </Button>
          </div>

          {gerando && !caption ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-500 border border-dashed border-slate-200 rounded-lg">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              <span className="text-sm">Criando apresentação do produto...</span>
            </div>
          ) : (
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="A legenda aparecerá aqui..."
              className="min-h-48 text-sm leading-relaxed"
              disabled={publishing}
            />
          )}
          <p className="text-[11px] text-slate-400">
            Você pode editar o texto antes de publicar.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancelar
          </Button>
          <Button
            onClick={() => onPublish(caption.trim())}
            disabled={publishing || gerando || !caption.trim()}
            className="bg-pink-600 hover:bg-pink-700 text-white"
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Instagram className="w-4 h-4 mr-2" />
            )}
            {publishing ? 'Publicando...' : 'Publicar agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}