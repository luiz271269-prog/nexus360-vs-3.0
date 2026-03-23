import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, User, Phone, Mail } from "lucide-react";

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getMonthHeaders = () => {
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const headers = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    headers.push({ key: d.toISOString().slice(0, 7), label: monthNames[d.getMonth()] });
  }
  return headers.reverse();
};

export default function VendedorTable({ vendedores, onEditar, onExcluir }) {
  const [usuariosMap, setUsuariosMap] = useState({});
  const monthHeaders = getMonthHeaders();

  useEffect(() => {
    base44.entities.User.list().then(users => {
      const map = {};
      (users || []).forEach(u => { map[u.id] = u; });
      setUsuariosMap(map);
    }).catch(() => {});
  }, []);

  const getStatusChip = (status) => {
    const cores = { ativo: "bg-green-100 text-green-700", inativo: "bg-red-100 text-red-700", ferias: "bg-yellow-100 text-yellow-700" };
    return <Badge className={`capitalize ${cores[status] || 'bg-slate-100 text-slate-600'}`}>{status}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="w-[250px]">Usuário / Vendedor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead className="text-right">Meta Mensal</TableHead>
            <TableHead className="text-right">Faturamento (4 meses)</TableHead>
            {monthHeaders.map(h => (
              <TableHead key={h.key} className="text-right">{h.label}</TableHead>
            ))}
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendedores.map((vendedor) => {
            // Priorizar user_id; fallback para email
            const usuario = usuariosMap[vendedor.user_id] || Object.values(usuariosMap).find(u => u.email === vendedor.email);
            const nomeExibicao = usuario?.full_name || vendedor.nome || '—';
            const emailExibicao = usuario?.email || vendedor.email || '';
            const fotoUrl = vendedor.foto_url || null;

            return (
              <TableRow key={vendedor.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {fotoUrl ? (
                        <img src={fotoUrl} alt={nomeExibicao} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">{nomeExibicao}</div>
                      <div className="text-xs text-slate-400">{vendedor.codigo}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getStatusChip(vendedor.status)}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {emailExibicao && <div className="flex items-center gap-1.5 text-xs text-slate-600"><Mail className="w-3 h-3" />{emailExibicao}</div>}
                    {vendedor.telefone && <div className="flex items-center gap-1.5 text-xs text-slate-600"><Phone className="w-3 h-3" />{vendedor.telefone}</div>}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-slate-700">{formatCurrency(vendedor.meta_mensal)}</TableCell>
                <TableCell className="text-right font-bold text-blue-600">{formatCurrency(vendedor.faturamentoTotal || 0)}</TableCell>
                {monthHeaders.map(h => (
                  <TableCell key={h.key} className="text-right text-slate-600">
                    {formatCurrency(vendedor.vendasMensais?.[h.key] || 0)}
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditar(vendedor)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onExcluir(vendedor.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}