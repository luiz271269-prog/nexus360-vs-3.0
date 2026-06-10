import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, Tag } from 'lucide-react';
import { usePromocoesUnificadas } from '@/components/hooks/usePromocoesUnificadas';
import BotaoPostarInstagram from '@/components/automacao/BotaoPostarInstagram';

/**
 * Visão COMBINADA das duas fontes de promoção num só lugar:
 *  - Promoções oficiais (Promotion)
 *  - Mensagens etiquetadas como "promocao"
 *
 * É a mesma fonte única que alimenta o botão de anexar na conversa,
 * exibida aqui de forma consolidada para visão geral.
 */
export default function VisaoCombinadaPromocoes() {
  const { data: itens = [], isLoading } = usePromocoesUnificadas({
    apenasAtivas: true,
    incluirEtiquetadas: true
  });

  const oficiais = itens.filter(i => i._origem === 'promotion');
  const etiquetadas = itens.filter(i => i._origem === 'mensagem');

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
        <p className="text-sm text-slate-600">Carregando promoções...</p>
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="py-16 text-center">
        <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-lg font-medium text-slate-600">Nenhuma promoção ativa</p>
        <p className="text-sm text-slate-400 mt-1">Crie promoções na aba Gestão ou etiquete mensagens como "promoção"</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo das fontes */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Total combinado</p>
            <p className="text-2xl font-bold text-slate-900">{itens.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">🎁 Oficiais</p>
            <p className="text-2xl font-bold text-orange-600">{oficiais.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">📨 Etiquetadas</p>
            <p className="text-2xl font-bold text-blue-600">{etiquetadas.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grade combinada */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {itens.map((item) => (
          <Card key={item.id} className={`overflow-hidden border-l-4 ${item._origem === 'mensagem' ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
            {item.imagem_url ? (
              <div className="w-full h-40 bg-slate-100 overflow-hidden">
                <img src={item.imagem_url} alt={item.titulo} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <span className="text-5xl">
                  {item._media_type === 'video' ? '🎥'
                    : item._media_type === 'audio' ? '🎤'
                    : item._media_type === 'document' ? '📄'
                    : '🖼️'}
                </span>
              </div>
            )}
            <CardContent className="p-3">
              <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{item.titulo}</h4>
              {item.descricao && (
                <p className="text-xs text-slate-600 line-clamp-2 mt-1">{item.descricao}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {item._origem === 'mensagem' ? (
                  <Badge className="text-xs bg-blue-500 text-white">📨 Etiquetada</Badge>
                ) : (
                  <Badge className="text-xs bg-orange-500 text-white">🎁 Oficial</Badge>
                )}
                {item.categoria && item._origem === 'promotion' && (
                  <Badge variant="outline" className="text-xs">{item.categoria}</Badge>
                )}
                {item.price_info && (
                  <Badge className="text-xs bg-green-500 text-white">{item.price_info}</Badge>
                )}
                {item.validade && (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                    Até {new Date(item.validade).toLocaleDateString('pt-BR')}
                  </Badge>
                )}
              </div>
              <BotaoPostarInstagram item={item} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}