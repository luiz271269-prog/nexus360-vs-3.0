import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { instagramPublicarCarrossel } from '@/functions/instagramPublicarCarrossel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Instagram, Loader2, Send, ExternalLink, ImageOff, Search, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InstagramPublicacao() {
  const [selecionados, setSelecionados] = useState([]);
  const [legenda, setLegenda] = useState('');
  const [busca, setBusca] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['produtos-instagram'],
    queryFn: () => base44.entities.Produto.filter({ ativo: true }, '-updated_date', 200),
    refetchOnWindowFocus: false
  });

  const produtosComImagem = produtos.filter(p => p.imagem_url);
  const produtosFiltrados = produtosComImagem.filter(p =>
    !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.marca?.toLowerCase().includes(busca.toLowerCase())
  );

  const toggleProduto = (id) => {
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
    const itens = produtosComImagem.filter(p => selecionados.includes(p.id));
    const linhas = itens.map(p => {
      const preco = p.preco_venda ? ` — R$ ${Number(p.preco_venda).toFixed(2)}` : '';
      return `✅ ${p.nome}${preco}`;
    });
    setLegenda(`🔥 Ofertas NeuralTec Distribuição\n\n${linhas.join('\n')}\n\n📲 Chama no direct ou WhatsApp!\n#neuraltec #tecnologia #ofertas`);
  };

  const publicar = async () => {
    if (selecionados.length === 0) {
      toast.error('Selecione ao menos 1 produto');
      return;
    }
    setPublicando(true);
    setResultado(null);
    try {
      const res = await instagramPublicarCarrossel({
        produto_ids: selecionados,
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
          <p className="text-sm text-slate-500">Carrossel de produtos do CRM → @neuraltec.distribuicao</p>
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
        {/* Seleção de produtos */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base">
                Produtos com imagem
                <Badge className="ml-2 bg-pink-100 text-pink-800">{selecionados.length}/10 selecionados</Badge>
              </CardTitle>
              <div className="relative w-56">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto..."
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <ImageOff className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Nenhum produto ativo com imagem encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                {produtosFiltrados.map((p) => {
                  const sel = selecionados.includes(p.id);
                  const ordem = selecionados.indexOf(p.id) + 1;
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleProduto(p.id)}
                      className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${
                        sel ? 'border-pink-500 ring-2 ring-pink-200' : 'border-slate-200 hover:border-pink-300'
                      }`}
                    >
                      <img src={p.imagem_url} alt={p.nome} className="w-full h-28 object-cover bg-slate-100" loading="lazy" />
                      {sel && (
                        <span className="absolute top-1.5 right-1.5 w-6 h-6 bg-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
                          {ordem}
                        </span>
                      )}
                      <div className="p-2">
                        <p className="text-xs font-medium text-slate-800 line-clamp-2">{p.nome}</p>
                        {p.preco_venda && (
                          <p className="text-xs text-pink-600 font-semibold mt-0.5">R$ {Number(p.preco_venda).toFixed(2)}</p>
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
              placeholder="Escreva a legenda ou gere automaticamente a partir dos produtos selecionados..."
              className="h-48 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={gerarLegenda}
              disabled={selecionados.length === 0}
              className="w-full"
            >
              ✨ Gerar legenda dos produtos
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