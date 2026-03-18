import React, { useState, useEffect, useCallback } from 'react';
import { X, Bot, Brain } from 'lucide-react';

const SUPERAGENT_URL = 'https://app.base44.com/superagent/69b2fc6e5d83e60566460a2d';

export default function CopilotoIA({ contextoAtivo = null }) {
  const [isOpen, setIsOpen] = useState(false);

  // Atalho de teclado Ctrl+Shift+A
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={open}
        title="Copiloto IA (Ctrl+Shift+A)"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600 text-white rounded-full shadow-xl shadow-purple-500/40 flex items-center justify-center transition-all duration-300 hover:scale-110 group"
      >
        <Bot className="w-7 h-7" />
        {/* Badge verde de status */}
        <span className="absolute top-1 right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        {/* Tooltip */}
        <span className="absolute right-full mr-3 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-slate-700">
          Copiloto IA
        </span>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
          onClick={close}
        />
      )}

      {/* Drawer lateral */}
      <div
        className={`fixed top-0 right-0 h-full z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } w-full md:w-[420px]`}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-700 to-violet-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">Copiloto IA — Nexus360</h2>
              <p className="text-purple-200 text-xs">Powered by Superagent Base44</p>
            </div>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 text-white/70 hover:text-white hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de contexto ativo */}
        {contextoAtivo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border-b border-purple-100 flex-shrink-0">
            <span className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0" />
            <span className="text-xs text-purple-700 truncate">
              <span className="font-semibold">Contexto ativo:</span> {contextoAtivo}
            </span>
          </div>
        )}

        {/* iframe */}
        <div className="flex-1 min-h-0">
          {isOpen && (
            <iframe
              src={SUPERAGENT_URL}
              className="w-full h-full border-0"
              allow="microphone"
              title="Copiloto IA Nexus360"
            />
          )}
        </div>
      </div>
    </>
  );
}