import React, { useState } from 'react';
import { usePromocoesUnificadas } from '@/components/hooks/usePromocoesUnificadas';
import PainelTextosSociais from '@/components/automacao/PainelTextosSociais';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessagesSquare, Loader2, Search, ImageOff, Tag, Megaphone, MousePointerClick } from 'lucide-react';

/**
 * Tela de conversação para gerar os textos sociais (Instagram, Facebook e
 * roteiro de áudio) a partir de um anúncio já pronto. O usuário escolhe o
 * anúncio na lista da esquerda e gera/edita/regenera os textos à direita.
 */
export default function TextosSociais() {
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState(null);

  const { data: promocoes = [], isLoading } = usePromocoesUnificadas({
    apenasAtivas: true,
    incluirEtiquetadas: true
  });

  const filtradas = promocoes.filter(p => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return p.titulo?.toLowerCase().includes(termo) || p.descricao?.toLowerCase().includes(termo);
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
          <MessagesSquare className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Textos para Publicação</h1>
          <p className="text-sm text-slate-500">Escolha um anúncio e gere os textos de Instagram, Facebook e áudio com IA</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Lista de anúncios prontos */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Anúncios</CardTitle>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar anúncio..."
                className="pl-8 h-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : filtradas.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <ImageOff className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Nenhum anúncio encontrado</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                {filtradas.map((p) => {
                  const sel = selecionado?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelecionado(p)}
                      className={`w-full text-left rounded-xl border-2 p-2.5 flex gap-3 items-center transition-all ${
                        sel ? 'border-purple-500 ring-2 ring-purple-200 bg-purple-50/50' : 'border-slate-200 hover:border-purple-300'
                      }`}
                    >
                      {p.imagem_url ? (
                        <img src={p.imagem_url} alt={p.titulo} className="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0" loading="lazy" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <ImageOff className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 line-clamp-2">{p.titulo}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {p._origem === 'promotion' ? (
                            <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0 h-4">
                              <Megaphone className="w-2.5 h-2.5 mr-0.5" /> Oficial
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 h-4">
                              <Tag className="w-2.5 h-2.5 mr-0.5" /> Etiquetada
                            </Badge>
                          )}
                          {p.price_info && <span className="text-[11px] text-pink-600 font-semibold truncate">{p.price_info}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Painel de geração */}
        <div className="lg:col-span-2">
          {selecionado ? (
            <PainelTextosSociais anuncio={selecionado} key={selecionado.id} />
          ) : (
            <Card className="h-full">
              <CardContent className="py-20 text-center text-slate-400">
                <MousePointerClick className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">Escolha um anúncio à esquerda</p>
                <p className="text-xs mt-1">Os textos de Instagram, Facebook e áudio aparecem aqui para você gerar e editar</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}