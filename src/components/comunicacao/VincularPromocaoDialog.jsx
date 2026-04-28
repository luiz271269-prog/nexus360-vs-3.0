import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Loader2, Image as ImageIcon, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * Dialog para vincular uma mensagem a uma Promotion existente.
 *
 * Estratégia "Vincular B": lista Promotions ativas → seleciona → salva
 * promotion_id em Message.metadata. Sem duplicação de dados — Promotion
 * é sempre a fonte única de verdade.
 */
export default function VincularPromocaoDialog({ aberto, onFechar, mensagem }) {
  const [promoSelecionada, setPromoSelecionada] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: promocoesAtivas = [], isLoading } = useQuery({
    queryKey: ['promocoes-ativas-vincular'],
    queryFn: () => base44.entities.Promotion.filter({ ativo: true }, '-priority', 100),
    enabled: aberto,
    staleTime: 60 * 1000,
  });

  React.useEffect(() => {
    if (aberto) setPromoSelecionada(null);
  }, [aberto]);

  const vincularExistente = async () => {
    if (!promoSelecionada || !mensagem?.id) return;
    setSalvando(true);
    try {
      const promo = promocoesAtivas.find(p => p.id === promoSelecionada);
      const categoriasAtuais = Array.isArray(mensagem.categorias) ? mensagem.categorias : [];
      const novasCategorias = categoriasAtuais.includes('promocao')
        ? categoriasAtuais
        : [...categoriasAtuais, 'promocao'];

      await base44.entities.Message.update(mensagem.id, {
        categorias: novasCategorias,
        metadata: {
          ...(mensagem.metadata || {}),
          promotion_id: promoSelecionada,
          promotion_titulo: promo?.titulo || null,
          promotion_vinculada_em: new Date().toISOString(),
        }
      });

      // Incrementa contador de envios da promoção (auditoria leve)
      if (promo) {
        await base44.entities.Promotion.update(promoSelecionada, {
          contador_envios: (promo.contador_envios || 0) + 1
        }).catch(() => {});
      }

      toast.success(`✅ Mensagem vinculada à promoção: ${promo?.titulo || ''}`);
      if (mensagem.thread_id) {
        queryClient.invalidateQueries({ queryKey: ['mensagens', mensagem.thread_id] });
      }
      onFechar();
    } catch (error) {
      console.error('[VincularPromocao] Erro:', error);
      toast.error(`Erro ao vincular: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(open) => { if (!salvando && !open) onFechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            Vincular à Promoção
          </DialogTitle>
          <DialogDescription className="text-xs">
            Selecione uma promoção ativa para vincular a esta mensagem
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-80 border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            </div>
          ) : promocoesAtivas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
              <Sparkles className="w-10 h-10 mb-2 text-slate-300" />
              <p className="text-sm font-medium">Nenhuma promoção ativa</p>
              <p className="text-xs mt-1">Cadastre promoções na aba Automação</p>
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {promocoesAtivas.map(promo => {
                const sel = promoSelecionada === promo.id;
                return (
                  <button
                    key={promo.id}
                    onClick={() => setPromoSelecionada(promo.id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-2.5 rounded-lg border-2 transition-all text-left",
                      sel ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-orange-300 bg-white"
                    )}
                  >
                    <div className="w-12 h-12 rounded-md bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {promo.imagem_url ? (
                        <img src={promo.imagem_url} alt={promo.titulo} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{promo.titulo}</p>
                      {promo.descricao_curta && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">{promo.descricao_curta}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {promo.categoria && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{promo.categoria}</Badge>
                        )}
                        {promo.contador_envios > 0 && (
                          <span className="text-[9px] text-slate-400">{promo.contador_envios} envios</span>
                        )}
                      </div>
                    </div>
                    {sel && (
                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" size="sm" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={vincularExistente}
            disabled={!promoSelecionada || salvando}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4 mr-1" /> Vincular</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}