import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Eye, Users } from "lucide-react";
import AtribuidorAtendenteRapido from '../comunicacao/AtribuidorAtendenteRapido';

export default function ClienteTable({ clientes, onEdit, onDelete, onViewDetails }) {

  const formatCurrency = (value) => {
    return (value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const getStatusChip = (status) => {
    const styles = {
      "Ativo": "bg-green-100 text-green-700 border-green-200",
      "Inativo": "bg-slate-100 text-slate-600 border-slate-200",
      "Em Risco": "bg-red-100 text-red-700 border-red-200",
      "Promotor": "bg-sky-100 text-sky-700 border-sky-200",
      "Prospect": "bg-yellow-100 text-yellow-700 border-yellow-200",
    };
    return <Badge className={`capitalize ${styles[status] || 'bg-gray-100'}`}>{status}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50 hover:bg-slate-50">
          <TableRow>
            <TableHead className="w-[300px]">Razão Social / Fantasia</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Segmento</TableHead>
            <TableHead className="text-right">Valor Mensal</TableHead>
            <TableHead className="w-[100px] text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => (
            <TableRow key={cliente.id} className="hover:bg-slate-50/50">
              <TableCell>
                <div className="font-medium text-slate-800">{cliente.razao_social}</div>
                <div className="text-sm text-slate-500">{cliente.nome_fantasia}</div>
              </TableCell>
              <TableCell className="font-mono text-sm text-slate-600">{cliente.cnpj}</TableCell>
              <TableCell>
                <AtribuidorAtendenteRapido
                  contato={{ 
                    id: cliente.id, 
                    vendedor_responsavel: cliente.vendedor_responsavel,
                    tipo_contato: 'cliente'
                  }}
                  tipoContato="cliente"
                  setorAtual="vendas"
                  variant="compact"
                />
              </TableCell>
              <TableCell>{getStatusChip(cliente.status)}</TableCell>
              <TableCell>{cliente.segmento}</TableCell>
              <TableCell className="text-right font-medium text-slate-700">{formatCurrency(cliente.valor_recorrente_mensal)}</TableCell>
              <TableCell className="text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onViewDetails && (
                      <DropdownMenuItem onClick={() => onViewDetails(cliente)}>
                        <Eye className="w-4 h-4 mr-2" /> Ver Detalhes
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onEdit(cliente)}>
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    {onDelete && (
                      <DropdownMenuItem onClick={() => onDelete(cliente.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}