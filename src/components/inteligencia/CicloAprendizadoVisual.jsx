import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Brain,
  TrendingUp,
  Target,
  Zap,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  BarChart3,
  RefreshCw,
  Lightbulb
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CICLO DE APRENDIZADO VISUAL                                ║
 * ║  Mostra em TEMPO REAL como a IA está aprendendo            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export default function CicloAprendizadoVisual() {
  const [metricas, setMetricas] = useState(null);
  const [aprendizadosRecentes, setAprendizadosRecentes] = useState([]);
  const [melhorias, setMelhorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [evolucaoTemporal, setEvolucaoTemporal] = useState([]);

  useEffect(() => {
    carregarDadosAprendizado();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(carregarDadosAprendizado, 30000);
    return () => clearInterval(interval);
  }, []);

  const carregarDadosAprendizado = async () => {
    try {
      setCarregando(true);

      // ═══════════════════════════════════════════════════════════
      // 1. BUSCAR APRENDIZADOS RECENTES DA NKDB
      // ═══════════════════════════════════════════════════════════
      const conhecimentos = await base44.entities.BaseConhecimento.filter({
        tipo_registro: 'aprendizado_ia'
      }, '-created_date', 50);

      setAprendizadosRecentes(conhecimentos.slice(0, 10));

      // ═══════════════════════════════════════════════════════════
      // 2. CALCULAR MÉTRICAS DE APRENDIZADO
      // ═══════════════════════════════════════════════════════════
      const totalConhecimentos = await base44.entities.BaseConhecimento.list();
      
      const conhecimentosPorTipo = totalConhecimentos.reduce((acc, c) => {
        acc[c.tipo_registro] = (acc[c.tipo_registro] || 0) + 1;
        return acc;
      }, {});

      const conhecimentosComTaxaSucesso = totalConhecimentos.filter(c => 
        c.taxa_sucesso !== null && c.taxa_sucesso !== undefined
      );

      const taxaSucessoMedia = conhecimentosComTaxaSucesso.length > 0
        ? conhecimentosComTaxaSucesso.reduce((sum, c) => sum + c.taxa_sucesso, 0) / conhecimentosComTaxaSucesso.length
        : 0;

      const conhecimentosUtilizados = totalConhecimentos.filter(c => c.vezes_utilizado > 0);
      const taxaUtilizacao = totalConhecimentos.length > 0
        ? (conhecimentosUtilizados.length / totalConhecimentos.length) * 100
        : 0;

      // ═══════════════════════════════════════════════════════════
      // 3. IDENTIFICAR MELHORIAS DETECTADAS
      // ═══════════════════════════════════════════════════════════
      const melhorias = conhecimentos
        .filter(c => c.conteudo_estruturado?.melhoria_percentual > 0)
        .map(c => ({
          titulo: c.titulo,
          melhoria: c.conteudo_estruturado.melhoria_percentual,
          area: c.categoria,
          data: c.created_date
        }))
        .sort((a, b) => b.melhoria - a.melhoria)
        .slice(0, 5);

      setMelhorias(melhorias);

      // ═══════════════════════════════════════════════════════════
      // 4. EVOLUÇÃO TEMPORAL (últimos 7 dias)
      // ═══════════════════════════════════════════════════════════
      const ultimos7Dias = [];
      for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        const dataStr = data.toISOString().split('T')[0];
        
        const conhecimentosDoDia = totalConhecimentos.filter(c => {
          const cData = new Date(c.created_date).toISOString().split('T')[0];
          return cData === dataStr;
        });

        const taxaSucessoDia = conhecimentosDoDia.filter(c => c.taxa_sucesso).length > 0
          ? conhecimentosDoDia.reduce((sum, c) => sum + (c.taxa_sucesso || 0), 0) / conhecimentosDoDia.filter(c => c.taxa_sucesso).length
          : 0;

        ultimos7Dias.push({
          data: `${data.getDate()}/${data.getMonth() + 1}`,
          novosConhecimentos: conhecimentosDoDia.length,
          taxaSucesso: Math.round(taxaSucessoDia)
        });
      }

      setEvolucaoTemporal(ultimos7Dias);

      setMetricas({
        totalConhecimentos: totalConhecimentos.length,
        conhecimentosPorTipo,
        taxaSucessoMedia: Math.round(taxaSucessoMedia),
        taxaUtilizacao: Math.round(taxaUtilizacao),
        conhecimentosNovosHoje: totalConhecimentos.filter(c => {
          const hoje = new Date().toISOString().split('T')[0];
          const cData = new Date(c.created_date).toISOString().split('T')[0];
          return cData === hoje;
        }).length
      });

    } catch (error) {
      console.error('[CicloAprendizado] Erro ao carregar dados:', error);
      toast.error('Erro ao carregar métricas de aprendizado');
    } finally {
      setCarregando(false);
    }
  };

  if (carregando && !metricas) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Brain className="w-12 h-12 text-purple-600 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-600">Analisando ciclo de aprendizado...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Ciclo de Aprendizado Contínuo</h2>
            <p className="text-sm text-slate-600">A IA fica mais inteligente a cada interação</p>
          </div>
        </div>
        <Button onClick={carregarDadosAprendizado} disabled={carregando} variant="outline" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Base de Conhecimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{metricas?.totalConhecimentos || 0}</div>
            <p className="text-xs text-blue-600 mt-1">
              +{metricas?.conhecimentosNovosHoje || 0} hoje
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Taxa de Sucesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{metricas?.taxaSucessoMedia || 0}%</div>
            <p className="text-xs text-green-600 mt-1">Decisões assertivas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-900 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Taxa de Utilização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">{metricas?.taxaUtilizacao || 0}%</div>
            <p className="text-xs text-purple-600 mt-1">Conhecimento ativo</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-900 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Melhorias Detectadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">{melhorias.length}</div>
            <p className="text-xs text-amber-600 mt-1">Últimas 24h</p>
          </CardContent>
        </Card>
      </div>

      {/* Evolução Temporal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Evolução do Aprendizado (Últimos 7 Dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={evolucaoTemporal}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="data" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="novosConhecimentos"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Novos Conhecimentos"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="taxaSucesso"
                stroke="#10b981"
                strokeWidth={2}
                name="Taxa de Sucesso (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Melhorias Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Melhorias Detectadas pela IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {melhorias.length > 0 ? (
              <div className="space-y-3">
                {melhorias.map((melhoria, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{melhoria.titulo}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {melhoria.area} • {new Date(melhoria.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Badge className="bg-green-600 text-white">
                      +{Math.round(melhoria.melhoria)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600 text-center py-8">
                Nenhuma melhoria detectada ainda. A IA está coletando dados...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Aprendizados Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-600" />
              Últimos Aprendizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aprendizadosRecentes.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {aprendizadosRecentes.map((aprendizado) => (
                  <div key={aprendizado.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Brain className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{aprendizado.titulo}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {aprendizado.categoria}
                        </Badge>
                        {aprendizado.confianca_ia && (
                          <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                            {aprendizado.confianca_ia}% confiança
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600 text-center py-8">
                Nenhum aprendizado registrado ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ciclo de Feedback */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-900">
            <ArrowRight className="w-5 h-5" />
            Como Funciona o Ciclo de Aprendizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold">1</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">Ação Executada</p>
              <p className="text-xs text-slate-600 mt-1">
                IA toma uma decisão ou recomendação
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold">2</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">Resultado Medido</p>
              <p className="text-xs text-slate-600 mt-1">
                Sistema captura sucesso ou falha
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold">3</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">Conhecimento Armazenado</p>
              <p className="text-xs text-slate-600 mt-1">
                Padrões salvos na NKDB
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold">4</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">IA se Auto-Otimiza</p>
              <p className="text-xs text-slate-600 mt-1">
                Decisões futuras são mais assertivas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}