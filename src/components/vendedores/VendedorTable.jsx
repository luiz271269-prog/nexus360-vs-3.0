import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, User, Phone, Mail, DollarSign } from "lucide-react";

const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getMonthHeaders = () => {
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const headers = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    headers.push({ key: d.toISOString().slice(0, 7), label: monthNames[d.getMonth()] });
  }
  return headers.reverse();
};

const statusChip = (status) => {
  const cores = { ativo: "bg-green-100 text-green-700", inativo: "bg-red-100 text-red-700", ferias: "bg-yellow-100 text-yellow-700" };
  return <Badge className={`capitalize ${cores[status] || 'bg-slate-100 text-slate-600'}`}>{status || 'ativo'}</Badge>;
};

// vendedores = array de Users com campos de vendedor + metricas calculadas
export default function VendedorTable({ vendedores, onEditar, isAdmin }) {
  const monthHeaders = getMonthHeaders();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="w-[220px]">Vendedor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Contatos</TableHead>
            <TableHead className="text-right">Meta Mensal</TableHead>
            <TableHead className="text-right">Faturamento</TableHead>
            {monthHeaders.map(h => <TableHead key={h.key} className="text-right">{h.label}</TableHead>)}
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendedores.map((v) => (
            <TableRow key={v.id} className="hover:bg-slate-50">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {v.foto_url ? <img src={v.foto_url} alt={v.nome} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-slate-500" />}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{v.full_name || v.nome}</div>
                    {v.codigo && <div className="text-xs text-slate-400">{v.codigo}</div>}
                  </div>
                </div>
              </TableCell>
              <TableCell>{statusChip(v.status_vendedor || v.status)}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  {v.email && <div className="flex items-center gap-1.5 text-xs text-slate-600"><Mail className="w-3 h-3" />{v.email}</div>}
                  {v.telefone_ramal && <div className="flex items-center gap-1.5 text-xs text-slate-600"><Phone className="w-3 h-3" />{v.telefone_ramal}</div>}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium text-slate-700">{formatCurrency(v.meta_mensal)}</TableCell>
              <TableCell className="text-right font-bold text-blue-600">{formatCurrency(v.faturamentoTotal || 0)}</TableCell>
              {monthHeaders.map(h => (
                <TableCell key={h.key} className="text-right text-slate-600">{formatCurrency(v.vendasMensais?.[h.key] || 0)}</TableCell>
              ))}
              <TableCell className="text-center">
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditar(v)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {vendedores.length === 0 && (
            <TableRow><TableCell colSpan={7 + monthHeaders.length} className="text-center text-slate-400 py-8">Nenhum vendedor encontrado. Certifique-se que os usuários têm o campo "código" preenchido ou setor = vendas.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}