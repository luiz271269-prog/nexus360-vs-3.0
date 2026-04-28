import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2, Loader2, Image as ImageIcon, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Dialog para vincular uma mensagem a uma Promotion existente.
 *
 * Visual idêntico ao painel "Promoções Ativas" (cards grandes com imagem,
 * badges Com Imagem / categoria / preço / validade).
 *
 * Estratégia "Vincular B": lista Promotions ativas → seleciona → salva
 * promotion_id em Message.metadata. Sem duplicação — Promotion é a fonte única.
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
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header laranja igual ao painel "Promoções Ativas" */}
        <DialogHeader className="px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 space-y-0.5">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5" />
            Vincular à Promoção
          </DialogTitle>
          <DialogDescription className="text-xs text-white/90">
            Selecione uma promoção ativa para vincular a esta mensagem
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[480px]">
          <div className="p-3">
            {isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
                <p className="text-sm text-slate-600">Carregando promoções...</p>
              </div>
            ) : promocoesAtivas.length === 0 ? (
              <div className="py-12 text-center">
                <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">Nenhuma promoção ativa</p>
                <p className="text-xs text-slate-400 mt-1">Crie promoções na aba Automação</p>
              </div>
            ) : (
              <div className="space-y-3">
                {promocoesAtivas.map(promo => {
                  const isSelected = promoSelecionada === promo.id;
                  return (
                    <button
                      key={promo.id}
                      onClick={() => setPromoSelecionada(promo.id)}
                      className={`w-full text-left rounded-xl border-2 transition-all group overflow-hidden ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 shadow-lg'
                          : 'border-slate-200 hover:border-orange-400 hover:shadow-lg bg-white'
                      }`}
                    >
                      {/* Imagem grande */}
                      {promo.imagem_url ? (
                        <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
                          <img
                            src={promo.imagem_url}
                            alt={promo.titulo}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-3 right-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-lg ${
                              isSelected ? 'bg-orange-500' : 'bg-white/90 group-hover:bg-white'
                            }`}>
                              {isSelected ? (
                                <CheckCircle2 className="w-5 h-5 text-white" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-slate-400" />
                              )}
                            </div>
                          </div>
                          {isSelected && <div className="absolute inset-0 bg-orange-500/20" />}
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

                      {/* Info + badges */}
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
                          {promo.imagem_url && (
                            <Badge className="text-xs bg-green-500 text-white">✓ Com Imagem</Badge>
                          )}
                          {promo.categoria && (
                            <Badge variant="outline" className="text-xs">{promo.categoria}</Badge>
                          )}
                          {promo.price_info && (
                            <Badge className="text-xs bg-blue-500 text-white">{promo.price_info}</Badge>
                          )}
                          {promo.validade && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              Até {new Date(promo.validade).toLocaleDateString('pt-BR')}
                            </Badge>
                          )}
                          {promo.contador_envios > 0 && (
                            <span className="text-[10px] text-slate-400">{promo.contador_envios} envios</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-200 gap-2 flex-row justify-end">
          <Button variant="outline" size="sm" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={vincularExistente}
            disabled={!promoSelecionada || salvando}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4 mr-1" /> Vincular</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}