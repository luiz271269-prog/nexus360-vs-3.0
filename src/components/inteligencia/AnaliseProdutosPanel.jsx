import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analiseProdutosOrcamentos } from '@/functions/analiseProdutosOrcamentos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingDown, TrendingUp, Clock, Search, Loader2 } from 'lucide-react';

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const ORDENACOES = [
  { key: 'perdidoValor', label: 'Maior perda' },
  { key: 'abertoValor', label: 'Maior potencial' },
  { key: 'orcamentos', label: 'Mais recorrente' },
  { key: 'totalValor', label: 'Maior valor total' }
];

export default function AnaliseProdutosPanel() {
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('perdidoValor');

  const { data, isLoading, error } = useQuery({
    queryKey: ['analise-produtos-orcamentos'],
    queryFn: async () => (await analiseProdutosOrcamentos({})).data,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const familias = useMemo(() => {
    if (!data?.familias) return [];
    const termo = busca.trim().toUpperCase();
    return data.familias
      .filter((f) => !termo || f.familia.includes(termo))
      .sort((a, b) => (b[ordem] || 0) - (a[ordem] || 0));
  }, [data, busca, ordem]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Analisando itens dos orçamentos...
      </div>
    );
  }
  if (error) {
    return <div className="p-6 text-red-600 text-sm">Erro ao carregar análise: {error.message}</div>;
  }

  const r = data?.resumo || {};

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 text-xs font-semibold"><TrendingDown className="w-4 h-4" /> Perdido</div>
            <div className="text-xl font-bold text-red-600 mt-1">{fmt(r.perdidoValor)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold"><Clock className="w-4 h-4" /> Em aberto</div>
            <div className="text-xl font-bold text-blue-600 mt-1">{fmt(r.abertoValor)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold"><TrendingUp className="w-4 h-4" /> Ganho</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{fmt(r.ganhoValor)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold"><Package className="w-4 h-4" /> Famílias</div>
            <div className="text-xl font-bold text-slate-700 mt-1">{r.familiasDistintas || 0}</div>
            <div className="text-[11px] text-slate-400">{r.totalItens || 0} itens · {r.orcsComItens || 0} orçamentos</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <CardTitle className="text-base">Ranking por família de produto</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {ORDENACOES.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setOrdem(o.key)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    ordem === o.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto..."
                  className="pl-8 h-9 w-44"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Família</TableHead>
                  <TableHead className="text-center">Orçamentos</TableHead>
                  <TableHead className="text-center">Clientes</TableHead>
                  <TableHead className="text-right">Perdido</TableHead>
                  <TableHead className="text-right">Em aberto</TableHead>
                  <TableHead className="text-right">Ganho</TableHead>
                  <TableHead className="text-center">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {familias.slice(0, 50).map((f) => (
                  <TableRow key={f.familia}>
                    <TableCell className="font-medium text-slate-800">
                      {f.familia}
                      {f.orcamentos >= 5 && f.ganhoQtd === 0 && (
                        <Badge className="ml-2 bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">demanda sem venda</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-slate-600">{f.orcamentos}</TableCell>
                    <TableCell className="text-center text-slate-600">{f.clientesDistintos}</TableCell>
                    <TableCell className="text-right text-red-600">{f.perdidoValor > 0 ? fmt(f.perdidoValor) : <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="text-right text-blue-600">{f.abertoValor > 0 ? fmt(f.abertoValor) : <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="text-right text-emerald-600">{f.ganhoValor > 0 ? fmt(f.ganhoValor) : <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="text-center">
                      {f.taxaConversao === null ? (
                        <span className="text-slate-300 text-xs">só aberto</span>
                      ) : (
                        <span className={`text-xs font-semibold ${f.taxaConversao > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{f.taxaConversao}%</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {familias.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-400 py-8">Nenhuma família encontrada</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {r.orcsSemItens > 0 && (
            <div className="px-4 py-2 text-[11px] text-slate-400 border-t">
              ⚠️ {r.orcsSemItens} orçamentos sem itens cadastrados ficam fora desta análise.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}