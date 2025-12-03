import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

/**
 * ScoreConfiancaIA - Visualização do nível de confiança da IA
 * Ajuda a entender quando a IA está segura ou precisa de ajuda humana
 */
export default function ScoreConfiancaIA({ score, contexto }) {
  
  const getNivelConfianca = (score) => {
    if (score >= 0.9) return {
      nivel: 'Muito Alta',
      cor: 'bg-green-500',
      textoCor: 'text-green-700',
      badgeCor: 'bg-green-100 text-green-800',
      icone: CheckCircle,
      mensagem: 'A IA está muito confiante nesta resposta'
    };
    
    if (score >= 0.75) return {
      nivel: 'Alta',
      cor: 'bg-blue-500',
      textoCor: 'text-blue-700',
      badgeCor: 'bg-blue-100 text-blue-800',
      icone: CheckCircle,
      mensagem: 'A IA está confiante nesta resposta'
    };
    
    if (score >= 0.5) return {
      nivel: 'Média',
      cor: 'bg-yellow-500',
      textoCor: 'text-yellow-700',
      badgeCor: 'bg-yellow-100 text-yellow-800',
      icone: AlertCircle,
      mensagem: 'Resposta razoável, mas considere revisar'
    };
    
    if (score >= 0.3) return {
      nivel: 'Baixa',
      cor: 'bg-orange-500',
      textoCor: 'text-orange-700',
      badgeCor: 'bg-orange-100 text-orange-800',
      icone: AlertTriangle,
      mensagem: 'Confiança baixa - recomenda-se revisão humana'
    };
    
    return {
      nivel: 'Muito Baixa',
      cor: 'bg-red-500',
      textoCor: 'text-red-700',
      badgeCor: 'bg-red-100 text-red-800',
      icone: AlertTriangle,
      mensagem: 'Não use esta resposta sem validação humana'
    };
  };

  const info = getNivelConfianca(score);
  const Icon = info.icone;
  const percentual = Math.round(score * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${info.textoCor}`} />
          <span className="text-sm font-medium text-slate-700">
            Score de Confiança
          </span>
        </div>
        <Badge className={info.badgeCor}>
          {info.nivel}
        </Badge>
      </div>

      <div className="space-y-2">
        <Progress value={percentual} className="h-2" />
        <div className="flex justify-between text-xs text-slate-600">
          <span>{percentual}%</span>
          <span>{info.mensagem}</span>
        </div>
      </div>

      {contexto && (
        <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
          <strong>Contexto:</strong> {contexto}
        </div>
      )}

      {score < 0.5 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Atenção:</strong> Esta resposta tem baixa confiança. 
            Considere transferir para atendimento humano ou pedir mais informações ao cliente.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook para calcular score de confiança baseado em múltiplos fatores
 */
export function useScoreConfianca(resposta, contexto) {
  const calcularScore = () => {
    let score = 0.5; // Base
    let fatores = [];

    // 1. Confiança explícita da IA
    if (resposta.confidence !== undefined) {
      score = resposta.confidence;
      fatores.push({
        fator: 'Confiança IA',
        peso: resposta.confidence
      });
    }

    // 2. Presença de conhecimento específico
    if (contexto?.conhecimento_encontrado) {
      score += 0.2;
      fatores.push({
        fator: 'Base de Conhecimento',
        peso: 0.2
      });
    }

    // 3. Clareza da pergunta
    if (contexto?.clareza_pergunta === 'alta') {
      score += 0.1;
      fatores.push({
        fator: 'Clareza da Pergunta',
        peso: 0.1
      });
    } else if (contexto?.clareza_pergunta === 'baixa') {
      score -= 0.1;
      fatores.push({
        fator: 'Clareza da Pergunta',
        peso: -0.1
      });
    }

    // 4. Histórico de respostas similares
    if (contexto?.historico_sucesso) {
      const taxaSucesso = contexto.historico_sucesso;
      score += (taxaSucesso * 0.15);
      fatores.push({
        fator: 'Histórico',
        peso: taxaSucesso * 0.15
      });
    }

    // 5. Complexidade da resposta
    if (resposta.type === 'action' || resposta.type === 'multi_step') {
      score -= 0.1; // Ações são mais arriscadas
      fatores.push({
        fator: 'Complexidade',
        peso: -0.1
      });
    }

    // 6. Validação de dados
    if (contexto?.dados_validados) {
      score += 0.15;
      fatores.push({
        fator: 'Dados Validados',
        peso: 0.15
      });
    }

    // Normalizar entre 0 e 1
    score = Math.max(0, Math.min(1, score));

    return {
      score,
      fatores,
      recomendacao: getRecomendacao(score)
    };
  };

  const getRecomendacao = (score) => {
    if (score >= 0.9) return 'Pode responder automaticamente';
    if (score >= 0.75) return 'Responder com monitoramento';
    if (score >= 0.5) return 'Apresentar com opção de revisão';
    if (score >= 0.3) return 'Solicitar validação humana';
    return 'Transferir para humano';
  };

  return calcularScore();
}