import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from '@/components/ui/scroll-area';

const formatCurrency = (value, currency = 'BRL') => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(value || 0);
};

export default function GradePrecificacao({ produtos }) {
  if (!produtos || produtos.length === 0) {
    return <div className="text-center p-2 text-xs">Nenhum produto para exibir.</div>;
  }
  
  const calculateMargin = (venda, custo) => {
    if (!venda || venda === 0) return 0;
    return (((venda - custo) / venda) * 100).toFixed(1);
  }

  return (
    <ScrollArea className="h-[65vh] bg-white rounded border shadow-sm">
      <Table className="text-xs">
        <TableHeader className="sticky top-0 bg-slate-100">
          <TableRow className="h-6">
            <TableHead className="w-[35%] text-xs p-1 font-bold">Produto</TableHead>
            <TableHead className="w-[15%] text-xs p-1 font-bold">Tipo/Marca/Modelo</TableHead>
            <TableHead className="text-right text-xs p-1 font-bold">Preço Orig.</TableHead>
            <TableHead className="text-right text-xs p-1 font-bold">Custo Calc.</TableHead>
            <TableHead className="text-right text-xs p-1 font-bold">Preço Venda</TableHead>
            <TableHead className="text-center text-xs p-1 font-bold">Mg%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produtos.map((produto, index) => {
             const margemReal = calculateMargin(produto.preco_venda, produto.preco_custo);

             return (
              <TableRow key={index} className="h-8">
                <TableCell className="p-1">
                  <div className="font-medium text-xs leading-tight">{produto.nome}</div>
                  <div className="text-xs text-slate-500 leading-none">
                    {produto.configuracao && <span className="text-blue-600">{produto.configuracao}</span>}
                    {produto.codigo && <span className="ml-1 text-slate-400">({produto.codigo})</span>}
                  </div>
                </TableCell>
                <TableCell className="p-1">
                  <div className="text-xs leading-tight">
                    <div className="font-medium text-purple-700">{produto.tipo_produto || 'N/A'}</div>
                    <div className="text-slate-600">{produto.marca || 'N/A'}</div>
                    <div className="text-slate-500 text-xs">{produto.modelo || 'N/A'}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs p-1">
                  {formatCurrency(produto.preco_original, produto.moeda_original)}
                  {produto.moeda_original !== 'BRL' && <Badge variant="outline" className="ml-1 text-xs px-1 py-0">USD</Badge>}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600 text-xs p-1">
                  {formatCurrency(produto.preco_custo)}
                </TableCell>
                <TableCell className="text-right font-mono text-green-700 font-bold text-xs p-1">
                  {formatCurrency(produto.preco_venda)}
                </TableCell>
                <TableCell className="text-center p-1">
                   <Badge variant={margemReal >= 30 ? 'default' : margemReal >= 15 ? 'secondary' : 'destructive'} className="text-xs px-1 py-0">
                        {margemReal}%
                    </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}