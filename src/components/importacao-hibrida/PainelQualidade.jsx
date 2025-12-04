import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, Target, AlertTriangle, CheckCircle, TrendingUp, BarChart3,
  Clock, Award, Users, FileText, Zap, Activity
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";

export default function PainelQualidade({ documentos, tiposDocumento }) {
  const metricas = calcularMetricasQualidade(documentos, tiposDocumento);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Painel de Qualidade</h2>
          <p className="text-slate-600">Análise da performance e aprendizado da IA</p>
        </div>
      </div>

      {/* KPIs de Qualidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QualityKPI
          titulo="Taxa de Acerto"
          valor={`${metricas.taxaAcerto}%`}
          variacao={+5.2}
          icon={Target}
          cor="emerald"
        />
        <QualityKPI
          titulo="Confiança Média"
          valor={`${metricas.confiancaMedia}%`}
          variacao={+2.8}
          icon={Brain}
          cor="blue"
        />
        <QualityKPI
          titulo="Intervenção Humana"
          valor={`${metricas.taxaIntervencao}%`}
          variacao={-1.5}
          icon={Users}
          cor="orange"
        />
        <QualityKPI
          titulo="Tempo Médio"
          valor={`${metricas.tempoMedio}s`}
          variacao={-8.3}
          icon={Zap}
          cor="purple"
        />
      </div>

      {/* Gráficos e Análises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Status dos Documentos */}
        <Card className="bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Status dos Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={metricas.distribuicaoStatus}
                  dataKey="quantidade"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({percent}) => `${(percent * 100).toFixed(0)}%`}
                >
                  {metricas.distribuicaoStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="mt-4 space-y-2">
              {metricas.distribuicaoStatus.map((status, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full`} style={{backgroundColor: getStatusColor(status.status)}} />
                    <span className="font-medium capitalize">{status.status.replace('_', ' ')}</span>
                  </div>
                  <span className="font-bold">{status.quantidade}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance por Tipo */}
        <Card className="bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              Performance por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metricas.performancePorTipo} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="tipo" width={100} />
                <Tooltip formatter={(value) => [`${value}%`, 'Confiança Média']} />
                <Bar dataKey="confiancaMedia" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolução da Qualidade */}
        <Card className="bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Evolução da Qualidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={metricas.evolucaoQualidade}>
                <defs>
                  <linearGradient id="qualidade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, 'Taxa de Acerto']} />
                <Area type="monotone" dataKey="taxaAcerto" stroke="#3b82f6" fill="url(#qualidade)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Correções */}
        <Card className="bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-600" />
              Padrões de Correção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metricas.topCorrecoes.map((correcao, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-800">{correcao.campo}</span>
                      <Badge variant="outline" className="text-xs">{correcao.tipo}</Badge>
                    </div>
                    <Progress value={(correcao.frequencia / metricas.topCorrecoes[0]?.frequencia) * 100} className="h-2" />
                  </div>
                  <div className="ml-4 text-right">
                    <div className="font-bold text-slate-800">{correcao.frequencia}</div>
                    <div className="text-xs text-slate-500">correções</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights e Recomendações */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-900">
            <Brain className="w-5 h-5" />
            Insights de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-indigo-800 mb-2">📈 Melhorias Detectadas</h4>
              <ul className="space-y-1 text-sm text-indigo-700">
                <li>• Taxa de acerto aumentou 12% no último mês</li>
                <li>• Confiança em documentos "Nota Fiscal" melhorou significativamente</li>
                <li>• Tempo de processamento reduzido em 25%</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-indigo-800 mb-2">🎯 Recomendações</h4>
              <ul className="space-y-1 text-sm text-indigo-700">
                <li>• Adicionar mais exemplos para tipo "Contrato"</li>
                <li>• Revisar regras de validação para campo "CNPJ"</li>
                <li>• Considerar novo tipo para "Relatórios de Vendas"</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente para KPIs de Qualidade
function QualityKPI({ titulo, valor, variacao, icon: Icon, cor }) {
  const cores = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600'
  };

  return (
    <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${cores[cor]} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {variacao !== undefined && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              variacao >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <TrendingUp className={`w-3 h-3 ${variacao < 0 ? 'rotate-180' : ''}`} />
              {Math.abs(variacao)}%
            </div>
          )}
        </div>
        <div>
          <h3 className="text-xs font-medium text-slate-600 mb-1">{titulo}</h3>
          <p className="text-xl font-bold text-slate-900">{valor}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Funções auxiliares
function getStatusColor(status) {
  const cores = {
    'validado': '#10b981',
    'extraido': '#3b82f6',
    'revisao_necessaria': '#f59e0b',
    'processando': '#6b7280',
    'erro': '#ef4444',
    'pendente': '#9ca3af'
  };
  return cores[status] || '#6b7280';
}

function calcularMetricasQualidade(documentos, tiposDocumento) {
  const total = documentos.length;
  if (total === 0) {
    return {
      taxaAcerto: 0,
      confiancaMedia: 0,
      taxaIntervencao: 0,
      tempoMedio: 0,
      distribuicaoStatus: [],
      performancePorTipo: [],
      evolucaoQualidade: [],
      topCorrecoes: []
    };
  }

  // Taxa de acerto (documentos validados vs total)
  const validados = documentos.filter(d => d.status_processamento === 'validado').length;
  const taxaAcerto = Math.round((validados / total) * 100);

  // Confiança média
  const confiancas = documentos
    .filter(d => d.metadados_processamento?.confianca_geral)
    .map(d => d.metadados_processamento.confianca_geral);
  const confiancaMedia = confiancas.length > 0 ? Math.round(confiancas.reduce((a, b) => a + b, 0) / confiancas.length) : 0;

  // Taxa de intervenção humana
  const comIntervencao = documentos.filter(d => d.historico_correcoes?.length > 0).length;
  const taxaIntervencao = Math.round((comIntervencao / total) * 100);

  // Tempo médio de processamento
  const tempos = documentos
    .filter(d => d.metadados_processamento?.tempo_processamento_ms)
    .map(d => d.metadados_processamento.tempo_processamento_ms);
  const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length / 1000) : 0;

  // Distribuição por status
  const statusCount = documentos.reduce((acc, doc) => {
    const status = doc.status_processamento || 'pendente';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const distribuicaoStatus = Object.entries(statusCount).map(([status, quantidade]) => ({
    status,
    quantidade
  }));

  // Performance por tipo
  const tipoStats = documentos.reduce((acc, doc) => {
    if (doc.tipos_detectados?.length > 0) {
      const tipo = doc.tipos_detectados[0];
      if (!acc[tipo.tipo_codigo]) {
        acc[tipo.tipo_codigo] = { confiancas: [], total: 0 };
      }
      acc[tipo.tipo_codigo].confiancas.push(tipo.confianca || 0);
      acc[tipo.tipo_codigo].total++;
    }
    return acc;
  }, {});

  const performancePorTipo = Object.entries(tipoStats).map(([codigo, stats]) => {
    const tipoObj = tiposDocumento.find(t => t.codigo === codigo);
    return {
      tipo: tipoObj?.nome || codigo,
      confiancaMedia: Math.round(stats.confiancas.reduce((a, b) => a + b, 0) / stats.confiancas.length),
      total: stats.total
    };
  }).sort((a, b) => b.confiancaMedia - a.confiancaMedia);

  // Evolução da qualidade (simulado)
  const evolucaoQualidade = [
    { periodo: 'Sem 1', taxaAcerto: Math.max(0, taxaAcerto - 15) },
    { periodo: 'Sem 2', taxaAcerto: Math.max(0, taxaAcerto - 10) },
    { periodo: 'Sem 3', taxaAcerto: Math.max(0, taxaAcerto - 5) },
    { periodo: 'Sem 4', taxaAcerto: taxaAcerto },
  ];

  // Top correções (simulado baseado em histórico)
  const todasCorrecoes = documentos.flatMap(d => d.historico_correcoes || []);
  const correcoesPorCampo = todasCorrecoes.reduce((acc, correcao) => {
    if (!acc[correcao.campo_alterado]) {
      acc[correcao.campo_alterado] = { frequencia: 0, tipos: new Set() };
    }
    acc[correcao.campo_alterado].frequencia++;
    acc[correcao.campo_alterado].tipos.add(correcao.tipo_alteracao);
    return acc;
  }, {});

  const topCorrecoes = Object.entries(correcoesPorCampo)
    .map(([campo, data]) => ({
      campo,
      frequencia: data.frequencia,
      tipo: Array.from(data.tipos)[0] || 'correcao_campo'
    }))
    .sort((a, b) => b.frequencia - a.frequencia)
    .slice(0, 5);

  return {
    taxaAcerto,
    confiancaMedia,
    taxaIntervencao,
    tempoMedio,
    distribuicaoStatus,
    performancePorTipo,
    evolucaoQualidade,
    topCorrecoes
  };
}