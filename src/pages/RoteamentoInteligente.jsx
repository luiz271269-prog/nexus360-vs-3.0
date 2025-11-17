
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Target,
  TrendingUp,
  Loader2,
  RefreshCw,
  BarChart3,
  Zap,
  Award,
  AlertCircle,
  CheckCircle,
  Workflow // Added Workflow icon for the new header
} from "lucide-react";
import { toast } from "sonner";
import RoteamentoInteligente from "../components/inteligencia/RoteamentoInteligente";

export default function RoteamentoInteligentePage() {
  const [vendedores, setVendedores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [vendedoresData, clientesData] = await Promise.all([
        base44.entities.Vendedor.list(),
        base44.entities.Cliente.list()
      ]);
      
      setVendedores(vendedoresData);
      setClientes(clientesData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    }
    setLoading(false);
  };

  const recalcularMetricas = async () => {
    setRecalculando(true);
    try {
      await RoteamentoInteligente.recalcularMetricasVendedores();
      await carregarDados();
      toast.success("✅ Métricas recalculadas com sucesso!");
    } catch (error) {
      console.error("Erro ao recalcular:", error);
      toast.error("Erro ao recalcular métricas");
    }
    setRecalculando(false);
  };

  const testarRoteamento = async () => {
    setTestando(true);
    setResultadoTeste(null);
    
    try {
      const clienteTeste = clientes.find(c => !c.vendedor_responsavel) || clientes[0];
      
      if (!clienteTeste) {
        toast.error("Nenhum cliente disponível para teste");
        setTestando(false);
        return;
      }
      
      toast.info(`🧪 Testando com cliente: ${clienteTeste.razao_social || clienteTeste.nome}`);
      
      const resultado = await RoteamentoInteligente.alocarLeadInteligentemente(clienteTeste);
      
      setResultadoTeste(resultado);
      
      if (resultado.sucesso) {
        toast.success(`✅ Lead alocado para: ${resultado.vendedor.nome}`);
      } else {
        toast.warning(`⚠️ ${resultado.motivo}`);
      }
      
      await carregarDados();
      
    } catch (error) {
      console.error("Erro no teste:", error);
      toast.error(`Erro: ${error.message}`);
    }
    
    setTestando(false);
  };

  const vendedoresAtivos = vendedores.filter(v => v.status === 'ativo');
  const cargaMedia = vendedoresAtivos.length > 0
    ? vendedoresAtivos.reduce((sum, v) => sum + (v.carga_trabalho_atual || 0), 0) / vendedoresAtivos.length
    : 0;
  
  const taxaConversaoMedia = vendedoresAtivos.length > 0
    ? vendedoresAtivos.reduce((sum, v) => 
        sum + (v.metricas_performance?.taxa_conversao_geral || 0), 0
      ) / vendedoresAtivos.length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" /> {/* Changed loader color to orange */}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 space-y-6 p-6"> {/* Updated root div classes */}
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header com Gradiente Laranja */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
                <Workflow className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  Roteamento Inteligente
                </h1>
                <p className="text-slate-300 mt-1">
                  Distribuição automática de leads por IA
                </p>
              </div>
            </div>
            
            {/* Original buttons integrated into new header structure */}
            <div className="flex gap-2">
              <Button
                onClick={recalcularMetricas}
                disabled={recalculando}
                variant="outline"
                className="text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white"
              >
                {recalculando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Recalculando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Recalcular Métricas
                  </>
                )}
              </Button>
              
              <Button
                onClick={testarRoteamento}
                disabled={testando}
                className="bg-amber-500 hover:bg-amber-600 text-white" // Updated to orange gradient style
              >
                {testando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Testar Roteamento
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white"> {/* Updated card gradient */}
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Vendedores Ativos</p>
                  <p className="text-3xl font-bold mt-1">{vendedoresAtivos.length}</p>
                </div>
                <Users className="w-10 h-10 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white"> {/* Updated card gradient */}
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Carga Média</p>
                  <p className="text-3xl font-bold mt-1">{cargaMedia.toFixed(1)}</p>
                  <p className="text-xs opacity-75 mt-1">leads/vendedor</p>
                </div>
                <Target className="w-10 h-10 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500 to-amber-600 text-white"> {/* Updated card gradient */}
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Taxa Conversão Média</p>
                  <p className="text-3xl font-bold mt-1">{taxaConversaoMedia.toFixed(1)}%</p>
                </div>
                <TrendingUp className="w-10 h-10 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-orange-600 text-white"> {/* Updated card gradient */}
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Clientes sem Vendedor</p>
                  <p className="text-3xl font-bold mt-1">
                    {clientes.filter(c => !c.vendedor_responsavel).length}
                  </p>
                </div>
                <AlertCircle className="w-10 h-10 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {resultadoTeste && (
          <Alert className={resultadoTeste.sucesso ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
            <AlertDescription>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {resultadoTeste.sucesso ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-bold text-lg">
                    {resultadoTeste.sucesso ? 'Teste Bem-Sucedido!' : 'Teste Falhou'}
                  </span>
                </div>

                {resultadoTeste.sucesso ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-orange-600" /> {/* Changed icon color */}
                      <span className="font-semibold">
                        Vendedor Selecionado: {resultadoTeste.vendedor.nome}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div className="bg-white p-3 rounded border">
                        <div className="text-slate-600">Score de Matching</div>
                        <div className="text-2xl font-bold text-orange-600"> {/* Changed text color */}
                          {resultadoTeste.metricas.score_matching.toFixed(1)}
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded border">
                        <div className="text-slate-600">Probabilidade de Conversão</div>
                        <div className="text-2xl font-bold text-green-600">
                          {resultadoTeste.metricas.probabilidade_conversao.toFixed(1)}%
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded border">
                        <div className="text-slate-600">Perfil do Vendedor</div>
                        <div className="text-lg font-semibold text-orange-600 capitalize"> {/* Changed text color */}
                          {resultadoTeste.vendedor.perfil_vendedor}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded border">
                      <div className="text-slate-600 text-sm font-medium mb-1">Motivo da Seleção:</div>
                      <div className="text-sm text-slate-700">{resultadoTeste.metricas.motivo}</div>
                    </div>

                    {resultadoTeste.alternativas && resultadoTeste.alternativas.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-semibold text-orange-600"> {/* Changed text color */}
                          Ver vendedores alternativos
                        </summary>
                        <div className="mt-2 space-y-1">
                          {resultadoTeste.alternativas.map((alt, idx) => (
                            <div key={idx} className="bg-white p-2 rounded border text-sm">
                              {idx + 2}. {alt.nome} - Score: {alt.score_final.toFixed(1)} ({alt.motivo_score})
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  <div className="text-yellow-800">
                    <strong>Motivo:</strong> {resultadoTeste.motivo}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-600" /> {/* Added icon color */}
              Performance dos Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vendedoresAtivos.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhum vendedor ativo encontrado
                </div>
              ) : (
                vendedoresAtivos.map((vendedor) => {
                  const metricas = vendedor.metricas_performance || {};
                  const carga = vendedor.carga_trabalho_atual || 0;
                  const capacidade = vendedor.capacidade_maxima || 20;
                  const percentualCarga = (carga / capacidade) * 100;
                  
                  return (
                    <div
                      key={vendedor.id}
                      className="flex items-center gap-4 p-4 rounded-lg border bg-white hover:shadow-md transition-all"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"> {/* Updated avatar gradient */}
                        {vendedor.nome.charAt(0)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-900">{vendedor.nome}</span>
                          <Badge className="capitalize">{vendedor.perfil_vendedor}</Badge>
                          {vendedor.disponivel_agora === false && (
                            <Badge variant="outline" className="text-red-600 border-red-300">
                              Indisponível
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>Taxa Conversão: <strong>{metricas.taxa_conversao_geral || 0}%</strong></span>
                          <span>•</span>
                          <span>Carga: <strong>{carga}/{capacidade}</strong></span>
                          <span>•</span>
                          <span className="capitalize">
                            Especialidade: <strong>{vendedor.segmentos_especialidade?.join(', ') || 'N/A'}</strong>
                          </span>
                        </div>
                      </div>
                      
                      <div className="w-32 flex-shrink-0">
                        <div className="text-xs text-slate-600 mb-1">
                          Carga: {percentualCarga.toFixed(0)}%
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              percentualCarga < 50 ? 'bg-green-500' :
                              percentualCarga < 80 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, percentualCarga)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
