import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, Check } from 'lucide-react';
import { LIMITE_PESSOAL } from './stickerUtils';

// Figurinha recebida no chat com botão para salvar na coleção pessoal do usuário
export default function StickerRecebida({ mediaUrl }) {
  const [salvando, setSalvando] = useState(false);
  const [salva, setSalva] = useState(false);

  const salvar = async (e) => {
    e.stopPropagation();
    if (salvando || salva) return;
    setSalvando(true);
    try {
      const user = await base44.auth.me();
      const minhas = await base44.entities.Sticker.filter({ owner_id: user.id, escopo: 'pessoal' });
      if (minhas.some((s) => s.file_url === mediaUrl)) {
        setSalva(true);
        return;
      }
      if (minhas.length >= LIMITE_PESSOAL) {
        alert(`Limite de ${LIMITE_PESSOAL} figurinhas pessoais atingido. Apague alguma para salvar novas.`);
        return;
      }
      await base44.entities.Sticker.create({
        nome: 'Recebida',
        file_url: mediaUrl,
        escopo: 'pessoal',
        owner_id: user.id
      });
      setSalva(true);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="relative inline-block group">
      <img
        src={mediaUrl}
        alt="Figurinha"
        className="w-32 h-32 object-contain cursor-pointer"
        onClick={() => window.open(mediaUrl, '_blank')}
      />
      <button
        onClick={salvar}
        title={salva ? 'Salva nas suas figurinhas' : 'Salvar nas minhas figurinhas'}
        className={`absolute bottom-1 right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-opacity ${
          salva
            ? 'bg-emerald-500 text-white opacity-100'
            : 'bg-slate-800/80 text-white opacity-0 group-hover:opacity-100'
        }`}
      >
        {salvando
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : salva
            ? <Check className="w-3.5 h-3.5" />
            : <Plus className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}