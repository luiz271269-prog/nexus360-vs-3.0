import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function EmptyState({ message = "Selecione uma conversa", subtitle = "ou digite um número para criar contato" }) {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50">
      <div className="text-center">
        <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-xl font-semibold text-slate-600">{message}</p>
        <p className="text-sm text-slate-400 mt-2">{subtitle}</p>
      </div>
    </div>
  );
}