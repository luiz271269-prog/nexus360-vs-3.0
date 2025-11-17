import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export default function OrcamentoCombobox({ orcamentos, onSelectOrcamento, value }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? `${orcamentos.find((o) => o.id === value.id)?.numero_orcamento} - ${orcamentos.find((o) => o.id === value.id)?.cliente_nome}`
            : 'Selecione um orçamento...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0">
        <Command>
          <CommandInput placeholder="Buscar orçamento por número ou cliente..." />
          <CommandEmpty>Nenhum orçamento encontrado.</CommandEmpty>
          <CommandGroup>
            {orcamentos.map((orcamento) => (
              <CommandItem
                key={orcamento.id}
                value={`${orcamento.numero_orcamento} ${orcamento.cliente_nome}`}
                onSelect={() => {
                  onSelectOrcamento(orcamento);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value?.id === orcamento.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex flex-col">
                  <span className="font-bold">{orcamento.numero_orcamento}</span>
                  <span className="text-xs text-slate-500">{orcamento.cliente_nome}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}