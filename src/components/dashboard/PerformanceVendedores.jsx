import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, TrendingUp, Target, DollarSign, Users, Phone, Calendar, Star, Trophy, User, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from "recharts";

export default function PerformanceVendedores({ dados, filtros, isGerente, usuario }) {
  const metricas = calcularMetricasVendedores(dados, usuario);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPIs de Performance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <PerformanceKPI
          titulo="Top Vendedor"
          valor={metricas.topVendedor?.nome || 'N/A'}
          subtitulo={metricas.topVendedor ? `R$ ${metricas.topVendedor.faturamento.toLocaleString('pt-BR')}` : ''}
          icon={Trophy}
          cor="gold"
          foto_url={metricas.topVendedor?.foto_url} />

        <PerformanceKPI
          titulo="Meta Coletiva"
          valor={`${metricas.percentualMetaColetiva}%`}
          subtitulo={`R$ ${metricas.faturamentoTotal.toLocaleString('pt-BR')}`}
          icon={Target}
          cor="blue" />

        <PerformanceKPI
          titulo="Ticket Médio"
          valor={`R$ ${metricas.ticketMedio.toLocaleString('pt-BR')}`}
          subtitulo={`${metricas.totalVendas} vendas`}
          icon={DollarSign}
          cor="green" />

        <PerformanceKPI
          titulo="Vendedores Ativos"
          valor={metricas.vendedoresAtivos}
          subtitulo={`de ${dados.vendedores.length} total`}
          icon={Users}
          cor="purple" />

      </div>

      {/* Seção Principal: Ranking (75%) e Análises (25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Coluna Esquerda: Ranking de Vendedores Detalhado - 75% */}
        <Card className="lg:col-span-3 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader className="pb-3 px-4 md:pb-4 md:px-6">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <Award className="w-5 h-5 text-yellow-500" />
              Ranking de Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 md:px-6">
            <div className="space-y-2">
              {metricas.rankingVendedores && metricas.rankingVendedores.length > 0 ?
              metricas.rankingVendedores.map((vendedor, index) =>
              <div key={vendedor.id} className="flex items-center gap-2 md:gap-3 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-slate-700 shadow-sm">
                    
                    {/* Posição, Foto e Nome */}
                    <div className="flex items-center gap-2 w-32 sm:w-48 md:w-64 flex-shrink-0">
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  index === 0 ? 'bg-yellow-400 text-yellow-900' :
                  index === 1 ? 'bg-slate-400 text-slate-900' :
                  index === 2 ? 'bg-orange-400 text-orange-900' :
                  'bg-slate-600 text-slate-200'}`
                  }>
                        {index + 1}
                      </div>
                      
                      <div className="w-8 h-8 rounded-full border-2 border-slate-600 flex-shrink-0 flex items-center justify-center overflow-hidden bg-slate-700">
                        {vendedor.foto_url ?
                    <img
                      src={vendedor.foto_url}
                      alt={vendedor.nome}
                      className="w-full h-full object-cover" /> :
                    <User className="w-4 h-4 text-slate-400" />
                    }
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 truncate text-sm">{vendedor.nome}</span>
                          {vendedor.percentualMeta >= 100 &&
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      }
                        </div>
                        <span className="font-bold text-green-400 text-xs">R$ {(vendedor.faturamento || 0).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>

                    {/* Barra de Meta */}
                    <div className="flex items-center gap-2 flex-grow">
                      <Progress value={Math.min(100, vendedor.percentualMeta || 0)} className="h-2 flex-grow" />
                      <Badge className={`text-xs px-2 py-1 ${
                  (vendedor.percentualMeta || 0) >= 100 ? 'bg-green-800 text-green-200' :
                  (vendedor.percentualMeta || 0) >= 80 ? 'bg-yellow-800 text-yellow-200' :
                  'bg-red-800 text-red-200'}`
                  }>
                        {vendedor.percentualMeta || 0}%
                      </Badge>
                    </div>
                    
                    {/* Métricas Compactas */}
                    <div className="hidden md:flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <div className="font-bold text-slate-100">{vendedor.quantidadeVendas}</div>
                        <div className="text-slate-400">Vendas</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-slate-100">{vendedor.quantidadeOrcamentos}</div>
                        <div className="text-slate-400">Orçam.</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-slate-100">{vendedor.taxaConversao}%</div>
                        <div className="text-slate-400">Conv.</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-slate-100">{vendedor.quantidadeClientes}</div>
                        <div className="text-slate-400">Clientes</div>
                      </div>
                    </div>

                  </div>
              ) :

              <div className="text-center py-8 text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2" />
                  <p className="font-semibold">Nenhum vendedor encontrado</p>
                  <p className="text-sm">Tente ajustar os filtros para visualizar os dados.</p>
                </div>
              }
            </div>
          </CardContent>
        </Card>

        {/* Coluna Direita: Análises Empilhadas - 25% */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Atividades e Interações */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Atividades Comerciais</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-slate-800/70 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-400" />
                    <span className="font-medium text-sm text-slate-200">Ligações</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-300 text-sm">{metricas.totalLigacoes}</div>
                    <div className="text-xs text-slate-400">este período</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-800/70 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-400" />
                    <span className="font-medium text-sm text-slate-200">Reuniões</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-300 text-sm">{metricas.totalReunioes}</div>
                    <div className="text-xs text-slate-400">agendadas</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-800/70 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    <span className="font-medium text-sm text-slate-200">Taxa Conversão</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-purple-300 text-sm">{metricas.taxaConversao}%</div>
                    <div className="text-xs text-slate-400">média geral</div>
                  </div>
                </div>

                {!isGerente &&
                <div className="mt-3 p-2 bg-indigo-900/50 rounded-lg border border-indigo-700">
                    <h4 className="font-semibold text-indigo-300 mb-1 text-sm">Sua Performance</h4>
                    <div className="text-xs text-indigo-400">
                      <p>• Posição: #{metricas.posicaoUsuario || 'N/A'}</p>
                      <p>• Meta: {metricas.metaUsuario || 0}%</p>
                      <p>• Vendas: {metricas.vendasUsuario || 0}</p>
                    </div>
                  </div>
                }
              </div>
            </CardContent>
          </Card>

          {/* Evolução Mensal */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Evolução Mensal</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={metricas.evolucaoMensal}>
                  <defs>
                    <linearGradient id="faturamento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Faturamento']} />
                  <Area type="monotone" dataKey="faturamento" stroke="#10b981" fill="url(#faturamento)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribuição de Vendas */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Distribuição de Vendas</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={metricas.distribuicaoVendas}
                    dataKey="valor"
                    nameKey="vendedor"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelStyle={{ fontSize: '10px', fill: 'white' }}
                    labelLine={false}>

                    {metricas.distribuicaoVendas.map((entry, index) =>
                    <Cell key={`cell-${index}`} fill={getVendedorColor(index)} />
                    )}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>);

}

// Subcomponente para métricas individuais (No longer used directly in ranking list, but still valid if used elsewhere)
function MetricItem({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white p-2 rounded-lg border">
      <div className="flex items-center justify-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="font-bold text-slate-800 text-base mt-1">{value}</p>
    </div>);

}

// Componente para KPIs de Performance
function PerformanceKPI({ titulo, valor, subtitulo, icon: Icon, cor, foto_url }) {
  const cores = {
    gold: 'from-yellow-500 to-yellow-600',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600'
  };

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white shadow-lg hover:shadow-xl hover:shadow-purple-500/10 transition-shadow transform hover:-translate-y-1">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 flex-shrink-0 bg-gradient-to-br ${cores[cor]} flex items-center justify-center overflow-hidden ${foto_url ? 'rounded-full' : 'rounded-lg'}`}>
            {foto_url ?
            <img src={foto_url} alt={valor} className="w-full h-full object-cover" /> :

            Icon && <Icon className="w-5 h-5 text-white" />
            }
          </div>
          <div className="flex-grow min-w-0">
            <h3 className="text-xs font-medium text-slate-400">{titulo}</h3>
            <p className="text-lg font-bold text-white truncate">{valor}</p>
            {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
          </div>
        </div>
      </CardContent>
    </Card>);

}

