import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, TrendingUp, Users, Calendar, Sparkles, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  PROCESSING FEEDBACK - GAMIFICAÇÃO DA IMPORTAÇÃO            ║
 * ║  Mostra progresso, resultados da IA e próximas ações       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export default function ProcessingFeedback({ 
  isOpen, 
  onClose, 
  resultado,
  tipo = 'importacao' // 'importacao' | 'automacao' | 'ia_processamento'
}) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const steps = [
    { label: 'Validando dados', icon: CheckCircle },
    { label: 'Processando com IA', icon: Sparkles },
    { label: 'Gerando insights', icon: TrendingUp },
    { label: 'Criando tarefas', icon: Calendar }
  ];

  useEffect(() => {
    if (isOpen && resultado?.status === 'processando') {
      // Simular progresso
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 10;
          if (newProgress >= 100) {
            clearInterval(interval);
            return 100;
          }
          
          // Atualizar step baseado no novo progresso
          const nextStep = Math.floor(newProgress / 25);
          setCurrentStep(Math.min(nextStep, steps.length - 1));
          
          return newProgress;
        });
      }, 300);

      return () => clearInterval(interval);
    } else if (resultado?.status === 'concluido') {
      setProgress(100);
      setCurrentStep(steps.length - 1);
    }
  }, [isOpen, resultado?.status, steps.length]);

  if (!isOpen) return null;

  const isProcessing = resultado?.status === 'processando';
  const isComplete = resultado?.status === 'concluido';
  const hasError = resultado?.status === 'erro';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-gradient-to-br from-white to-slate-50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
          </div>
          
          <div className="relative flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {isProcessing && <Sparkles className="w-6 h-6 animate-pulse" />}
                {isComplete && <CheckCircle className="w-6 h-6" />}
                {hasError && <AlertCircle className="w-6 h-6" />}
                {isProcessing && 'Processando Dados...'}
                {isComplete && 'Processamento Concluído!'}
                {hasError && 'Erro no Processamento'}
              </h2>
              <p className="text-indigo-100 mt-1">
                {resultado?.mensagem || 'Aguarde enquanto processamos seus dados'}
              </p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Progress Steps */}
          {isProcessing && (
            <div className="space-y-4">
              <Progress value={progress} className="h-2" />
              
              <div className="grid grid-cols-4 gap-2">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === currentStep;
                  const isCompleted = index < currentStep;
                  
                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                        isActive ? 'bg-indigo-100 border-2 border-indigo-500' :
                        isCompleted ? 'bg-green-50 border border-green-200' :
                        'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <StepIcon className={`w-5 h-5 ${
                        isActive ? 'text-indigo-600 animate-pulse' :
                        isCompleted ? 'text-green-600' :
                        'text-slate-400'
                      }`} />
                      <span className={`text-xs text-center ${
                        isActive ? 'text-indigo-900 font-semibold' :
                        isCompleted ? 'text-green-900' :
                        'text-slate-500'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results */}
          {isComplete && resultado?.detalhes && (
            <div className="space-y-4">
              {/* Estatísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {resultado.detalhes.total_registros && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {resultado.detalhes.total_registros}
                    </div>
                    <div className="text-sm text-blue-900 mt-1">Registros</div>
                  </div>
                )}
                
                {resultado.detalhes.urgentes !== undefined && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">
                      {resultado.detalhes.urgentes}
                    </div>
                    <div className="text-sm text-red-900 mt-1">Urgentes</div>
                  </div>
                )}
                
                {resultado.detalhes.tarefas_criadas !== undefined && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {resultado.detalhes.tarefas_criadas}
                    </div>
                    <div className="text-sm text-purple-900 mt-1">Tarefas</div>
                  </div>
                )}
                
                {resultado.detalhes.score_medio !== undefined && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {resultado.detalhes.score_medio.toFixed(1)}
                    </div>
                    <div className="text-sm text-green-900 mt-1">Score Médio</div>
                  </div>
                )}
              </div>

              {/* Highlights */}
              {resultado.detalhes.highlights && resultado.detalhes.highlights.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-amber-900">Destaques da IA</h3>
                  </div>
                  <ul className="space-y-2">
                    {resultado.detalhes.highlights.map((highlight, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-amber-900">
                        <span className="text-amber-600 mt-0.5">•</span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              {resultado.detalhes.acoes_sugeridas && resultado.detalhes.acoes_sugeridas.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-indigo-600" />
                    Próximas Ações Recomendadas
                  </h3>
                  <div className="grid gap-2">
                    {resultado.detalhes.acoes_sugeridas.map((acao, index) => (
                      <Button
                        key={index}
                        onClick={() => {
                          if (acao.rota) {
                            navigate(createPageUrl(acao.rota));
                            onClose();
                          }
                        }}
                        variant="outline"
                        className="justify-start text-left h-auto py-3"
                      >
                        <div className="flex items-center gap-3 w-full">
                          {acao.icon && <acao.icon className="w-5 h-5 text-indigo-600 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900">{acao.titulo}</div>
                            {acao.descricao && (
                              <div className="text-sm text-slate-500 mt-0.5">{acao.descricao}</div>
                            )}
                          </div>
                          {acao.badge && (
                            <Badge className="flex-shrink-0">{acao.badge}</Badge>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {hasError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900">Erro no Processamento</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {resultado?.erro || 'Ocorreu um erro ao processar os dados. Por favor, tente novamente.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 flex justify-end gap-2">
          {isComplete && (
            <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700">
              Entendi
            </Button>
          )}
          {hasError && (
            <>
              <Button onClick={onClose} variant="outline">
                Fechar
              </Button>
              <Button onClick={() => resultado?.onRetry?.()} className="bg-indigo-600 hover:bg-indigo-700">
                Tentar Novamente
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}