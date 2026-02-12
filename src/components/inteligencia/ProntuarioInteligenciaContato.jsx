import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Brain, AlertTriangle, TrendingUp, Target, CheckCircle2 } from 'lucide-react';

/**
 * ProntuarioInteligenciaContato
 * Exibe o prontuário estruturado em 7 seções do Prompt V2
 * Integrado ao painel de análise existente (não é nova tela)
 */
export default function ProntuarioInteligenciaContato({ analise }) {
  const [expandido, setExpandido] = useState(false);

  if (!analise?.prontuario_ptbr) {
    return null;
  }

  const prontuario = analise.prontuario_ptbr;
  const riskLevel = analise.relationship_risk?.level || 'low';
  const profileType = analise.relationship_profile?.type || 'outro';

  const getRiskColor = (level) => {
    switch (level) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'high': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default: return 'bg-green-100 border-green-300 text-green-800';
    }
  };

  const getRiskIcon = (level) => {
    switch (level) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      default: return '🟢';
    }
  };

  const sections = [
    {
      title: '1. Visão Geral do Relacionamento',
      icon: Brain,
      content: prontuario.visao_geral,
      color: 'from-blue-50 to-blue-100'
    },
    {
      title: '2. Necessidades e Contexto de Compra',
      icon: Target,
      content: prontuario.necessidades_contexto,
      color: 'from-purple-50 to-purple-100'
    },
    {
      title: '3. Estado Atual da Conta (Scores)',
      icon: TrendingUp,
      content: prontuario.estado_atual_scores,
      color: 'from-cyan-50 to-cyan-100'
    },
    {
      title: '4. Causas Principais',
      icon: AlertTriangle,
      content: prontuario.causas_principais,
      color: 'from-orange-50 to-orange-100'
    },
    {
      title: '5. Oportunidades e Sinais Positivos',
      icon: CheckCircle2,
      content: prontuario.oportunidades_sinais_positivos,
      color: 'from-green-50 to-green-100'
    },
    {
      title: '6. Recomendações Objetivas',
      icon: Target,
      content: prontuario.recomendacoes_objetivas,
      color: 'from-indigo-50 to-indigo-100'
    },
    {
      title: '7. Sugestão de Mensagem Pronta',
      icon: Brain,
      content: prontuario.mensagem_pronta,
      color: 'from-pink-50 to-pink-100',
      isMessage: true
    }
  ];

  return (
    <Card className="border-2 border-slate-200 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-sm">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">📋 Prontuário de Inteligência</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Análise estruturada em 7 seções</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`${getRiskColor(riskLevel)} border`}>
              {getRiskIcon(riskLevel)} Risco: {riskLevel.toUpperCase()}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setExpandido(!expandido)}
              className="h-8 w-8"
            >
              {expandido ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expandido && (
        <CardContent className="space-y-3 pt-2">
          {/* Info rápida do perfil */}
          {analise.relationship_profile && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-4">
              <p className="text-xs font-bold text-slate-700 mb-2">Tipo de Relacionamento</p>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                  {analise.relationship_profile.type?.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
              {analise.relationship_profile.flags && analise.relationship_profile.flags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {analise.relationship_profile.flags.map((flag) => (
                    <Badge key={flag} variant="outline" className="text-xs">
                      {flag.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seções do prontuário */}
          <div className="space-y-2">
            {sections.map((section, idx) => {
              const Icon = section.icon;
              return (
                <div
                  key={idx}
                  className={`rounded-lg border border-slate-200 overflow-hidden bg-gradient-to-r ${section.color}`}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Icon className="w-4 h-4 text-slate-700 mt-0.5 flex-shrink-0" />
                      <h4 className="font-bold text-sm text-slate-800">{section.title}</h4>
                    </div>
                    <p className={`text-xs text-slate-700 leading-relaxed ${section.isMessage ? 'italic bg-white/50 p-2 rounded' : ''}`}>
                      {section.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Playbook (se disponível) */}
          {analise.playbook && (
            <div className="mt-4 pt-4 border-t-2 border-slate-300">
              <h4 className="font-bold text-sm text-slate-800 mb-2">🎯 Playbook Estratégico</h4>
              
              {analise.playbook.goal && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 mb-2 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-900 mb-1">Goal:</p>
                  <p className="text-xs text-amber-800">{analise.playbook.goal}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {analise.playbook.when_to_compete && analise.playbook.when_to_compete.length > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-2 border border-green-200">
                    <p className="text-[10px] font-bold text-green-900 mb-1">✅ Quando Competir:</p>
                    <ul className="text-[10px] text-green-800 space-y-0.5">
                      {analise.playbook.when_to_compete.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analise.playbook.when_to_decline && analise.playbook.when_to_decline.length > 0 && (
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-2 border border-red-200">
                    <p className="text-[10px] font-bold text-red-900 mb-1">❌ Quando Declinar:</p>
                    <ul className="text-[10px] text-red-800 space-y-0.5">
                      {analise.playbook.when_to_decline.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Próxima Ação */}
          {analise.next_best_action && (
            <div className="mt-4 pt-4 border-t-2 border-slate-300 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs font-bold text-blue-900 mb-2">🚀 Próxima Ação Recomendada</p>
              <p className="text-xs text-blue-800 font-semibold mb-2">{analise.next_best_action.action}</p>
              {analise.next_best_action.rationale && (
                <p className="text-xs text-blue-700 mb-2">{analise.next_best_action.rationale}</p>
              )}
              {analise.next_best_action.suggested_message && (
                <div className="bg-white rounded p-2 border-l-2 border-blue-600">
                  <p className="text-xs text-slate-600 italic">{analise.next_best_action.suggested_message}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}