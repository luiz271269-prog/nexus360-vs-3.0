import { useState, useEffect } from "react";
import { Venda } from "@/entities/Venda";
import { Orcamento } from "@/entities/Orcamento";
import { InvokeLLM } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Brain, 
  Target,
  DollarSign,
  Activity,
  AlertCircle
} from "lucide-react";

export default function PrevisaoVendas() {
  const [previsao, setPrevisao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detalhes, setDetalhes] = useState({});

  useEffect(() => {
    gerarPrevisaoIA();
  }, []);

  const gerarPrevisaoIA = async () => {
    setLoading(true);
    try {
      // Buscar dados dos últimos 6 meses
      const dataInicio = new Date();
      dataInicio.setMonth(dataInicio.getMonth() - 6);
      
      const [vendas, orcamentos] = await Promise.all([
        Venda.list("-data_venda", 200),
        Orcamento.list("-data_orcamento", 100)
      ]);

      // Preparar dados para análise da IA
      const vendaesUltimos6Meses = vendas.filter(v => 
        v.data_venda && new Date(v.data_venda) >= dataInicio
      );

      const orcamentosEmAberto = orcamentos.filter(o => o.status === "Em Aberto");
      const mesAtual = new Date().toISOString().slice(0, 7);
      const vendasMesAtual = vendas.filter(v => v.data_venda?.startsWith(mesAtual));

      // Calcular métricas atuais
      const faturamentoMesAtual = vendasMesAtual.reduce((sum, v) => sum + (v.valor_total || 0), 0);
      const valorOrcamentosAbertos = orcamentosEmAberto.reduce((sum, o) => sum + (o.valor_total || 0), 0);
      
      // Histórico mensal dos últimos 6 meses
      const historicoMensal = {};
      vendaesUltimos6Meses.forEach(venda => {
        const mes = venda.data_venda.slice(0, 7);
        if (!historicoMensal[mes]) {
          historicoMensal[mes] = { faturamento: 0, quantidade: 0 };
        }
        historicoMensal[mes].faturamento += venda.valor_total || 0;
        historicoMensal[mes].quantidade += 1;
      });

      const prompt = `
        Analise os dados de vendas dos últimos 6 meses e gere uma previsão inteligente para o final do mês atual.
        
        Dados atuais:
        - Faturamento no mês até agora: R$ ${faturamentoMesAtual.toLocaleString('pt-BR')}
        - Valor em orçamentos abertos: R$ ${valorOrcamentosAbertos.toLocaleString('pt-BR')}
        - Vendas realizadas no mês: ${vendasMesAtual.length}
        - Orçamentos em aberto: ${orcamentosEmAberto.length}
        
        Histórico mensal dos últimos 6 meses:
        ${Object.entries(historicoMensal).map(([mes, dados]) => 
          `${mes}: R$ ${dados.faturamento.toLocaleString('pt-BR')} (${dados.quantidade} vendas)`
        ).join('\n')}
        
        Com base nestes dados e considerando:
        1. Tendências sazonais
        2. Taxa de conversão histórica de orçamentos
        3. Performance atual do mês
        4. Padrões de vendas dos últimos meses
        
        Forneça uma previsão para o final do mês atual incluindo:
        - Valor previsto de faturamento
        - Número de vendas esperadas
        - Nível de confiança da previsão (0-100%)
        - Fatores que podem influenciar positiva ou negativamente
        - Recomendações estratégicas para atingir ou superar a previsão
      `;

      const previsaoIA = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            faturamento_previsto: { type: "number" },
            vendas_previstas: { type: "number" },
            confianca_previsao: { type: "number" },
            fatores_positivos: { 
              type: "array", 
              items: { type: "string" } 
            },
            fatores_risco: { 
              type: "array", 
              items: { type: "string" } 
            },
            recomendacoes: { 
              type: "array", 
              items: { type: "string" } 
            },
            cenario_otimista: { type: "number" },
            cenario_conservador: { type: "number" },
            gap_para_meta: { type: "string" },
            probabilidade_bater_meta: { type: "number" }
          }
        }
      });

      setPrevisao(previsaoIA);
      setDetalhes({
        faturamentoAtual: faturamentoMesAtual,
        valorOrcamentosAbertos,
        vendasMesAtual: vendasMesAtual.length,
        orcamentosAbertos: orcamentosEmAberto.length,
        historicoMensal
      });

    } catch (error) {
      console.error("Erro ao gerar previsão:", error);
      // Fallback simples
      gerarPrevisaoSimples();
    }
    setLoading(false);
  };

  const gerarPrevisaoSimples = async () => {
    const vendas = await Venda.list();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const vendasMes = vendas.filter(v => v.data_venda?.startsWith(mesAtual));
    const faturamento = vendasMes.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    
    const previsaoSimples = {
      faturamento_previsto: faturamento * 1.2, // Estimativa simples
      vendas_previstas: Math.ceil(vendasMes.length * 1.3),
      confianca_previsao: 65,
      fatores_positivos: ["Histórico de crescimento"],
      fatores_risco: ["Sazonalidade"],
      recomendacoes: ["Focar em conversão de orçamentos"]
    };
    
    setPrevisao(previsaoSimples);
    setDetalhes({ faturamentoAtual: faturamento, vendasMesAtual: vendasMes.length });
  };

  const getConfiancaColor = (confianca) => {
    if (confianca >= 80) return "text-emerald-300 bg-emerald-500/20";
    if (confianca >= 60) return "text-amber-300 bg-amber-500/20";
    return "text-red-400 bg-red-500/20";
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-indigo-400 animate-pulse" />
          <h2 className="text-xl font-bold text-white">Gerando Previsão Inteligente...</h2>
        </div>
        <div className="space-y-3">
          <div className="bg-slate-700/50 rounded-lg h-16 animate-pulse" />
          <div className="bg-slate-700/50 rounded-lg h-12 animate-pulse" />
          <div className="bg-slate-700/50 rounded-lg h-12 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Previsão de Vendas</h2>
            <p className="text-sm text-slate-400">Análise preditiva baseada em IA</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 font-semibold px-3 py-1 rounded-lg text-sm border border-current ${getConfiancaColor(previsao?.confianca_previsao || 0)}`}>
          <Activity className="w-4 h-4" />
          <span>{previsao?.confianca_previsao || 0}% de confiança</span>
        </div>
      </div>

      {/* Previsão Principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-indigo-500/30 to-purple-500/30 p-4 rounded-xl border border-indigo-500/50">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-indigo-300" />
            <span className="font-semibold text-indigo-200">Faturamento Previsto</span>
          </div>
          <p className="text-2xl font-bold text-white">
            R$ {(previsao?.faturamento_previsto || 0).toLocaleString('pt-BR')}
          </p>
          <p className="text-sm text-indigo-300 mt-1">
            Atual: R$ {(detalhes.faturamentoAtual || 0).toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/30 to-green-500/30 p-4 rounded-xl border border-emerald-500/50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-emerald-300" />
            <span className="font-semibold text-emerald-200">Vendas Previstas</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {previsao?.vendas_previstas || 0} vendas
          </p>
          <p className="text-sm text-emerald-300 mt-1">
            Atual: {detalhes.vendasMesAtual || 0} vendas
          </p>
        </div>
      </div>

      {/* Cenários */}
      {previsao?.cenario_otimista && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-500/20 p-3 rounded-lg border border-emerald-500/50">
            <p className="text-sm font-semibold text-emerald-300">Cenário Otimista</p>
            <p className="text-lg font-bold text-white">
              R$ {previsao.cenario_otimista.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="bg-amber-500/20 p-3 rounded-lg border border-amber-500/50">
            <p className="text-sm font-semibold text-amber-300">Cenário Conservador</p>
            <p className="text-lg font-bold text-white">
              R$ {previsao.cenario_conservador.toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      )}

      {/* Fatores e Recomendações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Fatores Positivos */}
        {previsao?.fatores_positivos && previsao.fatores_positivos.length > 0 && (
          <div className="bg-emerald-500/20 p-4 rounded-xl border border-emerald-500/50">
            <h4 className="font-semibold text-emerald-300 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-300" />
              Fatores Positivos
            </h4>
            <ul className="space-y-1">
              {previsao.fatores_positivos.slice(0, 3).map((fator, index) => (
                <li key={index} className="text-sm text-emerald-200 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></span>
                  {fator}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fatores de Risco */}
        {previsao?.fatores_risco && previsao.fatores_risco.length > 0 && (
          <div className="bg-amber-500/20 p-4 rounded-xl border border-amber-500/50">
            <h4 className="font-semibold text-amber-300 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-300" />
              Pontos de Atenção
            </h4>
            <ul className="space-y-1">
              {previsao.fatores_risco.slice(0, 3).map((fator, index) => (
                <li key={index} className="text-sm text-amber-200 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-2 flex-shrink-0"></span>
                  {fator}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recomendações */}
      {previsao?.recomendacoes && previsao.recomendacoes.length > 0 && (
        <div className="bg-indigo-500/20 p-4 rounded-xl border border-indigo-500/50 mb-4">
          <h4 className="font-semibold text-indigo-300 mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-300" />
            Recomendações Estratégicas
          </h4>
          <ul className="space-y-2">
            {previsao.recomendacoes.slice(0, 3).map((rec, index) => (
              <li key={index} className="text-sm text-indigo-200 flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-2 flex-shrink-0"></span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ações */}
      <div className="pt-4 border-t border-slate-700/50">
        <Button
          onClick={gerarPrevisaoIA}
          variant="outline"
          className="w-full bg-slate-800/50 text-slate-300 hover:bg-slate-700/80 hover:text-white border-slate-700"
        >
          <Brain className="w-4 h-4 mr-2" />
          Atualizar Previsão
        </Button>
      </div>
    </div>
  );
}