import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Users, X, Upload, Image, Music, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function ModalEnvioMassa({ isOpen, onClose, contatosSelecionados, onEnvioCompleto }) {
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [media, setMedia] = useState(null);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [carregandoMedia, setCarregandoMedia] = useState(false);

  const handleUploadMedia = async (file) => {
    if (!file) return;

    setCarregandoMedia(true);
    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      setMediaUrl(uploadResult.file_url);
      setMedia(file);
      toast.success('✅ Mídia carregada!');
    } catch (error) {
      console.error('[ModalEnvioMassa] Erro ao upload:', error);
      toast.error('❌ Erro ao carregar mídia');
    } finally {
      setCarregandoMedia(false);
    }
  };

  const getMediaType = (file) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
  };

  const handleEnviar = async () => {
    if (!mensagem.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }

    if (!contatosSelecionados.length) {
      toast.error('Nenhum contato selecionado');
      return;
    }

    setEnviando(true);

    try {
      toast.loading(`📤 Enviando para ${contatosSelecionados.length} contatos...`, { id: 'envio-massa' });

      const resultado = await base44.functions.invoke('enviarMensagemMassa', {
        contact_ids: contatosSelecionados.map(c => c.contact_id || c.id),
        mensagem,
        personalizar: true,
        media_url: mediaUrl,
        media_type: media ? getMediaType(media) : 'none',
        media_caption: mediaCaption || null
      });

      if (resultado.data?.success) {
        toast.success(
          `✅ ${resultado.data.enviados} enviada(s)!` +
          (resultado.data.erros > 0 ? `\n⚠️ ${resultado.data.erros} erro(s)` : ''),
          { id: 'envio-massa', duration: 5000 }
        );

        if (resultado.data.enviados > 0) {
          setMensagem('');
          setMediaCaption('');
          onClose();
          if (onEnvioCompleto) onEnvioCompleto();
        }
      } else {
        throw new Error(resultado.data?.error || 'Erro ao enviar');
      }

    } catch (error) {
      console.error('[ModalEnvioMassa] Erro:', error);
      toast.error(`❌ ${error.message}`, { id: 'envio-massa' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Envio em Massa
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-blue-600 text-white">
              {contatosSelecionados.length} contato(s) selecionado(s)
            </Badge>
          </div>
        </DialogHeader>

        {/* Lista de contatos selecionados (preview) */}
        <div className="max-h-32 overflow-y-auto border rounded-lg p-3 bg-slate-50">
          <div className="flex flex-wrap gap-1.5">
            {contatosSelecionados.slice(0, 10).map((c) => (
              <Badge key={c.contact_id || c.id} variant="outline" className="text-xs">
                {c.nome || c.empresa}
              </Badge>
            ))}
            {contatosSelecionados.length > 10 && (
              <Badge variant="outline" className="text-xs bg-slate-200">
                +{contatosSelecionados.length - 10} mais
              </Badge>
            )}
          </div>
        </div>

        {/* Campo de mensagem */}
         <div className="space-y-2">
           <Label htmlFor="mensagem">Mensagem *</Label>
           <Textarea
             id="mensagem"
             value={mensagem}
             onChange={(e) => setMensagem(e.target.value)}
             placeholder="Digite sua mensagem aqui...&#10;&#10;Use {{nome}} e {{empresa}} para personalizar.&#10;&#10;Ex: Olá {{nome}}! Temos novidades para você..."
             rows={6}
             className="resize-none"
           />
           <p className="text-xs text-slate-500">
             💡 Placeholders disponíveis: <code className="bg-slate-100 px-1 rounded">{'{{nome}}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{{empresa}}'}</code>
           </p>
           <p className="text-xs text-slate-600">
             {mensagem.length} caracteres
           </p>
         </div>

         {/* Seção de Mídia */}
           <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
             <Label>Mídia (opcional)</Label>
             {mediaUrl && (
               <div className="space-y-1">
                 <Label htmlFor="caption" className="text-xs">Legenda da mídia (opcional)</Label>
                 <textarea
                   id="caption"
                   value={mediaCaption}
                   onChange={(e) => setMediaCaption(e.target.value)}
                   placeholder="Adicione uma descrição para a imagem/vídeo..."
                   rows={2}
                   className="w-full p-2 text-xs border border-slate-300 rounded resize-none"
                 />
               </div>
             )}

           {!mediaUrl ? (
             <div className="flex items-center gap-2">
               <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors">
                 <Upload className="w-4 h-4 text-slate-600" />
                 <span className="text-sm text-slate-600">Clique para adicionar imagem, áudio ou vídeo</span>
                 <input
                   type="file"
                   accept="image/*,audio/*,video/*"
                   onChange={(e) => {
                     if (e.target.files?.[0]) {
                       handleUploadMedia(e.target.files[0]);
                     }
                   }}
                   disabled={carregandoMedia}
                   className="hidden"
                 />
               </label>
               {carregandoMedia && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
             </div>
           ) : (
             <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
               <div>
                 {media?.type.startsWith('image/') && <Image className="w-5 h-5 text-green-600" />}
                 {media?.type.startsWith('audio/') && <Music className="w-5 h-5 text-green-600" />}
                 {media?.type.startsWith('video/') && <FileText className="w-5 h-5 text-green-600" />}
               </div>
               <div className="flex-1 min-w-0">
                 <p className="text-sm font-medium text-slate-700 truncate">{media?.name}</p>
                 <p className="text-xs text-slate-500">{(media?.size / 1024 / 1024).toFixed(2)} MB</p>
               </div>
               <Button
                 size="icon"
                 variant="ghost"
                 onClick={() => {
                   setMedia(null);
                   setMediaUrl(null);
                   toast.success('Mídia removida');
                 }}
                 className="flex-shrink-0">
                 <Trash2 className="w-4 h-4 text-red-600" />
               </Button>
             </div>
           )}
         </div>

        {/* Preview da mensagem personalizada */}
        {mensagem && contatosSelecionados.length > 0 && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs font-semibold text-green-800 mb-1">
              📝 Preview (primeiro contato):
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {mensagem
                .replace(/\{\{nome\}\}/gi, contatosSelecionados[0].nome || 'Cliente')
                .replace(/\{\{empresa\}\}/gi, contatosSelecionados[0].empresa || '')}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleEnviar}
            disabled={enviando || !mensagem.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {enviando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar para {contatosSelecionados.length}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}