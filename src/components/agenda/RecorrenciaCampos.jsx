import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RECURRENCES } from './agendaTaskUtils';

export default function RecorrenciaCampos({ frequencia, repeticoes, onFrequencia, onRepeticoes }) {
  const alterarFrequencia = (valor) => {
    onFrequencia(valor);
    if (valor !== 'none' && Number(repeticoes) < 2) onRepeticoes(2);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label>Repetição</Label>
        <Select value={frequencia} onValueChange={alterarFrequencia}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{RECURRENCES.map(([valor, rotulo]) => <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Número de vezes</Label>
        <Input type="number" min="2" max="52" disabled={frequencia === 'none'} value={frequencia === 'none' ? 1 : repeticoes} onChange={e => onRepeticoes(Math.min(52, Math.max(2, Number(e.target.value) || 2)))} />
      </div>
    </div>
  );
}