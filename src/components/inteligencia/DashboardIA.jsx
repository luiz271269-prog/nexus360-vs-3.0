import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Zap,
  Target,
  TrendingUp,
  RefreshCw,
  Sparkles,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { AprendizadoIA } from "@/entities/AprendizadoIA";
import { ClienteScore } from "@/entities/ClienteScore";
import { toast } from "sonner";

/**
 * Dashboard para visualizar e gerenciar as capacidades de IA
 * do VendaPro (Estudo 2)
 */

export default function DashboardIA() {
  const [aprendizados, setAprendizados] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAprendizados: 0,
    taxaSucessoMedia: 0,
    clientesAnalisados: 0,
    fermentasDisponiveis: 0
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [aprendizadosData, scoresData] = await Promise.all([
        AprendizadoIA.list('-created_date', 50),
        ClienteScore.list('-score_total', 100)
      ]);

      setAprendizados(aprendizadosData);
      setScores(scoresData);

      // Calcular estatísticas
      const taxas = aprendizadosData
        .map(a => a.impacto_medido?.melhoria_percentual || 0)
        .filter(t => t > 0);
      
      setStats({
        totalAprendizados: aprendizadosData.filter(a => a.ativo).length,
        taxaSucessoMedia: taxas.length > 0 ? Math.round(taxas.reduce((sum, t) => sum + t, 0) / taxas.length) : 0,
        clientesAnalisados: scoresData.length,
        ferramentasDisponiveis: 5 // Ajustar conforme ferramentas registradas
      });

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dashboard de IA");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-purple-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-purple-900 mb-2">
                🧠 Dashboard de Inteligência Artificial
              </h2>
              <p className="text-sm text-purple-800 mb-3">
                Monitore as capacidades autônomas e aprendizado contínuo do VendaPro
              </p>
              <div className="flex gap-2">
                <Badge className="bg-purple-100 text-purple-800">✓ Raciocínio Multi-Passos</Badge>
                <Badge className="bg-indigo-100 text-indigo-800">✓ Tool Use Automático</Badge>
                <Badge className="bg-blue-100 text-blue-800">✓ Hiper-Personalização</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Aprendizados Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {stats.totalAprendizados}
            </div>
            <p className="text-xs text-slate-500 mt-1">Padrões descobertos e aplicados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Taxa de Melhoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.taxaSucessoMedia}%
            </div>
            <p className="text-xs text-slate-500 mt-1">Média de melhoria com IA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Clientes Analisados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.clientesAnalisados}
            </div>
            <p className="text-xs text-slate-500 mt-1">Com perfil comportamental</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              Ferramentas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {stats.ferramentasDisponiveis}
            </div>
            <p className="text-xs text-slate-500 mt-1">Tools disponíveis para IA</p>
          </CardContent>
        </Card>
      </div>

      {/* Aprendizados Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              Aprendizados Recentes
            </span>
            <Button onClick={carregarDados} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aprendizados.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Brain className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Nenhum aprendizado registrado ainda</p>
              <p className="text-xs mt-1">O sistema começará a aprender com o uso</p>
            </div>
          ) : (
            <div className="space-y-3">
              {aprendizados.slice(0, 5).map((aprendizado) => (
                <div
                  key={aprendizado.id}
                  className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200"
                >
                  {aprendizado.ativo ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-purple-900 text-sm">
                      {aprendizado.tipo_aprendizado.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    <p className="text-xs text-purple-700 mt-1 line-clamp-2">
                      {aprendizado.padrao_identificado?.descricao || 'Sem descrição'}
                    </p>
                    {aprendizado.impacto_medido?.melhoria_percentual && (
                      <Badge className="mt-2 bg-green-100 text-green-800 text-[10px]">
                        +{aprendizado.impacto_medido.melhoria_percentual}% de melhoria
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clientes com Perfil Identificado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Clientes com Perfil Comportamental
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scores.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Nenhum perfil identificado ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scores.slice(0, 6).map((score) => (
                <div
                  key={score.id}
                  className="p-3 bg-blue-50 rounded-lg border border-blue-200"
                >
                  <p className="font-medium text-blue-900 text-sm truncate">
                    {score.cliente_nome}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                      Score: {score.score_total}/1000
                    </Badge>
                    {score.perfil_compra && (
                      <span className="text-xs text-blue-600 capitalize">
                        {score.perfil_compra.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}