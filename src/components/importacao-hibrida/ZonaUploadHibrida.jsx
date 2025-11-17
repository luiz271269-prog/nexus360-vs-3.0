import React from "react";
import { Upload, FileText, Image, Table, Mail, Archive, Brain, Zap } from "lucide-react";

export default function ZonaUploadHibrida({ onFileSelect, loading }) {
  const inputRef = React.useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(Array.from(e.dataTransfer.files));
    }
  };

  const tiposSuportados = [
    { icon: FileText, nome: "PDF", cor: "text-red-500", accept: ".pdf" },
    { icon: Image, nome: "Imagens", cor: "text-blue-500", accept: ".jpg,.jpeg,.png,.tiff" },
    { icon: Table, nome: "Planilhas", cor: "text-green-500", accept: ".xlsx,.xls,.csv" },
    { icon: FileText, nome: "Word", cor: "text-indigo-500", accept: ".docx,.doc" },
    { icon: Mail, nome: "E-mails", cor: "text-purple-500", accept: ".eml,.msg" },
    { icon: Archive, nome: "ZIP", cor: "text-yellow-500", accept: ".zip" }
  ];

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDrag}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg rounded-xl border-2 border-dashed border-slate-700/80 p-8 text-center transition-all hover:border-indigo-500/80 hover:bg-slate-800/70"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={tiposSuportados.map(t => t.accept).join(',')}
        onChange={(e) => onFileSelect(Array.from(e.target.files || []))}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <Brain className="w-16 h-16 text-indigo-400 animate-spin" />
            <Zap className="w-6 h-6 text-yellow-400 absolute -top-1 -right-1 animate-bounce" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Processamento Híbrido em Andamento</h3>
            <p className="text-slate-400">Análise inteligente com múltiplos engines...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-2xl flex items-center justify-center border border-slate-700">
            <Upload className="w-10 h-10 text-slate-400" />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Importação Universal
            </h3>
            <p className="text-slate-400 text-lg">
              Arraste qualquer tipo de documento ou clique para selecionar
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Múltiplos arquivos • Processamento em lote • IA adaptável
            </p>
          </div>

          {/* Tipos Suportados */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {tiposSuportados.map((tipo, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer group"
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.accept = tipo.accept;
                    inputRef.current.click();
                  }
                }}
              >
                <tipo.icon className={`w-8 h-8 ${tipo.cor} group-hover:scale-110 transition-transform`} />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 font-medium">
                  {tipo.nome}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => inputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Selecionar Arquivos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}