import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Target, TrendingUp, AlertTriangle, Award, DollarSign, Calendar, User } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend } from "recharts";

export default function AnaliseClientes({ dados, filtros, isGerente }) {
  const analises = calcularAnaliseClientes(dados);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPIs de Clientes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <ClienteKPI
          titulo="Total de Clientes"
          valor={analises.totalClientes}
          subtitulo={`${analises.clientesAtivos} ativos`}
          icon={Users}
          cor="blue"
        />
        <ClienteKPI
          titulo="Receita Média"
          valor={`R$ ${analises.receitaMedia.toLocaleString('pt-BR')}`}
          subtitulo="por cliente/mês"
          icon={DollarSign}
          cor="green"
        />
        <ClienteKPI
          titulo="Clientes em Risco"
          valor={analises.clientesEmRisco}
          subtitulo={`${analises.percentualRisco}% do total`}
          icon={AlertTriangle}
          cor="red"
        />
        <ClienteKPI
          titulo="Novos Clientes"
          valor={analises.novosClientes}
          subtitulo="este período"
          icon={TrendingUp}
          cor="purple"
        />
      </div>

      {/* Análises Visuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        
        {/* Distribuição por Segmento */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader className="px-4 py-3 md:px-6 md:py-4">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <Target className="w-5 h-5 text-blue-500" />
              Clientes por Segmento
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-slate-800/30 pt-2 pb-4 px-2">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={analises.porSegmento}
                  dataKey="quantidade"
                  nameKey="segmento"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  labelLine={false}
                  label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                >
                  {analises.porSegmento.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} formatter={(value) => [`${value} clientes`, 'Quantidade']} />
                 <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Receita por Segmento */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader className="px-4 py-3 md:px-6 md:py-4">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <DollarSign className="w-5 h-5 text-green-500" />
              Receita por Segmento
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-slate-800/30 pt-2 pb-4 px-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analises.receitaPorSegmento}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis dataKey="segmento" tick={{ fontSize: 12, fill: '#9ca3af' }}/>
                <YAxis tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#9ca3af' }}/>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Receita']} />
                <Bar dataKey="receita" fill="url(#greenGradient)" />
                 <defs>
                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Listas e Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Top Clientes */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <Award className="w-5 h-5 text-yellow-500" />
              Top Clientes por Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analises.topClientes.slice(0, 8).map((cliente, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-slate-400 text-slate-900' :
                      index === 2 ? 'bg-orange-400 text-orange-900' :
                      'bg-slate-600 text-slate-200'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-100 truncate">
                        {cliente.nome_fantasia || cliente.razao_social}
                      </p>
                      <p className="text-xs text-slate-400">{cliente.segmento}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-100">
                      R$ {(cliente.valor_recorrente_mensal || 0).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-slate-400">/mês</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clientes por Vendedor - Com Fotos */}
        {isGerente && (
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                <Users className="w-5 h-5 text-indigo-500" />
                Clientes por Vendedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analises.clientesPorVendedor.map((vendedor, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border-2 border-slate-600 flex-shrink-0 flex items-center justify-center overflow-hidden bg-slate-700">
                        {vendedor.foto_url ? (
                          <img src={vendedor.foto_url} alt={vendedor.vendedor} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-100">{vendedor.vendedor}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-xs ${
                            vendedor.ativos >= 10 ? 'bg-green-800 text-green-200' :
                            vendedor.ativos >= 5 ? 'bg-yellow-800 text-yellow-200' :
                            'bg-red-800 text-red-200'
                          }`}>
                            {vendedor.ativos} ativos
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold text-slate-100">{vendedor.total}</p>
                      <p className="text-xs text-slate-400">total</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clientes que Precisam de Atenção */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Atenção Necessária
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analises.clientesAtencao.slice(0, 6).map((cliente, index) => (
                <div key={index} className="p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-100">
                        {cliente.nome_fantasia || cliente.razao_social}
                      </p>
                      <p className="text-xs text-red-400 font-medium">{cliente.motivo}</p>
                    </div>
                    <Badge className="bg-red-800/70 text-red-200 text-xs">
                      {cliente.status}
                    </Badge>
                  </div>
                  {cliente.ultimo_contato && (
                    <p className="text-xs text-slate-400 mt-1">
                      Último contato: {new Date(cliente.ultimo_contato).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Componente KPI para Clientes
function ClienteKPI({ titulo, valor, subtitulo, icon: Icon, cor }) {
  const getCor = (cor) => {
    const cores = {
      blue: "from-blue-500 to-blue-600",
      green: "from-green-500 to-green-600",
      red: "from-red-500 to-red-600",
      purple: "from-purple-500 to-purple-600"
    };
    return cores[cor] || cores.blue;
  };

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white shadow-lg hover:shadow-xl hover:shadow-purple-500/10 transition-shadow transform hover:-translate-y-1">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs md:text-sm font-medium text-slate-400 mb-1">{titulo}</p>
            <p className="text-xl md:text-2xl font-bold text-white truncate">{valor}</p>
            <p className="text-xs text-slate-500 mt-1 truncate">{subtitulo}</p>
          </div>
          <div className={`w-10 h-10 md:w-12 md:h-12 flex-shrink-0 bg-gradient-to-br ${getCor(cor)} rounded-xl flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Função para calcular análises de clientes melhorada
function calcularAnaliseClientes(dados) {
  const totalClientes = dados.clientes.length;
  const clientesAtivos = dados.clientes.filter(c => c.status === 'Ativo').length;
  const clientesEmRisco = dados.clientes.filter(c => c.status === 'Em Risco').length;
  const percentualRisco = totalClientes > 0 ? Math.round((clientesEmRisco / totalClientes) * 100) : 0;
  
  // Receita média
  const receitaTotal = dados.clientes.reduce((acc, c) => acc + (c.valor_recorrente_mensal || 0), 0);
  const receitaMedia = totalClientes > 0 ? Math.round(receitaTotal / totalClientes) : 0;

  // Novos clientes baseado em vendas recentes
  const mesAtual = new Date().toISOString().slice(0, 7);
  const novosClientes = (dados.vendas || []).filter(v => 
    v.data_venda?.slice(0, 7) === mesAtual && v.tipo_venda === 'Nova Venda'
  ).length;

  // Distribuição por segmento
  const segmentos = {};
  dados.clientes.forEach(cliente => {
    const segmento = cliente.segmento || 'Não definido';
    segmentos[segmento] = (segmentos[segmento] || 0) + 1;
  });

  const porSegmento = Object.entries(segmentos).map(([segmento, quantidade]) => ({
    segmento,
    quantidade
  }));

  // Receita por segmento
  const receitaSegmentos = {};
  dados.clientes.forEach(cliente => {
    const segmento = cliente.segmento || 'Não definido';
    receitaSegmentos[segmento] = (receitaSegmentos[segmento] || 0) + (cliente.valor_recorrente_mensal || 0);
  });

  const receitaPorSegmento = Object.entries(receitaSegmentos).map(([segmento, receita]) => ({
    segmento,
    receita
  }));

  // Top clientes
  const topClientes = [...dados.clientes]
    .sort((a, b) => (b.valor_recorrente_mensal || 0) - (a.valor_recorrente_mensal || 0))
    .slice(0, 10);

  // Clientes por vendedor com foto
  const vendedoresMap = new Map((dados.vendedores || []).map(v => [v.nome, v]));
  const vendedorClientes = {};
  dados.clientes.forEach(cliente => {
    const vendedorNome = cliente.vendedor_responsavel || 'Não atribuído';
    if (!vendedorClientes[vendedorNome]) {
      vendedorClientes[vendedorNome] = { total: 0, ativos: 0 };
    }
    vendedorClientes[vendedorNome].total++;
    if (cliente.status === 'Ativo') {
      vendedorClientes[vendedorNome].ativos++;
    }
  });

  const clientesPorVendedor = Object.entries(vendedorClientes)
    .map(([vendedorNome, dadosVendedor]) => {
        const vendedorInfo = vendedoresMap.get(vendedorNome);
        return {
            vendedor: vendedorNome,
            foto_url: vendedorInfo?.foto_url || null,
            ...dadosVendedor
        };
    })
    .sort((a, b) => b.total - a.total);

  // Clientes que precisam de atenção
  const clientesAtencao = dados.clientes
    .filter(c => c.status === 'Em Risco' || c.status === 'Inativo')
    .map(cliente => ({
      ...cliente,
      motivo: cliente.status === 'Em Risco' ? 'Cliente em risco' : 'Cliente inativo'
    }))
    .slice(0, 10);

  return {
    totalClientes,
    clientesAtivos,
    clientesEmRisco,
    percentualRisco,
    receitaMedia,
    novosClientes,
    porSegmento,
    receitaPorSegmento,
    topClientes,
    clientesPorVendedor,
    clientesAtencao
  };
}