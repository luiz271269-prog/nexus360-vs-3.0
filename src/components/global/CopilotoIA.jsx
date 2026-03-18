import React, { useState, useEffect, useCallback } from 'react';
import { X, Bot, Brain } from 'lucide-react';

const SUPERAGENT_URL = 'https://app.base44.com/superagent/69b2fc6e5d83e60566460a2d';

/**
 * Copiloto IA — Painel lateral com Superagent Base44
 * Props:
 *   isOpen (bool) - controlado pelo Layout
 *   onClose (fn)  - fechar o drawer
 *   contextoAtivo (string|null) - nome do contato/thread ativo na tela
 */
export default function CopilotoIA({ isOpen, onClose, contextoAtivo = null }) {
  // Atalho de teclado Ctrl+Shift+A
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        if (isOpen) onClose?.();
        // A abertura é responsabilidade do Layout via botão flutuante/sidebar
        // Para abrir via atalho sem acesso ao setter do Layout, disparamos evento customizado
        else window.dispatchEvent(new CustomEvent('copiloto-ia:open'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
          onClick={onClose}
        />
      )}

      {/* Drawer lateral */}
      <div
        className={`fixed top-0 right-0 h-full z-[61] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
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
            onClick={onClose}
            className="w-8 h-8 text-white/70 hover:text-white hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de contexto ativo */}
        {contextoAtivo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border-b border-purple-100 flex-shrink-0">
            <span className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0 animate-pulse" />
            <span className="text-xs text-purple-700 truncate">
              <span className="font-semibold">Contexto ativo:</span> {contextoAtivo}
            </span>
          </div>
        )}

        {/* iframe — só renderiza quando aberto para não pré-carregar */}
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