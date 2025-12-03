import React from 'react';
import { Button } from '@/components/ui/button';

export default function CardAcao({ dado }) {
  // Componente simples para exibir dados em um card, pode ser expandido
  return (
    <div className="p-3 my-2 bg-slate-900/70 border border-slate-700 rounded-md text-sm">
      <h5 className="font-bold text-slate-200">{dado.razao_social || dado.nome}</h5>
      <p className="text-slate-400">{dado.cnpj || dado.email || ''}</p>
      <div className="mt-2 flex gap-2">
        <Button size="xs" variant="outline" className="text-xs">Ver Detalhes</Button>
        <Button size="xs" variant="outline" className="text-xs">Criar Orçamento</Button>
      </div>
    </div>
  );
}