// Funções auxiliares
function getVendedorColor(index) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
  return colors[index % colors.length];
}

function calcularMetricasVendedores(dados, usuario) {
  if (!dados || !Array.isArray(dados.vendedores) || !Array.isArray(dados.vendas) || !Array.isArray(dados.interacoes) || !Array.isArray(dados.orcamentos) || !Array.isArray(dados.clientes)) {
    return {
      rankingVendedores: [],
      topVendedor: null,
      faturamentoTotal: 0,
      percentualMetaColetiva: 0,
      ticketMedio: 0,
      totalVendas: 0,
      vendedoresAtivos: 0,
      performanceVsMeta: [],
      distribuicaoVendas: [],
      evolucaoMensal: [],
      totalLigacoes: 0,
      totalReunioes: 0,
      taxaConversao: 0,
      posicaoUsuario: 0,
      metaUsuario: 0,
      vendasUsuario: 0
    };
  }

  // Calcular métricas por vendedor
  const vendedoresComMetricas = dados.vendedores.map((vendedor) => {
    const vendasVendedor = dados.vendas.filter((v) => v.vendedor === vendedor.nome);
    const faturamentoVendedor = vendasVendedor.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const percentualMeta = (vendedor.meta_mensal || 0) > 0 ?
    Math.round(faturamentoVendedor / vendedor.meta_mensal * 100) :
    0;

    const orcamentosVendedor = dados.orcamentos.filter((o) => o.vendedor === vendedor.nome);
    const clientesVendedor = dados.clientes.filter((c) => c.vendedor_responsavel === vendedor.nome && c.status === 'Ativo');
    const taxaConversaoIndividual = orcamentosVendedor.length > 0 ?
    Math.round(vendasVendedor.length / orcamentosVendedor.length * 100) :
    0;

    return {
      ...vendedor,
      faturamento: faturamentoVendedor,
      percentualMeta,
      quantidadeVendas: vendasVendedor.length,
      quantidadeOrcamentos: orcamentosVendedor.length,
      taxaConversao: taxaConversaoIndividual,
      quantidadeClientes: clientesVendedor.length
    };
  });

  // Ordenar por faturamento
  const rankingVendedores = vendedoresComMetricas.sort((a, b) => b.faturamento - a.faturamento);
  const topVendedor = rankingVendedores[0];

  // Métricas gerais
  const faturamentoTotal = dados.vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const metaTotal = dados.vendedores.reduce((sum, v) => sum + (v.meta_mensal || 0), 0);
  const percentualMetaColetiva = metaTotal > 0 ? Math.round(faturamentoTotal / metaTotal * 100) : 0;
  const ticketMedio = dados.vendas.length > 0 ? Math.round(faturamentoTotal / dados.vendas.length) : 0;
  const vendedoresAtivos = dados.vendedores.filter((v) => v.status === 'ativo').length;

  // Performance vs Meta para gráfico
  const performanceVsMeta = rankingVendedores.map((v) => ({
    nome: v.nome.split(' ')[0],
    percentual: v.percentualMeta,
    meta: 100,
    faturamento: v.faturamento
  }));

  // Distribuição de vendas
  const distribuicaoVendas = rankingVendedores.slice(0, 6).map((v) => ({
    vendedor: v.nome.split(' ')[0],
    valor: v.faturamento
  }));

  // Evolução mensal
  const evolucaoMensal = [
  { mes: 'Jan', faturamento: faturamentoTotal * 0.8 },
  { mes: 'Fev', faturamento: faturamentoTotal * 0.9 },
  { mes: 'Mar', faturamento: faturamentoTotal * 1.1 },
  { mes: 'Abr', faturamento: faturamentoTotal }].
  map((data) => ({
    ...data,
    faturamento: Math.max(0, data.faturamento)
  }));

  const nomeUsuario = usuario?.full_name || usuario?.nome || '';

  return {
    rankingVendedores,
    topVendedor,
    faturamentoTotal,
    percentualMetaColetiva,
    ticketMedio,
    totalVendas: dados.vendas.length,
    vendedoresAtivos,
    performanceVsMeta,
    distribuicaoVendas,
    evolucaoMensal,
    totalLigacoes: dados.interacoes.filter((i) => i.tipo_interacao === 'ligacao').length,
    totalReunioes: dados.interacoes.filter((i) => i.tipo_interacao === 'reuniao').length,
    taxaConversao: Math.round(dados.vendas.length / Math.max(dados.orcamentos.length, 1) * 100),
    posicaoUsuario: rankingVendedores.findIndex((v) => v.nome === nomeUsuario) + 1 || 0,
    metaUsuario: rankingVendedores.find((v) => v.nome === nomeUsuario)?.percentualMeta || 0,
    vendasUsuario: rankingVendedores.find((v) => v.nome === nomeUsuario)?.quantidadeVendas || 0
  };
}