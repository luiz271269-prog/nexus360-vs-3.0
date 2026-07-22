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

const ETAPAS = [
  { valor: 'todas', label: 'Todas as etapas' },
  { valor: 'rascunho', label: 'Rascunho' },
  { valor: 'aguardando_cotacao', label: 'Aguardando Cotação' },
  { valor: 'cotando', label: 'Cotando' },
  { valor: 'aguardando_analise', label: 'Aguardando Análise' },
  { valor: 'analisando', label: 'Analisando' },
  { valor: 'aguardando_liberacao', label: 'Aguardando Liberação' },
  { valor: 'liberado', label: 'Liberado' },
  { valor: 'enviado', label: 'Enviado' },
  { valor: 'negociando', label: 'Negociando' },
  { valor: 'aprovado', label: 'Aprovado' },
  { valor: 'rejeitado', label: 'Rejeitado' },
  { valor: 'vencido', label: 'Vencido' }
];

export default function AnaliseProdutosPanel() {
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('perdidoValor');
  const [etapa, setEtapa] = useState('todas');

  const { data, isLoading, error } = useQuery({
    queryKey: ['analise-produtos-orcamentos'],
    queryFn: async () => (await analiseProdutosOrcamentos({})).data,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const familias = useMemo(() => {
    if (!data?.familias) return [];
    const termo = busca.trim().toUpperCase();
    let lista = data.familias.filter((f) => !termo || f.familia.includes(termo));
    if (etapa !== 'todas') {
      lista = lista
        .filter((f) => f.etapas?.[etapa]?.qtd > 0)
        .sort((a, b) => (b.etapas[etapa]?.valor || 0) - (a.etapas[etapa]?.valor || 0));
    } else {
      lista = [...lista].sort((a, b) => (b[ordem] || 0) - (a[ordem] || 0));
    }
    return lista;
  }, [data, busca, ordem, etapa]);

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
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold"><TrendingUp className="w-4 h-4" /> Ganho + Vendas</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{fmt(r.ganhoValor)}</div>
            <div className="text-[11px] text-emerald-500">{r.vendasQtd || 0} itens vendidos · {fmt(r.vendasValor)}</div>
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
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value)}
                className="h-9 px-2 text-xs border border-slate-200 rounded-md bg-white text-slate-700 font-medium"
              >
                {ETAPAS.map((e) => (
                  <option key={e.valor} value={e.valor}>{e.label}</option>
                ))}
              </select>
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
                  {etapa !== 'todas' && <TableHead className="text-right bg-violet-50 text-violet-700">Na etapa</TableHead>}
                  <TableHead className="text-right">Perdido</TableHead>
                  <TableHead className="text-right">Em aberto</TableHead>
                  <TableHead className="text-right">Ganho</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-center">Prob. Fechar</TableHead>
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
                    {etapa !== 'todas' && (
                      <TableCell className="text-right bg-violet-50/50 font-semibold text-violet-700">
                        {fmt(f.etapas?.[etapa]?.valor)} <span className="text-[10px] text-violet-400">({f.etapas?.[etapa]?.qtd})</span>
                      </TableCell>
                    )}
                    <TableCell className="text-right text-red-600">{f.perdidoValor > 0 ? fmt(f.perdidoValor) : <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="text-right text-blue-600">{f.abertoValor > 0 ? fmt(f.abertoValor) : <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="text-right text-emerald-600">{f.ganhoValor > 0 ? fmt(f.ganhoValor) : <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="text-right text-teal-600">
                      {f.vendasQtd > 0 ? <>{fmt(f.vendasValor)} <span className="text-[10px] text-teal-400">({f.vendasQtd})</span></> : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {f.probFechamento === null || f.probFechamento === undefined ? (
                        <span className="text-slate-300 text-xs">sem histórico</span>
                      ) : (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          f.probFechamento >= 60 ? 'bg-emerald-100 text-emerald-700' :
                          f.probFechamento >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                        }`}>{f.probFechamento}%</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {familias.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={etapa !== 'todas' ? 9 : 8} className="text-center text-slate-400 py-8">Nenhuma família encontrada</TableCell>
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