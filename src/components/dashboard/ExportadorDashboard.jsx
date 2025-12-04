import React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileText, Table, BarChart } from "lucide-react";

export default function ExportadorDashboard({ dados, filtros, viewMode }) {
  const exportarCSV = (data, filename) => {
    if (!data || data.length === 0) {
      alert("Não há dados para exportar");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
    headers.join(','),
    ...data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') ?
      `"${value}"` :
      value;
    }).join(',')
    )].
    join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const gerarRelatorioCompleto = () => {
    const relatorio = {
      data_geracao: new Date().toISOString(),
      filtros_aplicados: filtros,
      resumo: {
        total_vendas: dados.vendas.length,
        faturamento_total: dados.vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0),
        total_orcamentos: dados.orcamentos.length,
        total_clientes: dados.clientes.length,
        total_vendedores: dados.vendedores.length
      },
      vendas: dados.vendas,
      orcamentos: dados.orcamentos,
      clientes: dados.clientes,
      vendedores: dados.vendedores
    };

    const blob = new Blob([JSON.stringify(relatorio, null, 2)], {
      type: 'application/json'
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_completo_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="bg-slate-950 text-yellow-600 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:text-accent-foreground h-10 hover:bg-slate-600/80 border-slate-600">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-slate-800 border-slate-600 text-white" align="end">
        <DropdownMenuItem onClick={() => exportarCSV(dados.vendas, 'vendas')} className="hover:bg-slate-700">
          <Table className="w-4 h-4 mr-2" />
          Vendas (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportarCSV(dados.orcamentos, 'orcamentos')} className="hover:bg-slate-700">
          <FileText className="w-4 h-4 mr-2" />
          Orçamentos (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportarCSV(dados.clientes, 'clientes')} className="hover:bg-slate-700">
          <FileText className="w-4 h-4 mr-2" />
          Clientes (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportarCSV(dados.vendedores, 'vendedores')} className="hover:bg-slate-700">
          <FileText className="w-4 h-4 mr-2" />
          Vendedores (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={gerarRelatorioCompleto} className="hover:bg-slate-700">
          <BarChart className="w-4 h-4 mr-2" />
          Relatório Completo (JSON)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);

}