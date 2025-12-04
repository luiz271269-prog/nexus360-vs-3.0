import React from "react";
import { Button } from "@/components/ui/button";
import { Upload, Brain, FileText, Image, Table, Zap } from "lucide-react";

export default function UploadZone({ onFileSelect, loading }) {
  const inputRef = React.useRef(null);

  const handleDrag = (e) => {e.preventDefault();e.stopPropagation();};
  const handleDragIn = (e) => {e.preventDefault();e.stopPropagation();};
  const handleDragOut = (e) => {e.preventDefault();e.stopPropagation();};
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files);
    }
  };

  const tiposSuportados = [
    { icon: FileText, nome: "PDF", cor: "text-red-500", accept: ".pdf", hover: "hover:shadow-red-500/20" },
    { icon: Table, nome: "Excel/CSV", cor: "text-emerald-500", accept: ".xlsx,.csv", hover: "hover:shadow-emerald-500/20" },
    { icon: Image, nome: "Imagens", cor: "text-sky-500", accept: ".jpg,.jpeg,.png", hover: "hover:shadow-sky-500/20" },
    { icon: FileText, nome: "Word", cor: "text-indigo-500", accept: ".docx", hover: "hover:shadow-indigo-500/20" }
  ];

  const handleIconClick = (accept) => {
    if (inputRef.current) {
      inputRef.current.accept = accept;
      inputRef.current.click();
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDrag}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut} 
      className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 text-center p-6 backdrop-blur-lg rounded-xl border-2 border-dashed border-slate-700/80 transition-all hover:border-indigo-500/80 hover:bg-slate-800/80 hover:scale-[1.01] duration-300"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files)}
      />
      
      {loading ? (
        <div className="space-y-4 py-4">
          <div className="relative">
            <Brain className="w-12 h-12 text-indigo-400 mx-auto animate-spin" />
            <Zap className="w-4 h-4 text-yellow-400 absolute -top-1 -right-1 animate-bounce" />
          </div>
          <div>
            <p className="text-lg font-bold text-white flex items-center justify-center gap-2">
              Processamento com IA Adaptável ⚡
            </p>
            <p className="text-slate-400 text-sm">Analisando e extraindo dados do documento...</p>
          </div>
          <div className="flex justify-center">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-14 h-14 mx-auto bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-xl flex items-center justify-center border border-slate-700 shadow-lg">
            <Upload className="w-7 h-7 text-slate-400" />
          </div>
          
          <div>
            <p className="text-lg font-bold text-white">
              Arraste arquivos ou clique para selecionar
            </p>
            <p className="text-slate-400 text-sm">Suporte a .xlsx, .csv, PDFs, imagens • Cole prints com Ctrl+V</p>
          </div>

          {/* Tipos Suportados Compacto */}
          <div className="flex justify-center gap-4">
            {tiposSuportados.map((tipo, index) => (
              <div 
                key={index} 
                className="flex flex-col items-center gap-2 group cursor-pointer transform transition-all duration-200 hover:scale-105"
                onClick={() => handleIconClick(tipo.accept)}
              >
                <div className={`w-12 h-12 bg-gradient-to-br from-slate-800/70 to-slate-900/70 rounded-lg flex items-center justify-center border border-slate-700 transition-all group-hover:border-indigo-500 group-hover:bg-slate-700/90 shadow-lg ${tipo.hover} group-hover:shadow-md`}>
                  <tipo.icon className={`w-5 h-5 ${tipo.cor} group-hover:scale-110 transition-transform`} />
                </div>
                <span className="text-xs text-slate-400 font-medium transition-all group-hover:text-white">{tipo.nome}</span>
              </div>
            ))}
          </div>

          {/* Dica especial para .xls */}
          <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
            <p className="text-xs text-blue-300">
              💡 <strong>Arquivos .xls antigos?</strong> Salve como .xlsx ou .csv para importar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}