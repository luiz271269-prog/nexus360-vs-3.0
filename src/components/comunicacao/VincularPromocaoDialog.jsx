import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, Check, Loader2, Image as ImageIcon, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * Dialog para vincular uma mensagem a uma Promotion existente
 * OU criar uma nova Promotion a partir da própria mensagem.
 *
 * Estratégia "híbrida B + atalho":
 *  - Aba "Vincular": lista Promotions ativas → seleciona → salva promotion_id em Message.metadata
 *  - Aba "Criar nova": form rápido (título + descrição + imagem da msg) → cria Promotion + vincula
 *
 * Sem duplicação de dados: Promotion é sempre a fonte única.
 */
export default function VincularPromocaoDialog({ aberto, onFechar, mensagem, contato }) {
  const [aba, setAba] = React.useState('vincular'); // 'vincular' | 'criar'
  const [promoSelecionada, setPromoSelecionada] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);

  // Form de criação
  const [novoTitulo, setNovoTitulo] = React.useState('');
  const [novaDescricao, setNovaDescricao] = React.useState('');

  const queryClient = useQueryClient();

  const { data: promocoesAtivas = [], isLoading } = useQuery({
    queryKey: ['promocoes-ativas-vincular'],
    queryFn: () => base44.entities.Promotion.filter({ ativo: true }, '-priority', 100),
    enabled: aberto,
    staleTime: 60 * 1000,
  });

  // Pré-preencher form de criação com dados da mensagem ao abrir
  React.useEffect(() => {
    if (aberto && mensagem) {
      setAba('vincular');
      setPromoSelecionada(null);
      const conteudo = String(mensagem.content || mensagem.media_caption || '').trim();
      const primeiraLinha = conteudo.split('\n')[0]?.substring(0, 80) || 'Promoção sem título';
      setNovoTitulo(primeiraLinha);
      setNovaDescricao(conteudo);
    }
  }, [aberto, mensagem]);

  const temImagem = mensagem?.media_type === 'image' && mensagem?.media_url;

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
        }).catch(() => {}); // não bloquear se falhar
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

  const criarEVincular = async () => {
    if (!novoTitulo.trim() || !mensagem?.id) {
      toast.error('Informe um título para a promoção');
      return;
    }
    setSalvando(true);
    try {
      // Cria nova Promotion a partir da mensagem
      const novaPromo = await base44.entities.Promotion.create({
        titulo: novoTitulo.trim(),
        descricao: novaDescricao.trim() || novoTitulo.trim(),
        descricao_curta: novoTitulo.trim().substring(0, 120),
        imagem_url: temImagem ? mensagem.media_url : undefined,
        tipo_midia: temImagem ? 'image' : 'none',
        stage: '6h',
        ativo: true,
        categoria: 'geral',
        formato: 'direct',
        target_contact_types: ['lead', 'cliente'],
        target_sectors: ['vendas', 'geral'],
        contador_envios: 1, // já está sendo enviada nesta mensagem
      });

      // Vincula a mensagem à promoção criada
      const categoriasAtuais = Array.isArray(mensagem.categorias) ? mensagem.categorias : [];
      const novasCategorias = categoriasAtuais.includes('promocao')
        ? categoriasAtuais
        : [...categoriasAtuais, 'promocao'];

      await base44.entities.Message.update(mensagem.id, {
        categorias: novasCategorias,
        metadata: {
          ...(mensagem.metadata || {}),
          promotion_id: novaPromo.id,
          promotion_titulo: novaPromo.titulo,
          promotion_vinculada_em: new Date().toISOString(),
          promotion_criada_da_mensagem: true,
        }
      });

      toast.success(`🎯 Promoção criada e vinculada: ${novaPromo.titulo}`);
      queryClient.invalidateQueries({ queryKey: ['promocoes-ativas-vincular'] });
      queryClient.invalidateQueries({ queryKey: ['promocoes-ativas'] });
      if (mensagem.thread_id) {
        queryClient.invalidateQueries({ queryKey: ['mensagens', mensagem.thread_id] });
      }
      onFechar();
    } catch (error) {
      console.error('[VincularPromocao] Erro ao criar:', error);
      toast.error(`Erro ao criar promoção: ${error.message}`);
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
            Etiquetar como Promoção
          </DialogTitle>
          <DialogDescription className="text-xs">
            Vincule esta mensagem a uma promoção existente ou crie uma nova
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setAba('vincular')}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              aba === 'vincular' ? "bg-white text-orange-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Link2 className="w-3.5 h-3.5" />
            Vincular existente
          </button>
          <button
            onClick={() => setAba('criar')}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              aba === 'criar' ? "bg-white text-orange-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Criar nova
          </button>
        </div>

        {/* Conteúdo aba Vincular */}
        {aba === 'vincular' && (
          <div>
            <ScrollArea className="h-72 border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                </div>
              ) : promocoesAtivas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
                  <Sparkles className="w-10 h-10 mb-2 text-slate-300" />
                  <p className="text-sm font-medium">Nenhuma promoção ativa</p>
                  <p className="text-xs mt-1">Use a aba "Criar nova" ao lado</p>
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
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-md bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {promo.imagem_url ? (
                            <img src={promo.imagem_url} alt={promo.titulo} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        {/* Info */}
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
          </div>
        )}

        {/* Conteúdo aba Criar */}
        {aba === 'criar' && (
          <div className="space-y-3">
            {temImagem && (
              <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                <img src={mensagem.media_url} alt="Preview" className="w-12 h-12 rounded object-cover" />
                <div className="flex-1 text-xs text-orange-700">
                  <p className="font-medium">📷 Imagem da mensagem será usada</p>
                  <p className="text-[10px] text-orange-600">A promoção criada herdará esta imagem</p>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Título da Promoção</label>
              <Input
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                placeholder="Ex: Promoção TVs Samsung"
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Descrição</label>
              <Textarea
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Descrição da promoção..."
                rows={4}
                className="text-xs"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              💡 A promoção criada ficará ativa e disponível no painel "Promoções Ativas"
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" size="sm" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          {aba === 'vincular' ? (
            <Button
              size="sm"
              onClick={vincularExistente}
              disabled={!promoSelecionada || salvando}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4 mr-1" /> Vincular</>}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={criarEVincular}
              disabled={!novoTitulo.trim() || salvando}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-1" /> Criar e vincular</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}