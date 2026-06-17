import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { X, MapPin, Loader2, Send, QrCode, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * PixDialog — gera o Pix copia-e-cola + QR Code e envia direto na conversa.
 * Reusa o backend enviarPixChat (mesma lógica validada do menu de Acessos Rápidos).
 */
export function PixDialog({ thread, integrationId, onClose, onSent }) {
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!thread?.contact_id) { toast.error('Conversa sem contato'); return; }
    setEnviando(true);
    try {
      const res = await base44.functions.invoke('enviarPixChat', {
        thread_id: thread.id,
        contact_id: thread.contact_id,
        integration_id: integrationId || thread.whatsapp_integration_id || null
      });
      if (res?.data?.success) {
        toast.success('✅ Pix enviado (chave + copia e cola + QR Code)');
        onSent?.();
        onClose();
      } else {
        throw new Error(res?.data?.error || 'Falha ao enviar Pix');
      }
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-600">
          <div className="flex items-center gap-2 text-white">
            <QrCode className="w-5 h-5" />
            <span className="font-semibold text-sm">Enviar Pix</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-600">
            Será enviado ao cliente: a <strong>chave Pix (CNPJ)</strong>, o <strong>copia e cola</strong> e o <strong>QR Code</strong> para pagamento.
          </p>
          <Button onClick={enviar} disabled={enviando} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : <><Send className="w-4 h-4 mr-2" /> Enviar Pix</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * LocalizacaoDialog — envia uma localização como link do Google Maps.
 * Opções: usar localização atual (GPS) ou colar um link/coordenadas.
 */
export function LocalizacaoDialog({ thread, integrationId, onClose }) {
  const [enviando, setEnviando] = useState(false);
  const [link, setLink] = useState('');

  const enviarTexto = async (mapsUrl) => {
    if (!thread?.contact_id) { toast.error('Conversa sem contato'); return; }
    setEnviando(true);
    try {
      const res = await base44.functions.invoke('enviarLocalizacaoChat', {
        thread_id: thread.id,
        contact_id: thread.contact_id,
        integration_id: integrationId || thread.whatsapp_integration_id || null,
        maps_url: mapsUrl
      });
      if (res?.data?.success) {
        toast.success('✅ Localização enviada');
        onClose();
      } else {
        throw new Error(res?.data?.error || 'Falha ao enviar localização');
      }
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const usarLocalizacaoAtual = () => {
    if (!navigator.geolocation) { toast.error('GPS não disponível neste dispositivo'); return; }
    setEnviando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        enviarTexto(mapsUrl);
      },
      (err) => {
        setEnviando(false);
        toast.error('Não foi possível obter a localização: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const enviarLink = () => {
    const val = link.trim();
    if (!val) { toast.error('Cole um link ou coordenadas'); return; }
    // Se for coordenadas "lat,lng", monta link do maps; senão usa o link como veio
    const ehCoord = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(val);
    const mapsUrl = ehCoord ? `https://www.google.com/maps?q=${val.replace(/\s/g, '')}` : val;
    enviarTexto(mapsUrl);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-rose-500 to-red-600">
          <div className="flex items-center gap-2 text-white">
            <MapPin className="w-5 h-5" />
            <span className="font-semibold text-sm">Enviar Localização</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Button onClick={usarLocalizacaoAtual} disabled={enviando} className="w-full bg-rose-600 hover:bg-rose-700">
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crosshair className="w-4 h-4 mr-2" />}
            Usar minha localização atual
          </Button>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" /> ou <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="space-y-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link do Maps ou coordenadas (-27.59, -48.54)"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <Button onClick={enviarLink} disabled={enviando} variant="outline" className="w-full">
              <Send className="w-4 h-4 mr-2" /> Enviar localização
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}