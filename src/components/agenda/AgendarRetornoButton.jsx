import React from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AgendarRetornoButton({ contexto, iconOnly = false, className = '' }) {
  const abrir = (event) => {
    event?.stopPropagation?.();
    window.dispatchEvent(new CustomEvent('nexus:agendar-retorno', { detail: contexto }));
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? 'icon' : 'sm'}
      onClick={abrir}
      className={className}
      title="Agendar retorno"
    >
      <CalendarClock className={iconOnly ? 'h-4 w-4' : 'mr-1.5 h-4 w-4'} />
      {!iconOnly && 'Retorno'}
    </Button>
  );
}