import React, { useState } from 'react';
import { gerarTextosSociais } from '@/functions/gerarTextosSociais';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Instagram, Facebook, Mic, Loader2, RefreshCw, Copy, Check, Sparkles, ImageOff } from 'lucide-react';
import { toast } from 'sonner';

const CANAIS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, cor: 'from-pink-500 to-purple-600', badge: 'bg-pink-100 text-pink-800' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, cor: 'from-blue-600 to-indigo-700', badge: 'bg-blue-100 text-blue-800' },
  { key: 'audio', label: 'Roteiro de Áudio', icon: Mic, cor: 'from-amber-500 to-orange-600', badge: 'bg-amber-100 text-amber-800' }
];

/**
 * Painel conversacional para gerar/editar/regenerar os textos sociais
 * (Instagram, Facebook e roteiro de áudio) a partir de um anúncio já pronto.
 */
export default function PainelTextosSociais({ anuncio }) {
  const [textos, setTextos] = useState({ instagram: '', facebook: '', audio: '' });
  const [gerandoTudo, setGerandoTudo] = useState(false);
  const [gerandoCanal, setGerandoCanal] = useState(null); // 'instagram' | 'facebook' | 'audio'
  const [copiado, setCopiado] = useState(null);

  const temAlgumTexto = Object.values(textos).some(Boolean);

  const payloadBase = {
    titulo: anuncio.titulo,
    descricao: anuncio.descricao,
    price_info: anuncio.price_info,
    validade: anuncio.validade,
    imagem_url: anuncio.imagem_url || anuncio._media_url,
    tipo_midia: anuncio._media_type === 'video' || anuncio.tipo_midia === 'video' ? 'video' : 'imagem'
  };

  const gerarTudo = async () => {
    setGerandoTudo(true);
    try {
      const res = await gerarTextosSociais(payloadBase);
      if (res.data?.success) {
        setTextos(res.data.textos);
        toast.success('Textos gerados!');
      } else {
        toast.error(res.data?.error || 'Erro ao gerar textos');
      }
    } catch (error) {
      toast.error(`Erro: ${error?.response?.data?.error || error.message}`);
    } finally {
      setGerandoTudo(false);
    }
  };

  const regenerar = async (canal) => {
    setGerandoCanal(canal);
    try {
      const res = await gerarTextosSociais({ ...payloadBase, tipo: canal });
      if (res.data?.success) {
        setTextos(prev => ({ ...prev, [canal]: res.data.textos[canal] }));
        toast.success('Texto regenerado!');
      } else {
        toast.error(res.data?.error || 'Erro ao regenerar');
      }
    } catch (error) {
      toast.error(`Erro: ${error?.response?.data?.error || error.message}`);
    } finally {
      setGerandoCanal(null);
    }
  };

  const copiar = async (canal) => {
    try {
      await navigator.clipboard.writeText(textos[canal] || '');
      setCopiado(canal);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho do anúncio escolhido */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          {payloadBase.imagem_url ? (
            <img src={payloadBase.imagem_url} alt={anuncio.titulo} className="w-20 h-20 rounded-lg object-cover bg-slate-100 flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <ImageOff className="w-6 h-6 text-slate-300" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 line-clamp-2">{anuncio.titulo}</p>
            {anuncio.price_info && <p className="text-pink-600 font-semibold text-sm mt-0.5">{anuncio.price_info}</p>}
            {anuncio.descricao && <p className="text-xs text-slate-500 line-clamp-2 mt-1">{anuncio.descricao}</p>}
          </div>
          <Button
            onClick={gerarTudo}
            disabled={gerandoTudo}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 flex-shrink-0"
          >
            {gerandoTudo ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> {temAlgumTexto ? 'Gerar tudo de novo' : 'Gerar os 3 textos'}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Os 3 canais */}
      <div className="grid lg:grid-cols-3 gap-4">
        {CANAIS.map(({ key, label, icon: Icon, cor, badge }) => {
          const carregando = gerandoTudo || gerandoCanal === key;
          return (
            <Card key={key} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cor} flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-white" />
                    </span>
                    {label}
                  </CardTitle>
                  {textos[key] && <Badge className={badge}>{textos[key].length} car.</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-2">
                <Textarea
                  value={textos[key]}
                  onChange={(e) => setTextos(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={carregando ? 'Gerando...' : `Clique em "Gerar os 3 textos" ou regenere só o ${label}`}
                  className="flex-1 min-h-[220px] text-sm font-mono leading-relaxed"
                  disabled={carregando}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerar(key)}
                    disabled={carregando}
                    className="flex-1"
                  >
                    {gerandoCanal === key ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Regenerar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copiar(key)}
                    disabled={!textos[key]}
                  >
                    {copiado === key ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}