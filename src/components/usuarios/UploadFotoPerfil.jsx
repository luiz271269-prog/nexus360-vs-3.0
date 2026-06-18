import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

/**
 * Uploader de foto de perfil do usuário.
 * Aceita: clique para escolher arquivo, arrastar-soltar e COLAR (Ctrl+V) um print.
 * Ao concluir o upload, chama onChange(url) com a URL permanente.
 */
export default function UploadFotoPerfil({ value, onChange, nome = '' }) {
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef(null);

  const inicial = (nome || '?').trim().charAt(0).toUpperCase() || '?';

  const enviarArquivo = async (file) => {
    if (!file || !file.type?.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }
    setEnviando(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
      toast.success('📸 Foto atualizada!');
    } catch (e) {
      toast.error('Erro ao enviar foto: ' + (e.message || 'falha'));
    } finally {
      setEnviando(false);
    }
  };

  const handlePaste = (e) => {
    const item = Array.from(e.clipboardData?.items || []).find((i) => i.type?.startsWith('image/'));
    if (item) {
      e.preventDefault();
      enviarArquivo(item.getAsFile());
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) enviarArquivo(file);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Avatar / preview */}
      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow">
        {value ? (
          <img src={value} alt={nome} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-xl font-bold">{inicial}</span>
        )}
        {value && !enviando && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Remover foto"
            className="absolute top-0 right-0 bg-black/50 hover:bg-red-600 text-white rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Zona de upload (clique / arraste / cole) */}
      <div
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onPaste={handlePaste}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={handleDrop}
        className={`flex-1 cursor-pointer rounded-lg border-2 border-dashed px-3 py-2 text-center transition-colors outline-none focus:border-indigo-400 ${
          arrastando ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
        }`}
      >
        {enviando ? (
          <div className="flex items-center justify-center gap-2 text-xs text-indigo-600">
            <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <UploadCloud className="w-4 h-4" />
            <span>Clique, arraste ou <strong>cole (Ctrl+V)</strong> um print</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && enviarArquivo(e.target.files[0])}
      />
    </div>
  );
}