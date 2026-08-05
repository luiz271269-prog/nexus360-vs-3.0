import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { Sticker as StickerIcon, Plus, Loader2, Clock, User, Users, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  imagemParaStickerWebp,
  urlParaStickerFile,
  lerRecentes,
  registrarRecente,
  LIMITE_PESSOAL,
  LIMITE_EQUIPE } from
'./stickerUtils';

const ABAS = [
  { key: 'recentes', label: 'Recentes', icon: Clock },
  { key: 'pessoal', label: 'Minhas', icon: User },
  { key: 'equipe', label: 'Equipe', icon: Users }];

export default function StickerPickerButton({ onSendSticker, usuario, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [aba, setAba] = useState('recentes');
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const [stickers, setStickers] = useState([]);
  const [recentes, setRecentes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [criando, setCriando] = useState(false);
  const buttonRef = useRef(null);
  const fileRef = useRef(null);
  const carregadoRef = useRef(false);

  // Carrega uma única vez ao abrir (lazy — não pesa ao abrir o chat)
  const carregar = useCallback(async () => {
    if (carregadoRef.current) return;
    setLoading(true);
    try {
      const lista = await base44.entities.Sticker.list('-updated_date', LIMITE_PESSOAL + LIMITE_EQUIPE);
      setStickers(lista);
      carregadoRef.current = true;
    } catch (e) {
      toast.error('Erro ao carregar figurinhas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setRecentes(lerRecentes());
    carregar();
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setPos({ bottom: window.innerHeight - r.top + 8, left: Math.min(r.left, window.innerWidth - 288 - 8) });
    }
    const fora = (ev) => {
      if (buttonRef.current?.contains(ev.target)) return;
      const p = document.getElementById('sticker-picker-portal');
      if (p && p.contains(ev.target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('touchstart', fora);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('touchstart', fora);
    };
  }, [isOpen, carregar]);

  const meus = stickers.filter((s) => s.escopo !== 'equipe' && s.owner_id === usuario?.id);
  const equipe = stickers.filter((s) => s.escopo === 'equipe');

  const itens =
  aba === 'recentes' ?
  recentes.map((r) => stickers.find((s) => s.id === r.id) || r).filter((s) => s?.file_url) :
  aba === 'pessoal' ? meus : equipe;

  const handleCriar = async (file) => {
    if (!file) return;
    if (meus.length >= LIMITE_PESSOAL) {
      toast.error(`Limite de ${LIMITE_PESSOAL} figurinhas pessoais atingido. Exclua alguma antes.`);
      return;
    }
    setCriando(true);
    try {
      const webp = await imagemParaStickerWebp(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: webp });
      const novo = await base44.entities.Sticker.create({
        nome: file.name.split('.')[0].slice(0, 40),
        file_url,
        escopo: 'pessoal',
        owner_id: usuario?.id,
        tamanho_kb: Math.round(webp.size / 1024)
      });
      setStickers((prev) => [novo, ...prev]);
      setAba('pessoal');
      toast.success('✅ Figurinha criada!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCriando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleEnviar = async (s) => {
    setIsOpen(false);
    try {
      const file = await urlParaStickerFile(s.file_url);
      registrarRecente(s);
      onSendSticker(file);
      if (s.id) base44.entities.Sticker.update(s.id, { uso_count: (s.uso_count || 0) + 1 }).catch(() => {});
    } catch {
      toast.error('Erro ao enviar figurinha');
    }
  };

  const handleExcluir = async (s, ev) => {
    ev.stopPropagation();
    if (!confirm('Excluir esta figurinha?')) return;
    await base44.entities.Sticker.delete(s.id);
    setStickers((prev) => prev.filter((x) => x.id !== s.id));
  };

  const painel = isOpen ? ReactDOM.createPortal(
    <div
      id="sticker-picker-portal"
      style={{ position: 'fixed', bottom: pos.bottom, left: pos.left, zIndex: 9999, width: 288 }}
      className="bg-white rounded-lg shadow-2xl border border-slate-200">

      <div className="flex items-center gap-1 p-1.5 border-b border-slate-200">
        {ABAS.map((a) =>
        <button
          key={a.key}
          type="button"
          onClick={() => setAba(a.key)}
          title={a.label}
          className={cn('flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[11px] text-slate-600 hover:bg-slate-100', aba === a.key && 'bg-slate-200 text-slate-900 font-semibold')}>

            <a.icon className="w-3.5 h-3.5" />
            {a.label}
          </button>
        )}
      </div>

      <div className="p-1.5 h-48 overflow-y-auto">
        {loading ?
        <div className="h-full flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div> :

        <div className="grid grid-cols-4 gap-1">
            <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={criando}
            className="aspect-square flex flex-col items-center justify-center gap-0.5 rounded border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-50">

              {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="text-[9px]">Criar</span>
            </button>

            {itens.map((s) =>
          <div key={s.id || s.file_url} className="relative group">
                <button
              type="button"
              onClick={() => handleEnviar(s)}
              className="w-full aspect-square rounded hover:bg-slate-100 p-0.5">

                  <img src={s.file_url} alt={s.nome || 'figurinha'} className="w-full h-full object-contain" />
                </button>
                {aba !== 'recentes' && s.id && (s.owner_id === usuario?.id || usuario?.role === 'admin') &&
            <button
              type="button"
              onClick={(ev) => handleExcluir(s, ev)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex">

                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
            }
              </div>
          )}
          </div>
        }

        {!loading && itens.length === 0 &&
        <p className="text-[10px] text-slate-400 text-center mt-3">
            {aba === 'recentes' ? 'Nenhuma figurinha usada ainda' : aba === 'pessoal' ? 'Crie sua primeira figurinha' : 'Nenhuma figurinha da equipe'}
          </p>
        }
      </div>

      <div className="px-2 py-1 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
        <span>Minhas {meus.length}/{LIMITE_PESSOAL}</span>
        <span>Equipe {equipe.length}/{LIMITE_EQUIPE}</span>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleCriar(e.target.files?.[0])} />

      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen((v) => !v)}
        disabled={disabled}
        className="h-8 w-8 md:h-9 md:w-9 flex-shrink-0 rounded-full bg-gradient-to-b from-pink-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white hover:text-white shadow-lg shadow-fuchsia-500/40 transition-all"
        title="Figurinhas">

        <StickerIcon className="w-4 h-4 md:w-[18px] md:h-[18px]" />
      </Button>
      {painel}
    </>);

}