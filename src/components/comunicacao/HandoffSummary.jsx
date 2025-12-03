import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  User,
  Calendar,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { InvokeLLM } from '@/integrations/Core';

/**
 * Resumo Inteligente para Handoff
 * Gerado pela IA para dar contexto rápido ao agente humano
 */
export default function HandoffSummary({ thread, messages, contact, clienteScore }) {
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gerarResumo();
  }, [thread?.id]);

  const gerarResumo = async () => {
    setLoading(true);
    try {
      // Pegar últimas 10 mensagens
      const mensagensRecentes = messages.slice(-10);
      
      const conversaTexto = mensagensRecentes.map(m => 
        `${m.sender_type === 'user' ? 'Agente' : 'Cliente'}: ${m.content}`
      ).join('\n');

      const prompt = `Você é um assistente de vendas analisando uma conversa para preparar um resumo para o agente humano.

**CONVERSA:**
${conversaTexto}

**DADOS DO CLIENTE:**
- Nome: ${contact?.nome || 'Não identificado'}
- Telefone: ${contact?.telefone || 'N/A'}
- Empresa: ${contact?.empresa || 'N/A'}
${clienteScore ? `- Score de Urgência: ${clienteScore.score_urgencia}/100
- Sentimento: ${clienteScore.sentimento_geral}
- Risco Churn: ${clienteScore.risco_churn}` : ''}

**SUA TAREFA:**
Gere um resumo executivo da conversa em JSON com:
1. Uma linha de resumo (máx 100 caracteres) 
2. O problema/necessidade principal do cliente
3. O que já foi discutido/resolvido
4. O que o cliente está esperando agora
5. Ação sugerida para o agente
6. Nível de urgência (baixo, médio, alto, crítico)

Seja conciso, objetivo e focado no que o agente precisa saber AGORA.`;

      const resultado = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            resumo_linha: { type: "string" },
            problema_principal: { type: "string" },
            ja_discutido: { type: "string" },
            cliente_espera: { type: "string" },
            acao_sugerida: { type: "string" },
            urgencia: { type: "string", enum: ["baixo", "medio", "alto", "critico"] }
          },
          required: ["resumo_linha", "problema_principal", "acao_sugerida", "urgencia"]
        }
      });

      setResumo(resultado);
    } catch (error) {
      console.error("Erro ao gerar resumo:", error);
      setResumo({
        resumo_linha: "Erro ao gerar resumo",
        problema_principal: "Não foi possível analisar a conversa",
        acao_sugerida: "Revisar o histórico manualmente",
        urgencia: "medio"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            <span className="text-sm text-purple-700">IA gerando resumo da conversa...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!resumo) return null;

  const urgenciaConfig = {
    baixo: { color: 'bg-green-100 text-green-800 border-green-200', icon: TrendingUp },
    medio: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle },
    alto: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle },
    critico: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle }
  };

  const config = urgenciaConfig[resumo.urgencia] || urgenciaConfig.medio;
  const UrgenciaIcon = config.icon;

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-purple-900">
          <Sparkles className="w-5 h-5" />
          Resumo Inteligente da Conversa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Urgência */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Urgência:</span>
          <Badge className={`${config.color} border`}>
            <UrgenciaIcon className="w-3 h-3 mr-1" />
            {resumo.urgencia.toUpperCase()}
          </Badge>
        </div>

        {/* Resumo Principal */}
        <Alert className="bg-white border-purple-200">
          <AlertDescription className="text-sm font-semibold text-purple-900">
            {resumo.resumo_linha}
          </AlertDescription>
        </Alert>

        {/* Detalhes */}
        <div className="space-y-2 text-sm">
          <div className="bg-white p-3 rounded-lg border border-purple-100">
            <p className="font-semibold text-purple-900 mb-1">🎯 Problema Principal:</p>
            <p className="text-slate-700">{resumo.problema_principal}</p>
          </div>

          {resumo.ja_discutido && (
            <div className="bg-white p-3 rounded-lg border border-purple-100">
              <p className="font-semibold text-purple-900 mb-1">✅ Já Discutido:</p>
              <p className="text-slate-700">{resumo.ja_discutido}</p>
            </div>
          )}

          {resumo.cliente_espera && (
            <div className="bg-white p-3 rounded-lg border border-purple-100">
              <p className="font-semibold text-purple-900 mb-1">⏳ Cliente Espera:</p>
              <p className="text-slate-700">{resumo.cliente_espera}</p>
            </div>
          )}

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 rounded-lg border-2 border-green-200">
            <p className="font-semibold text-green-900 mb-1">💡 Ação Sugerida:</p>
            <p className="text-green-800 font-medium">{resumo.acao_sugerida}</p>
          </div>
        </div>

        {/* Contexto do Cliente */}
        {clienteScore && (
          <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-1">
            <p className="font-semibold text-slate-700 mb-2">📊 Score do Cliente:</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-600">Urgência:</span>
                <span className="ml-2 font-semibold">{clienteScore.score_urgencia}/100</span>
              </div>
              <div>
                <span className="text-slate-600">Sentimento:</span>
                <span className="ml-2 font-semibold capitalize">{clienteScore.sentimento_geral}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}