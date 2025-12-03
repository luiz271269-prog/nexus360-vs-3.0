import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { MotorPrecificacao } from './MotorPrecificacao';

export default function SimuladorPrecificacao({ produto, onPriceUpdate }) {
  const [simulacao, setSimulacao] = useState(null);
  const [cenarios, setCenarios] = useState(null);
  const [produtoSimulado, setProdutoSimulado] = useState({
    nome: produto?.nome || 'Produto Teste',
    preco_original: produto?.preco_custo || 100,
    moeda_original: produto?.moeda_original || 'BRL',
    categoria: produto?.categoria || 'Hardware',
    fornecedor: produto?.fornecedor || 'Fornecedor Teste'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (produto) {
      setProdutoSimulado({
        nome: produto.nome,
        preco_original: produto.preco_custo || produto.preco_original || 0,
        moeda_original: produto.moeda_original || 'BRL',
        categoria: produto.categoria || 'Hardware',
        fornecedor: produto.fornecedor || ''
      });
    }
  }, [produto]);

  const simularPrecificacao = async () => {
    setLoading(true);
    try {
      const resultado = await MotorPrecificacao.calcularCustoReal(produtoSimulado);
      setSimulacao(resultado);

      // Simular cenários
      const resultadoCenarios = await MotorPrecificacao.simularCenarios(produtoSimulado, {
        com_desconto: true,
        cambio_alta: produtoSimulado.moeda_original !== 'BRL',
        otimista: true
      });
      setCenarios(resultadoCenarios);
    } catch (error) {
      console.error('Erro na simulação:', error);
    }
    setLoading(false);
  };

  const handleInputChange = (field, value) => {
    setProdutoSimulado(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCurrency = (value) => 
    (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatPercent = (value) => 
    `${(value || 0).toFixed(1)}%`;

  const aplicarPreco = (tipo) => {
    if (!simulacao || !onPriceUpdate) return;
    
    let precoEscolhido;
    switch (tipo) {
      case 'atacado':
        precoEscolhido = simulacao.preco_atacado;
        break;
      case 'corporativo':
        precoEscolhido = simulacao.preco_corporativo;
        break;
      default:
        precoEscolhido = simulacao.preco_varejo;
    }

    onPriceUpdate({
      preco_custo: simulacao.custo_total,
      preco_venda: precoEscolhido,
      margem_lucro: tipo === 'atacado' ? simulacao.margem_real_atacado :
                    tipo === 'corporativo' ? simulacao.margem_real_corporativo :
                    simulacao.margem_real_varejo
    });
  };

  return (
    <div className="space-y-6">
      {/* Configuração da Simulação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Simulador de Precificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do Produto</Label>
              <Input
                value={produtoSimulado.nome}
                onChange={(e) => handleInputChange('nome', e.target.value)}
              />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input
                value={produtoSimulado.fornecedor}
                onChange={(e) => handleInputChange('fornecedor', e.target.value)}
              />
            </div>
            <div>
              <Label>Preço de Custo/Origem</Label>
              <Input
                type="number"
                step="0.01"
                value={produtoSimulado.preco_original}
                onChange={(e) => handleInputChange('preco_original', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Moeda</Label>
              <Select 
                value={produtoSimulado.moeda_original}
                onValueChange={(value) => handleInputChange('moeda_original', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (BRL)</SelectItem>
                  <SelectItem value="USD">Dólar (USD)</SelectItem>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button onClick={simularPrecificacao} disabled={loading} className="w-full">
            {loading ? 'Calculando...' : 'Simular Precificação'}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados da Simulação */}
      {simulacao && (
        <Tabs defaultValue="resultado" className="space-y-4">
          <TabsList>
            <TabsTrigger value="resultado">Resultado</TabsTrigger>
            <TabsTrigger value="detalhamento">Detalhamento</TabsTrigger>
            {cenarios && <TabsTrigger value="cenarios">Cenários</TabsTrigger>}
          </TabsList>

          <TabsContent value="resultado">
            <div className="grid gap-4">
              {/* Preços por Segmento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Varejo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {formatCurrency(simulacao.preco_varejo)}
                    </div>
                    <div className="text-sm text-slate-600 mb-3">
                      Margem: {formatPercent(simulacao.margem_real_varejo)}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => aplicarPreco('varejo')}
                      className="w-full"
                    >
                      Aplicar Preço
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Atacado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      {formatCurrency(simulacao.preco_atacado)}
                    </div>
                    <div className="text-sm text-slate-600 mb-3">
                      Margem: {formatPercent(simulacao.margem_real_atacado)}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => aplicarPreco('atacado')}
                      className="w-full"
                    >
                      Aplicar Preço
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Corporativo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600 mb-2">
                      {formatCurrency(simulacao.preco_corporativo)}
                    </div>
                    <div className="text-sm text-slate-600 mb-3">
                      Margem: {formatPercent(simulacao.margem_real_corporativo)}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => aplicarPreco('corporativo')}
                      className="w-full"
                    >
                      Aplicar Preço
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Alertas */}
              {simulacao.observacoes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Observações e Alertas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {simulacao.observacoes.map((obs, index) => (
                        <div key={index} className="flex items-center gap-2">
                          {obs.includes('⚠️') ? (
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-blue-500" />
                          )}
                          <span className="text-sm">{obs}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="detalhamento">
            <Card>
              <CardHeader>
                <CardTitle>Composição do Custo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-slate-600">Preço Fornecedor:</span>
                      <div className="text-lg">{simulacao.moeda_original} {simulacao.preco_fornecedor}</div>
                    </div>
                    {simulacao.conversao_moeda > 0 && (
                      <div>
                        <span className="font-medium text-slate-600">Conversão Moeda:</span>
                        <div className="text-lg">{formatCurrency(simulacao.conversao_moeda)}</div>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-slate-600">Frete:</span>
                      <div className="text-lg">{formatCurrency(simulacao.custo_frete)}</div>
                    </div>
                    <div>
                      <span className="font-medium text-slate-600">Impostos:</span>
                      <div className="text-lg">{formatCurrency(simulacao.custo_impostos)}</div>
                    </div>
                    <div>
                      <span className="font-medium text-slate-600">Custo Operacional:</span>
                      <div className="text-lg">{formatCurrency(simulacao.custo_operacional)}</div>
                    </div>
                    <div className="border-t pt-2">
                      <span className="font-bold text-slate-800">Custo Total:</span>
                      <div className="text-xl font-bold">{formatCurrency(simulacao.custo_total)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {cenarios && (
            <TabsContent value="cenarios">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Comparação de Cenários</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-3">Cenário</th>
                            <th className="text-right p-3">Custo Total</th>
                            <th className="text-right p-3">Preço Varejo</th>
                            <th className="text-center p-3">Margem</th>
                            <th className="text-center p-3">Diferença</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-3 font-medium">Atual</td>
                            <td className="p-3 text-right">{formatCurrency(cenarios.atual.custo_total)}</td>
                            <td className="p-3 text-right">{formatCurrency(cenarios.atual.preco_varejo)}</td>
                            <td className="p-3 text-center">{formatPercent(cenarios.atual.margem_real_varejo)}</td>
                            <td className="p-3 text-center">-</td>
                          </tr>
                          {cenarios.com_desconto && (
                            <tr className="border-b">
                              <td className="p-3">Com Desconto Máx.</td>
                              <td className="p-3 text-right">{formatCurrency(cenarios.com_desconto.custo_total)}</td>
                              <td className="p-3 text-right">{formatCurrency(cenarios.com_desconto.preco_varejo)}</td>
                              <td className="p-3 text-center">{formatPercent(cenarios.com_desconto.margem_real_varejo)}</td>
                              <td className="p-3 text-center">
                                <Badge variant="destructive">
                                  {formatCurrency(cenarios.com_desconto.preco_varejo - cenarios.atual.preco_varejo)}
                                </Badge>
                              </td>
                            </tr>
                          )}
                          {cenarios.cambio_alta && (
                            <tr className="border-b">
                              <td className="p-3">Câmbio +10%</td>
                              <td className="p-3 text-right">{formatCurrency(cenarios.cambio_alta.custo_total)}</td>
                              <td className="p-3 text-right">{formatCurrency(cenarios.cambio_alta.preco_varejo)}</td>
                              <td className="p-3 text-center">{formatPercent(cenarios.cambio_alta.margem_real_varejo)}</td>
                              <td className="p-3 text-center">
                                <Badge variant="secondary">
                                  +{formatCurrency(cenarios.cambio_alta.preco_varejo - cenarios.atual.preco_varejo)}
                                </Badge>
                              </td>
                            </tr>
                          )}
                          {cenarios.otimista && (
                            <tr className="border-b">
                              <td className="p-3">Cenário Otimista</td>
                              <td className="p-3 text-right">{formatCurrency(cenarios.otimista.custo_total)}</td>
                              <td className="p-3 text-right">{formatCurrency(cenarios.otimista.preco_varejo)}</td>
                              <td className="p-3 text-center">{formatPercent(cenarios.otimista.margem_real_varejo)}</td>
                              <td className="p-3 text-center">
                                <Badge variant="default">
                                  +{formatCurrency(cenarios.otimista.preco_varejo - cenarios.atual.preco_varejo)}
                                </Badge>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}