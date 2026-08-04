import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users } from 'lucide-react';

export default function AgendaUsuarioFiltro({ valor, onChange }) {
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    base44.entities.User.list('full_name', 200).then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[190px] border-agenda-border bg-agenda-panel/40 text-xs text-agenda-text">
        <Users className="mr-2 h-4 w-4 text-agenda-muted" />
        <SelectValue placeholder="Agenda de..." />
      </SelectTrigger>
      <SelectContent className="border-agenda-border bg-agenda-backdrop text-agenda-text">
        <SelectItem value="me">Minha agenda</SelectItem>
        <SelectItem value="all">Todos (visão ADM)</SelectItem>
        {usuarios.map(u => (
          <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}