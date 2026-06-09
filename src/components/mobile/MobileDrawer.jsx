import React from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal } from 'lucide-react';

/**
 * MobileDrawer — primitivo de gaveta lateral mobile (CAMADA 2 da Skill Mobile Global).
 *
 * Padrão único para transformar qualquer sidebar fixa de desktop em uma gaveta
 * acessível por botão no mobile. Qualquer página (Produtos, Promoções, futuras)
 * usa ESTE componente — nunca escreve <Sheet> mobile solto.
 *
 * Props:
 *   triggerLabel  — texto do botão (default "Filtros")
 *   triggerIcon   — ícone Lucide do botão (default SlidersHorizontal)
 *   side          — lado da gaveta ('left' | 'right'), default 'left'
 *   width         — largura da gaveta (default 300px)
 *   className     — classes extras do conteúdo da gaveta
 *   children      — conteúdo (ex: o componente de filtros)
 */
export default function MobileDrawer({
  triggerLabel = 'Filtros',
  triggerIcon: Icon = SlidersHorizontal,
  side = 'left',
  width = 300,
  className = '',
  children,
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="md:hidden bg-white border-2 border-orange-300 h-9 text-xs"
        >
          <Icon className="mr-1.5 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent
        side={side}
        style={{ width: `${width}px`, maxWidth: `${width}px` }}
        className={`p-0 overflow-y-auto ${className}`}
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}