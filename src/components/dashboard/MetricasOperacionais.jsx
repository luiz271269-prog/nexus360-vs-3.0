import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DetalhesModal from "./DetalhesModal";
import { COLS_ORCAMENTO, COLS_INTERACAO } from "./drilldownColunas";
import { Target, TrendingUp, Clock, CheckCircle, AlertCircle, Phone, MessageCircle, Calendar, Users, Mail } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from "recharts";

export default function MetricasOperacionais({ dados, filtros, isGerente }) {
  const dadosFiltrados = aplicarFiltroData(dados, filtros);
  const metricas = calcularMetricasOperacionais(dadosFiltrados, dados);
  const [drill, setDrill] = useState(null);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPIs Operacionais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <OperacionalKPI
          titulo="Taxa de Conversão"
          valor={`${metricas.taxaConversao}%`}
          subtitulo={`${metricas.vendasFechadas}/${metricas.totalOrcamentos} orçamentos`}
          icon={Target}
          cor="green"
          onClick={() => setDrill({ title: 'Orçamentos Aprovados', dados: metricas.listaAprovados, colunas: COLS_ORCAMENTO })}
        />
        <OperacionalKPI
          titulo="Tempo Médio"
          valor={`${metricas.tempoMedioFechamento} dias`}
          subtitulo="para fechamento"
          icon={Clock}
          cor="blue"
          onClick={() => setDrill({ title: 'Aprovados — Base do Tempo de Fechamento', dados: metricas.listaAprovados, colunas: COLS_ORCAMENTO })}
        />
        <OperacionalKPI
          titulo="Funil Ativo"
          valor={metricas.orcamentosAtivos}
          subtitulo={`R$ ${metricas.valorFunilAtivo.toLocaleString('pt-BR')}`}
          icon={TrendingUp}
          cor="purple"
          onClick={() => setDrill({ title: 'Funil Ativo — Orçamentos em Aberto', dados: metricas.listaAbertos, colunas: COLS_ORCAMENTO })}
        />
        <OperacionalKPI
          titulo="Atividades Hoje"
          valor={metricas.atividadesHoje}
          subtitulo={`${metricas.ligacoesHoje} ligações realizadas`}
          icon={Phone}
          cor="orange"
          onClick={() => setDrill({ title: 'Atividades de Hoje', dados: metricas.listaInteracoesHoje, colunas: COLS_INTERACAO })}
        />
      </div>

      {/* Funil de Vendas e Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        
        {/* Funil de Vendas */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <Target className="w-5 h-5 text-indigo-500" />
              Funil de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metricas.funil.map((etapa, index) => (
                <div key={index} className="relative p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <etapa.icon className={`w-5 h-5 ${etapa.cor}`} />
                      <span className="font-medium text-slate-200">{etapa.nome}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-white">{etapa.quantidade}</span>
                      <span className="text-sm text-slate-400 ml-2">
                        (R$ {etapa.valor.toLocaleString('pt-BR')})
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full bg-gradient-to-r ${etapa.bg}`}
                      style={{ width: `${etapa.percentual}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{etapa.percentual}% do total</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Mensal */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader className="px-4 py-3 md:px-6 md:py-4">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Performance Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-slate-800/30 pt-2 pb-4 px-2">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={metricas.performanceMensal}>
                <defs>
                  <linearGradient id="vendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="orcamentos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
                <Area type="monotone" dataKey="vendas" stroke="#10b981" fill="url(#vendas)" name="Vendas" />
                <Area type="monotone" dataKey="orcamentos" stroke="#3b82f6" fill="url(#orcamentos)" name="Orçamentos" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Análises Detalhadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Status dos Orçamentos */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <CheckCircle className="w-5 h-5 text-blue-500" />
              Status dos Orçamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metricas.statusOrcamentos.map((status, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-3">
                    {status.tipo === 'aberto' && <Clock className="w-5 h-5 text-yellow-400" />}
                    {status.tipo === 'aprovado' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {status.tipo === 'rejeitado' && <AlertCircle className="w-5 h-5 text-red-400" />}
                    {status.tipo === 'vencido' && <AlertCircle className="w-5 h-5 text-orange-400" />}
                    <div>
                      <p className="font-medium text-slate-200">{status.status}</p>
                      <p className="text-xs text-slate-400">
                        R$ {status.valor.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Badge className={`border-none ${
                    status.tipo === 'aberto' ? 'bg-yellow-800/70 text-yellow-200' :
                    status.tipo === 'aprovado' ? 'bg-green-800/70 text-green-200' :
                    status.tipo === 'rejeitado' ? 'bg-red-800/70 text-red-200' :
                    'bg-orange-800/70 text-orange-200'
                  }`}>
                    {status.quantidade}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Atividades Reais da Semana */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <Calendar className="w-5 h-5 text-purple-500" />
              Atividades da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metricas.atividadesSemana.map((atividade, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-3">
                    {atividade.tipo === 'ligacao' && <Phone className="w-5 h-5 text-blue-400" />}
                    {atividade.tipo === 'whatsapp' && <MessageCircle className="w-5 h-5 text-green-400" />}
                    {atividade.tipo === 'email' && <Mail className="w-5 h-5 text-purple-400" />}
                    {atividade.tipo === 'reuniao' && <Users className="w-5 h-5 text-orange-400" />}
                    <div>
                      <p className="font-medium text-slate-200 capitalize">{atividade.nome}</p>
                      <p className="text-xs text-slate-400">{atividade.descricao}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">{atividade.quantidade}</p>
                    <p className="text-xs text-slate-500">{atividade.periodo}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Próximas Ações */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Próximas Ações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metricas.proximasAcoes.slice(0, 6).map((acao, index) => (
                <div key={index} className="p-3 rounded-lg bg-orange-900/20 border border-orange-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-100">{acao.cliente}</p>
                      <p className="text-xs text-orange-400">{acao.acao}</p>
                    </div>
                    <Badge className="bg-orange-800/70 text-orange-200 text-xs">
                      {acao.prazo}
                    </Badge>
                  </div>
                  {acao.vendedor && (
                    <p className="text-xs text-slate-400 mt-1">
                      Responsável: {acao.vendedor}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {drill && <DetalhesModal title={drill.title} dados={drill.dados} colunas={drill.colunas} onClose={() => setDrill(null)} />}
    </div>
  );
}

// Componente KPI Operacional
function OperacionalKPI({ titulo, valor, subtitulo, icon: Icon, cor, onClick }) {
  const getCor = (cor) => {
    const cores = {
      green: "from-green-500 to-green-600",
      blue: "from-blue-500 to-blue-600",
      purple: "from-purple-500 to-purple-600",
      orange: "from-orange-500 to-orange-600"
    };
    return cores[cor] || cores.green;
  };

  return (
    <Card onClick={onClick} className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white shadow-lg hover:shadow-xl hover:shadow-purple-500/10 transition-shadow transform hover:-translate-y-1 cursor-pointer">
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

function aplicarFiltroData(dados, filtros) {
  if (!filtros?.dataInicio || !filtros?.dataFim) return dados;
  const { dataInicio, dataFim } = filtros;
  return {
    ...dados,
    vendas: (dados.vendas || []).filter(v => v.data_venda >= dataInicio && v.data_venda <= dataFim),
    orcamentos: (dados.orcamentos || []).filter(o => o.data_orcamento >= dataInicio && o.data_orcamento <= dataFim),
    interacoes: (dados.interacoes || []).filter(i => i.data_interacao?.slice(0,10) >= dataInicio && i.data_interacao?.slice(0,10) <= dataFim),
  };
}

// Função para calcular métricas operacionais com dados reais
const STATUS_FECHADOS = ['aprovado', 'rejeitado', 'vencido'];
const ehAberto = (o) => !STATUS_FECHADOS.includes((o.status || '').toLowerCase());

function calcularMetricasOperacionais(dados, dadosCompletos) {
  const totalOrcamentos = dados.orcamentos.length;
  const aprovados = dados.orcamentos.filter(o => (o.status || '').toLowerCase() === 'aprovado');
  const orcamentosAprovados = aprovados.length;
  // Vendas fechadas = orçamentos aprovados (entidade Venda não é usada; vendas reais = NFes/aprovações)
  const vendasFechadas = orcamentosAprovados;
  const taxaConversao = totalOrcamentos > 0 ? Math.round((orcamentosAprovados / totalOrcamentos) * 100) : 0;

  // Tempo médio de fechamento calculado das datas reais dos aprovados
  const temposFechamento = aprovados
    .map(o => {
      const inicio = new Date(o.data_orcamento || o.created_date);
      const fim = new Date(o.updated_date || o.created_date);
      const dias = Math.round((fim - inicio) / 86400000);
      return dias >= 0 && dias < 365 ? dias : null;
    })
    .filter(d => d !== null);
  const tempoMedioFechamento = temposFechamento.length > 0
    ? Math.round(temposFechamento.reduce((a, b) => a + b, 0) / temposFechamento.length)
    : 0;
  const orcamentosAtivos = dados.orcamentos.filter(ehAberto).length;
  const valorFunilAtivo = dados.orcamentos
    .filter(ehAberto)
    .reduce((acc, o) => acc + (o.valor_total || 0), 0);

  // Cálculo real das atividades baseado nas interações
  const hoje = new Date().toISOString().slice(0, 10);
  const semanaPassada = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  
  const interacoesHoje = dados.interacoes.filter(i => 
    i.data_interacao?.slice(0, 10) === hoje
  );
  
  const interacoesSemana = dados.interacoes.filter(i => 
    i.data_interacao?.slice(0, 10) >= semanaPassada
  );

  const ligacoesHoje = interacoesHoje.filter(i => i.tipo_interacao === 'ligacao').length;
  const whatsappSemana = interacoesSemana.filter(i => i.tipo_interacao === 'whatsapp').length;
  const emailsSemana = interacoesSemana.filter(i => i.tipo_interacao === 'email').length;
  const reunioesSemana = interacoesSemana.filter(i => i.tipo_interacao === 'reuniao').length;
  
  const atividadesHoje = interacoesHoje.length;

  // Funil de vendas com dados reais
  const totalValorOrcamentos = dados.orcamentos.reduce((acc, o) => acc + (o.valor_total || 0), 0);
  const valorOrcamentosAberto = valorFunilAtivo;
  const valorVendasFechadas = aprovados.reduce((acc, o) => acc + (o.valor_total || 0), 0);

  const funil = [
    {
      nome: 'Orçamentos Criados',
      quantidade: dados.orcamentos.length,
      valor: totalValorOrcamentos,
      percentual: 100,
      icon: Clock,
      cor: 'text-blue-400',
      bg: 'from-blue-500 to-blue-600'
    },
    {
      nome: 'Em Negociação',
      quantidade: orcamentosAtivos,
      valor: valorOrcamentosAberto,
      percentual: totalOrcamentos > 0 ? Math.round((orcamentosAtivos / totalOrcamentos) * 100) : 0,
      icon: TrendingUp,
      cor: 'text-yellow-400',
      bg: 'from-yellow-500 to-yellow-600'
    },
    {
      nome: 'Vendas Fechadas',
      quantidade: vendasFechadas,
      valor: valorVendasFechadas,
      percentual: totalOrcamentos > 0 ? Math.round((vendasFechadas / totalOrcamentos) * 100) : 0,
      icon: CheckCircle,
      cor: 'text-green-400',
      bg: 'from-green-500 to-green-600'
    }
  ];

  // Performance mensal baseada em dados reais
  const vendasPorMes = {};
  const orcamentosPorMes = {};

  (dadosCompletos?.vendas || dados.vendas).forEach(venda => {
    if (venda.data_venda) {
      const mes = venda.data_venda.slice(0, 7);
      vendasPorMes[mes] = (vendasPorMes[mes] || 0) + 1;
    }
  });

  (dadosCompletos?.orcamentos || dados.orcamentos).forEach(orc => {
    if (orc.data_orcamento) {
      const mes = orc.data_orcamento.slice(0, 7);
      orcamentosPorMes[mes] = (orcamentosPorMes[mes] || 0) + 1;
    }
  });

  const mesesUnicos = [...new Set([...Object.keys(vendasPorMes), ...Object.keys(orcamentosPorMes)])].sort();
  const performanceMensal = mesesUnicos.slice(-5).map(mes => ({
    mes: new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
    vendas: vendasPorMes[mes] || 0,
    orcamentos: orcamentosPorMes[mes] || 0
  }));

  // Status dos orçamentos com dados reais (enums minúsculos do banco → rótulos)
  const ROTULOS_STATUS = {
    rascunho: 'Rascunho', aguardando_cotacao: 'Aguardando Cotação', cotando: 'Cotando',
    aguardando_analise: 'Aguardando Análise', analisando: 'Analisando',
    aguardando_liberacao: 'Aguardando Liberação', liberado: 'Liberado', enviado: 'Enviado',
    negociando: 'Negociando', aprovado: 'Aprovado', rejeitado: 'Rejeitado', vencido: 'Vencido'
  };
  const statusCount = {};
  dados.orcamentos.forEach(orc => {
    const raw = (orc.status || 'rascunho').toLowerCase();
    if (!statusCount[raw]) {
      statusCount[raw] = { quantidade: 0, valor: 0 };
    }
    statusCount[raw].quantidade++;
    statusCount[raw].valor += orc.valor_total || 0;
  });

  const statusOrcamentos = Object.entries(statusCount).map(([raw, dados]) => ({
    status: ROTULOS_STATUS[raw] || raw,
    tipo: raw === 'aprovado' ? 'aprovado' : raw === 'rejeitado' ? 'rejeitado' : raw === 'vencido' ? 'vencido' : 'aberto',
    quantidade: dados.quantidade,
    valor: dados.valor
  })).sort((a, b) => b.quantidade - a.quantidade);

  // Atividades da semana com dados reais
  const atividadesSemana = [
    { 
      tipo: 'ligacao', 
      nome: 'Ligações',
      quantidade: interacoesSemana.filter(i => i.tipo_interacao === 'ligacao').length,
      descricao: 'Ligações realizadas',
      periodo: 'esta semana'
    },
    { 
      tipo: 'whatsapp', 
      nome: 'WhatsApp',
      quantidade: whatsappSemana,
      descricao: 'Mensagens enviadas',
      periodo: 'esta semana'
    },
    { 
      tipo: 'email', 
      nome: 'E-mails',
      quantidade: emailsSemana,
      descricao: 'E-mails enviados',
      periodo: 'esta semana'
    },
    { 
      tipo: 'reuniao', 
      nome: 'Reuniões',
      quantidade: reunioesSemana,
      descricao: 'Reuniões realizadas',
      periodo: 'esta semana'
    }
  ];

  // Próximas ações baseadas em interações agendadas
  const proximasAcoes = dados.interacoes
    .filter(i => i.data_proximo_contato && new Date(i.data_proximo_contato) > new Date())
    .sort((a, b) => new Date(a.data_proximo_contato) - new Date(b.data_proximo_contato))
    .slice(0, 6)
    .map(i => ({
      cliente: i.cliente_nome,
      acao: i.proximo_passo || 'Contato de follow-up',
      prazo: calcularPrazo(i.data_proximo_contato),
      vendedor: i.vendedor
    }));

  // Se não há interações com próximas ações, criar algumas baseadas em orçamentos
  if (proximasAcoes.length < 3) {
    const orcamentosEmAberto = dados.orcamentos
      .filter(ehAberto)
      .slice(0, 5 - proximasAcoes.length);
    
    orcamentosEmAberto.forEach(orc => {
      proximasAcoes.push({
        cliente: orc.cliente_nome,
        acao: orc.proximo_passo || 'Follow-up orçamento',
        prazo: calcularPrazoOrcamento(orc.data_orcamento),
        vendedor: orc.vendedor
      });
    });
  }

  return {
    taxaConversao,
    vendasFechadas,
    totalOrcamentos,
    tempoMedioFechamento,
    orcamentosAtivos,
    valorFunilAtivo,
    atividadesHoje,
    ligacoesHoje,
    funil,
    performanceMensal,
    statusOrcamentos,
    atividadesSemana,
    proximasAcoes,
    listaOrcamentos: dados.orcamentos,
    listaAprovados: aprovados,
    listaAbertos: dados.orcamentos.filter(ehAberto),
    listaInteracoesHoje: interacoesHoje
  };
}

// Funções auxiliares
function calcularPrazo(dataProximoContato) {
  const hoje = new Date();
  const dataContato = new Date(dataProximoContato);
  const diffTime = dataContato - hoje;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays <= 7) return `${diffDays} dias`;
  return `${Math.ceil(diffDays / 7)} semanas`;
}

function calcularPrazoOrcamento(dataOrcamento) {
  const hoje = new Date();
  const dataOrc = new Date(dataOrcamento);
  const diffTime = hoje - dataOrc;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 3) return 'Urgente';
  if (diffDays <= 7) return 'Esta semana';
  if (diffDays <= 14) return '2 semanas';
  return 'Mais de 2 semanas';
}