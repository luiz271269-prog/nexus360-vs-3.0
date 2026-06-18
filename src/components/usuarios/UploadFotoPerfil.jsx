import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, X, ImageIcon, Search } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

/**
 * Uploader de foto de perfil do usuário.
 * Aceita: clique para escolher arquivo, arrastar-soltar, COLAR (Ctrl+V) um print
 * e BUSCAR a foto direto do WhatsApp pelo número do atendente.
 * Ao concluir, chama onChange(url) com a URL permanente.
 */
export default function UploadFotoPerfil({ value, onChange, nome = '', telefone = '', integracoesWhatsApp = [] }) {
  const [enviando, setEnviando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef(null);

  const inicial = (nome || '?').trim().charAt(0).toUpperCase() || '?';

  const buscarDoWhatsApp = async () => {
    const numero = (telefone || '').trim() || (window.prompt('Número de WhatsApp do atendente (com DDD):') || '').trim();
    if (!numero) return;
    const integracao = integracoesWhatsApp.find((i) => i.status === 'conectado') || integracoesWhatsApp[0];
    if (!integracao) {
      toast.error('Nenhuma conexão WhatsApp disponível para buscar a foto');
      return;
    }
    setBuscando(true);
    try {
      const { data } = await base44.functions.invoke('buscarFotoPerfilWhatsApp', { integration_id: integracao.id, phone: numero });
      if (data?.profilePictureUrl) {
        onChange(data.profilePictureUrl);
        toast.success('📸 Foto encontrada no WhatsApp!');
      } else {
        toast.error('Nenhuma foto de perfil encontrada para esse número');
      }
    } catch (e) {
      toast.error('Erro ao buscar foto: ' + (e.message || 'falha'));
    } finally {
      setBuscando(false);
    }
  };

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

      {/* Buscar foto direto do WhatsApp */}
      <button
        type="button"
        onClick={buscarDoWhatsApp}
        disabled={buscando}
        title="Buscar foto do WhatsApp pelo número"
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium border border-green-200 disabled:opacity-50"
      >
        {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        <span className="hidden sm:inline">WhatsApp</span>
      </button>

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