import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ExternalLink,
  Phone,
  Download,
  FileText,
  MapPin
} from 'lucide-react';

/**
 * Componente para renderizar mensagens com mídia rica
 * Suporta: imagens, vídeos, documentos, botões, carrosséis, localização
 */
export default function MediaRichMessage({ message }) {
  const { media_type, media_url, metadata } = message;

  // Botões interativos
  if (metadata?.buttons && metadata.buttons.length > 0) {
    return (
      <div className="space-y-3">
        {message.content && (
          <p className="text-sm leading-relaxed">{message.content}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {metadata.buttons.map((button, index) => (
            <Button
              key={index}
              variant={button.type === 'QUICK_REPLY' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleButtonClick(button)}
              className="text-xs"
            >
              {button.type === 'PHONE_NUMBER' && <Phone className="w-3 h-3 mr-1" />}
              {button.type === 'URL' && <ExternalLink className="w-3 h-3 mr-1" />}
              {button.text}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Lista de produtos (carrossel)
  if (metadata?.produtos && metadata.produtos.length > 0) {
    return (
      <div className="space-y-2">
        {message.content && (
          <p className="text-sm leading-relaxed mb-3">{message.content}</p>
        )}
        <div className="grid grid-cols-1 gap-2 max-w-sm">
          {metadata.produtos.map((produto, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  {produto.imagem_url && (
                    <img
                      src={produto.imagem_url}
                      alt={produto.nome}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{produto.nome}</h4>
                    <p className="text-xs text-slate-600 line-clamp-2">{produto.descricao}</p>
                    {produto.preco_venda && (
                      <p className="text-sm font-bold text-green-600 mt-1">
                        R$ {produto.preco_venda.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Mídia padrão
  switch (media_type) {
    case 'image':
      return (
        <div className="space-y-2">
          {message.content && (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
          <img
            src={media_url}
            alt="Imagem compartilhada"
            className="max-w-sm rounded-lg cursor-pointer hover:opacity-90 transition"
            onClick={() => window.open(media_url, '_blank')}
          />
        </div>
      );

    case 'video':
      return (
        <div className="space-y-2">
          {message.content && (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
          <video
            src={media_url}
            controls
            className="max-w-sm rounded-lg"
          />
        </div>
      );

    case 'audio':
      return (
        <div className="space-y-2">
          {message.content && (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
          <audio
            src={media_url}
            controls
            className="w-full max-w-sm"
          />
        </div>
      );

    case 'document':
      return (
        <div className="space-y-2">
          {message.content && (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
          <a
            href={media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition text-sm"
          >
            <FileText className="w-5 h-5" />
            <span className="flex-1">Documento compartilhado</span>
            <Download className="w-4 h-4" />
          </a>
        </div>
      );

    case 'location':
      return (
        <div className="space-y-2">
          {message.content && (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
          <div className="flex items-center gap-2 p-3 bg-white/10 rounded-lg">
            <MapPin className="w-5 h-5 text-red-500" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Localização compartilhada</p>
              {metadata?.latitude && metadata?.longitude && (
                <p className="text-xs text-slate-600">
                  {metadata.latitude}, {metadata.longitude}
                </p>
              )}
            </div>
            {metadata?.latitude && metadata?.longitude && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`https://www.google.com/maps?q=${metadata.latitude},${metadata.longitude}`, '_blank')}
              >
                Abrir no Maps
              </Button>
            )}
          </div>
        </div>
      );

    default:
      return <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>;
  }
}

function handleButtonClick(button) {
  switch (button.type) {
    case 'URL':
      window.open(button.url, '_blank');
      break;
    case 'PHONE_NUMBER':
      window.location.href = `tel:${button.phone_number}`;
      break;
    case 'QUICK_REPLY':
      // Será implementado para enviar a resposta automaticamente
      console.log('Quick reply:', button.text);
      break;
  }
}