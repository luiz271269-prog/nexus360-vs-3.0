import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Eye, Users, Phone } from "lucide-react";
import AtribuidorAtendenteRapido from '../comunicacao/AtribuidorAtendenteRapido';
import EtiquetaRecorrencia from './EtiquetaRecorrencia';
import EtiquetaFaixaFaturamento from './EtiquetaFaixaFaturamento';
import BotaoAbrirChat from '../crm/BotaoAbrirChat';
import BotaoNotasCliente from './BotaoNotasCliente';
import { diasParado } from './LegendaTotalizadoresClientes';

const getDiasColor = (d) => {
  if (d === null) return null;
  if (d > 60) return 'bg-red-500 text-white';
  if (d >= 21) return 'bg-amber-400 text-amber-900';
  return 'bg-emerald-500 text-white';
};

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
            <TableHead className="text-right">Faturado (NF)</TableHead>
            <TableHead className="text-right">Pipeline (Orç.)</TableHead>
            <TableHead className="text-right">Valor Mensal</TableHead>
            <TableHead className="w-[100px] text-center">Chat / Notas</TableHead>
            <TableHead className="w-[100px] text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => {
            const dias = diasParado(cliente);
            return (
            <TableRow key={cliente.id} className="hover:bg-slate-50/50">
              <TableCell>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800">{cliente.razao_social}</span>
                  <EtiquetaRecorrencia etiqueta={cliente.etiqueta_recorrencia || cliente.faturamento?.etiqueta} />
                  <EtiquetaFaixaFaturamento faixa={cliente.faixa_faturamento} />
                  {dias !== null && (
                    <span
                      title="Dias desde o último contato"
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getDiasColor(dias)}`}
                    >
                      {dias}d parado
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">{cliente.nome_fantasia}</div>
                {cliente.telefone && (
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {cliente.telefone}
                  </div>
                )}
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
              <TableCell className="text-right">
                {cliente.faturamento ? (
                  <div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(cliente.faturamento.totalFaturado)}</div>
                    <div className="text-xs text-slate-400">{cliente.faturamento.qtdNotas} NF</div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {(cliente.pipeline_potencial_qtd > 0 || cliente.pipeline_perdido_qtd > 0) ? (
                  <div className="text-xs space-y-0.5">
                    {cliente.pipeline_potencial_qtd > 0 && (
                      <div className="text-blue-600 font-semibold" title="Potencial: orçamentos em aberto">
                        ▲ {formatCurrency(cliente.pipeline_potencial_valor)} <span className="text-slate-400 font-normal">({cliente.pipeline_potencial_qtd})</span>
                      </div>
                    )}
                    {cliente.pipeline_perdido_qtd > 0 && (
                      <div className="text-red-500" title="Perdas: orçamentos rejeitados ou vencidos">
                        ▼ {formatCurrency(cliente.pipeline_perdido_valor)} <span className="text-slate-400">({cliente.pipeline_perdido_qtd})</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-medium text-slate-700">{formatCurrency(cliente.valor_recorrente_mensal)}</TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <BotaoAbrirChat cliente={cliente} />
                  <BotaoNotasCliente cliente={cliente} />
                </div>
              </TableCell>
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
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}