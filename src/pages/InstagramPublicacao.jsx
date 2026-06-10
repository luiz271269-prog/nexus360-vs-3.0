import React, { useState } from 'react';
import { usePromocoesUnificadas } from '@/components/hooks/usePromocoesUnificadas';
import { instagramPublicarCarrossel } from '@/functions/instagramPublicarCarrossel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Instagram, Loader2, Send, ExternalLink, ImageOff, Search, CheckCircle2, Tag, Megaphone } from 'lucide-react';
import { toast } from 'sonner';

export default function InstagramPublicacao() {
  const [selecionados, setSelecionados] = useState([]);
  const [legenda, setLegenda] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('todas'); // todas | promotion | mensagem
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const { data: promocoes = [], isLoading } = usePromocoesUnificadas({
    apenasAtivas: true,
    incluirEtiquetadas: true
  });

  // Apenas itens com imagem publicável
  const comImagem = promocoes.filter(p => p.imagem_url);

  const filtradas = comImagem.filter(p => {
    if (filtroOrigem !== 'todas' && p._origem !== filtroOrigem) return false;
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return p.titulo?.toLowerCase().includes(termo) || p.descricao?.toLowerCase().includes(termo);
  });

  const itensSelecionados = comImagem.filter(p => selecionados.includes(p.id));

  const toggleItem = (id) => {
    setSelecionados(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 10) {
        toast.error('Máximo de 10 imagens por carrossel');
        return prev;
      }
      return [...prev, id];
    });
  };

  const gerarLegenda = () => {
    const linhas = itensSelecionados.map(p => {
      const preco = p.price_info ? ` — ${p.price_info}` : '';
      return `✅ ${p.titulo}${preco}`;
    });
    setLegenda(`🔥 Ofertas NeuralTec Distribuição\n\n${linhas.join('\n')}\n\n📲 Chama no direct ou WhatsApp!\n#neuraltec #tecnologia #ofertas`);
  };

  const publicar = async () => {
    if (itensSelecionados.length === 0) {
      toast.error('Selecione ao menos 1 promoção');
      return;
    }
    setPublicando(true);
    setResultado(null);
    try {
      const res = await instagramPublicarCarrossel({
        image_urls: itensSelecionados.map(p => p.imagem_url),
        caption: legenda
      });
      if (res.data?.success) {
        setResultado(res.data);
        toast.success(`✅ Publicado no @${res.data.username}!`);
        setSelecionados([]);
        setLegenda('');
      } else {
        toast.error(res.data?.error || 'Erro ao publicar');
      }
    } catch (error) {
      const msg = error?.response?.data?.error || error.message;
      toast.error(`Erro: ${msg}`);
    } finally {
      setPublicando(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
          <Instagram className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Publicar no Instagram</h1>
          <p className="text-sm text-slate-500">Promoções e etiquetadas → @neuraltec.distribuicao</p>
        </div>
      </div>

      {resultado && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 flex items-center gap-2 flex-wrap">
            Publicado com sucesso ({resultado.total_imagens} {resultado.total_imagens > 1 ? 'imagens' : 'imagem'})!
            {resultado.permalink && (
              <a href={resultado.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
                Ver publicação <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Seleção de promoções */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">
                Promoções com imagem
                <Badge className="ml-2 bg-pink-100 text-pink-800">{selecionados.length}/10 selecionadas</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {[
                    { v: 'todas', label: 'Todas' },
                    { v: 'promotion', label: '📢 Oficiais' },
                    { v: 'mensagem', label: '🏷️ Etiquetadas' }
                  ].map(f => (
                    <button
                      key={f.v}
                      onClick={() => setFiltroOrigem(f.v)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        filtroOrigem === f.v ? 'bg-pink-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-44">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar..."
                    className="pl-8 h-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
              </div>
            ) : filtradas.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <ImageOff className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Nenhuma promoção ativa com imagem encontrada</p>
                <p className="text-xs text-slate-400 mt-1">Crie promoções na tela de Produtos ou etiquete mensagens como "promoção"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                {filtradas.map((p) => {
                  const sel = selecionados.includes(p.id);
                  const ordem = selecionados.indexOf(p.id) + 1;
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleItem(p.id)}
                      className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${
                        sel ? 'border-pink-500 ring-2 ring-pink-200' : 'border-slate-200 hover:border-pink-300'
                      }`}
                    >
                      <img src={p.imagem_url} alt={p.titulo} className="w-full h-28 object-cover bg-slate-100" loading="lazy" />
                      {sel && (
                        <span className="absolute top-1.5 right-1.5 w-6 h-6 bg-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
                          {ordem}
                        </span>
                      )}
                      <span className="absolute top-1.5 left-1.5">
                        {p._origem === 'promotion' ? (
                          <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0 h-5">
                            <Megaphone className="w-2.5 h-2.5 mr-0.5" /> Oficial
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 h-5">
                            <Tag className="w-2.5 h-2.5 mr-0.5" /> Etiquetada
                          </Badge>
                        )}
                      </span>
                      <div className="p-2">
                        <p className="text-xs font-medium text-slate-800 line-clamp-2">{p.titulo}</p>
                        {p.price_info && (
                          <p className="text-xs text-pink-600 font-semibold mt-0.5">{p.price_info}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legenda e publicação */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Legenda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Escreva a legenda ou gere automaticamente a partir das promoções selecionadas..."
              className="h-48 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={gerarLegenda}
              disabled={selecionados.length === 0}
              className="w-full"
            >
              ✨ Gerar legenda das promoções
            </Button>
            <Button
              onClick={publicar}
              disabled={publicando || selecionados.length === 0}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            >
              {publicando ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publicando...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Publicar {selecionados.length > 1 ? `carrossel (${selecionados.length})` : 'post'}</>
              )}
            </Button>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              As imagens precisam ser JPEG públicas. Carrossel: 2 a 10 imagens. A publicação leva ~30s para processar.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}