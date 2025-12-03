import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Target,
  BarChart3,
  Settings,
  RefreshCw
} from 'lucide-react';
import { MotorPrecificacao } from './MotorPrecificacao';
import { Produto } from '@/entities/Produto';
import { ConfiguracaoPrecificacao } from '@/entities/ConfiguracaoPrecificacao';

export default function DashboardPrecificacao() {
  const [analisePortfolio, setAnalisePortfolio] = useState(null);
  const [configuracao, setConfiguracao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [atualizandoCambio, setAtualizandoCambio] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [produtos, config] = await Promise.all([
        Produto.list(),
        MotorPrecificacao.obterConfiguracaoAtiva()
      ]);

      if (produtos.length > 0) {
        const analise = await MotorPrecificacao.analisarPortfolio(produtos);
        setAnalisePortfolio(analise);
      }
      
      setConfiguracao(config);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setLoading(false);
  };

  const handleAtualizarCambio = async () => {
    setAtualizandoCambio(true);
    try {
      await MotorPrecificacao.atualizarTaxasCambio();
      await carregarDados();
    } catch (error) {
      console.error('Erro ao atualizar câmbio:', error);
    }
    setAtualizandoCambio(false);
  };

  const formatCurrency = (value) => 
    (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatPercent = (value) => 
    `${(value || 0).toFixed(1)}%`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-indigo-500 animate-pulse mx-auto mb-4" />
          <p className="text-slate-600">Analisando precificação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Indicadores Principais */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard de Precificação</h1>
            <p className="text-indigo-100 mt-1">
              Análise completa de custos e margens do seu portfólio
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="secondary" 
              onClick={handleAtualizarCambio}
              disabled={atualizandoCambio}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${atualizandoCambio ? 'animate-spin' : ''}`} />
              Atualizar Câmbio
            </Button>
            <Button variant="secondary">
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
          </div>
        </div>
      </div>

      {/* Resumo Executivo */}
      {analisePortfolio && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Margem Média Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {formatPercent(analisePortfolio.resumo.margem_media_portfolio)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {analisePortfolio.resumo.margem_media_portfolio >= 30 ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span className="text-xs text-slate-500">
                  {analisePortfolio.resumo.margem_media_portfolio >= 30 ? 'Excelente' : 'Atenção'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Valor Total Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(analisePortfolio.resumo.valor_total_portfolio)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Custo: {formatCurrency(analisePortfolio.resumo.custo_total_portfolio)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Produtos Alta Margem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {analisePortfolio.resumo.produtos_alta_margem}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {((analisePortfolio.resumo.produtos_alta_margem / analisePortfolio.resumo.total_produtos) * 100).toFixed(1)}% do portfólio
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Produtos Baixa Margem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {analisePortfolio.resumo.produtos_baixa_margem}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Requer atenção na precificação
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configurações Atuais */}
      {configuracao && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuração Ativa: {configuracao.nome_configuracao}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
              <div>
                <span className="font-medium text-slate-600">USD:</span>
                <div className="text-lg font-bold">R$ {configuracao.taxa_cambio_usd}</div>
              </div>
              <div>
                <span className="font-medium text-slate-600">EUR:</span>
                <div className="text-lg font-bold">R$ {configuracao.taxa_cambio_eur}</div>
              </div>
              <div>
                <span className="font-medium text-slate-600">Frete Import.:</span>
                <div className="text-lg font-bold">{configuracao.percentual_frete_importado}%</div>
              </div>
              <div>
                <span className="font-medium text-slate-600">Impostos Import.:</span>
                <div className="text-lg font-bold">{configuracao.percentual_impostos_importados}%</div>
              </div>
              <div>
                <span className="font-medium text-slate-600">Margem Varejo:</span>
                <div className="text-lg font-bold">{configuracao.margem_varejo}%</div>
              </div>
              <div>
                <span className="font-medium text-slate-600">Custo Operacional:</span>
                <div className="text-lg font-bold">{configuracao.custo_operacional_percentual}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análise Detalhada por Tabs */}
      {analisePortfolio && (
        <Tabs defaultValue="produtos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="categorias">Por Categoria</TabsTrigger>
            <TabsTrigger value="fornecedores">Por Fornecedor</TabsTrigger>
            <TabsTrigger value="alertas">Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos">
            <Card>
              <CardHeader>
                <CardTitle>Análise Individual de Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3">Produto</th>
                        <th className="text-right p-3">Custo Total</th>
                        <th className="text-right p-3">Preço Varejo</th>
                        <th className="text-center p-3">Margem</th>
                        <th className="text-center p-3">Classificação</th>
                        <th className="text-left p-3">Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analisePortfolio.produtos.slice(0, 10).map((produto, index) => (
                        <tr key={index} className="border-b hover:bg-slate-50">
                          <td className="p-3">
                            <div className="font-medium">{produto.nome_produto}</div>
                          </td>
                          <td className="p-3 text-right font-mono">
                            {formatCurrency(produto.custo_total)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            {formatCurrency(produto.preco_varejo)}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant={
                              produto.margem_real_varejo >= 35 ? 'default' :
                              produto.margem_real_varejo >= 20 ? 'secondary' : 'destructive'
                            }>
                              {formatPercent(produto.margem_real_varejo)}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline">
                              {produto.classificacao_margem}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              {produto.observacoes.slice(0, 2).map((obs, i) => (
                                <div key={i} className="text-xs text-slate-600">{obs}</div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {analisePortfolio.produtos.length > 10 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline">
                      Ver Todos os {analisePortfolio.produtos.length} Produtos
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alertas">
            <div className="grid gap-4">
              {/* Produtos com Baixa Margem */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                    Produtos com Baixa Margem (&lt;15%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analisePortfolio.produtos.filter(p => p.margem_real_varejo < 15).length === 0 ? (
                    <p className="text-slate-500">Nenhum produto com margem crítica!</p>
                  ) : (
                    <div className="space-y-2">
                      {analisePortfolio.produtos.filter(p => p.margem_real_varejo < 15).map((produto, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <div>
                            <div className="font-medium">{produto.nome_produto}</div>
                            <div className="text-sm text-slate-600">
                              Margem: {formatPercent(produto.margem_real_varejo)}
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            Revisar Preço
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Produtos Não Competitivos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <TrendingDown className="w-5 h-5" />
                    Produtos Não Competitivos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analisePortfolio.produtos.filter(p => !p.preco_competitivo).length === 0 ? (
                    <p className="text-slate-500">Todos os produtos estão competitivos!</p>
                  ) : (
                    <div className="space-y-2">
                      {analisePortfolio.produtos.filter(p => !p.preco_competitivo).map((produto, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                          <div>
                            <div className="font-medium">{produto.nome_produto}</div>
                            <div className="text-sm text-slate-600">
                              Preço acima do mercado
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            Analisar Concorrência
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}