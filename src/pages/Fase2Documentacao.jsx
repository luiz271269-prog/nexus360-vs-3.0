import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Zap, Brain, MessageSquare, Clock, TrendingUp } from "lucide-react";

export default function Fase2Documentacao() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <div>
                <h1 className="text-4xl font-bold text-gray-900">
                  FASE 2 - IMPLEMENTADA ✅
                </h1>
                <p className="text-lg text-gray-600 mt-1">
                  NLU + RAG + Autoatendimento Inteligente
                </p>
              </div>
            </div>
            <Badge className="bg-green-500 text-white px-4 py-2 text-lg">
              PRODUÇÃO
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">17</div>
              <div className="text-sm text-gray-600">Intenções Mapeadas</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">6</div>
              <div className="text-sm text-gray-600">FAQs Auto-Resolvidas</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">3</div>
              <div className="text-sm text-gray-600">Checkpoints Ativos</div>
            </div>
          </div>
        </div>

        {/* O Que Foi Implementado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-blue-600" />
              O Que Foi Implementado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* NLU */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                1. Classificador de Intenção (NLU)
              </h3>
              <p className="text-gray-600 mb-3">
                📁 <code className="bg-gray-100 px-2 py-1 rounded">functions/lib/NexusEngineProxy.js</code>
              </p>
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <span>Classificação automática de mensagens do cliente</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <span>17 tipos de intenção mapeados</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <span>Detecção de FAQ vs. Atendimento Humano</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <span>Sugestão automática de setor</span>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  'VENDAS_PRODUTO', 'VENDAS_ORCAMENTO', 'VENDAS_GERAL',
                  'SUPORTE_TECNICO', 'FINANCEIRO_BOLETO', 'FINANCEIRO_PAGAMENTO',
                  'FINANCEIRO_GERAL', 'FORNECEDOR', 'FAQ_HORARIO',
                  'FAQ_ENDERECO', 'FAQ_CONTATO', 'FAQ_GERAL',
                  'SAUDACAO', 'CANCELAMENTO', 'RECLAMACAO',
                  'ELOGIO', 'OUTRO'
                ].map(intent => (
                  <Badge key={intent} variant="outline" className="justify-center">
                    {intent}
                  </Badge>
                ))}
              </div>
            </div>

            {/* RAG */}
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                2. Sistema RAG (Autoatendimento)
              </h3>
              <p className="text-gray-600 mb-3">
                📁 <code className="bg-gray-100 px-2 py-1 rounded">functions/lib/NexusEngineProxy.js → queryRAG()</code>
              </p>
              <div className="bg-purple-50 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <span>Respostas automáticas para FAQs</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <span>Base de conhecimento integrada</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <span>Confiança em respostas (threshold: 0.9)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <span>Finalização automática de threads</span>
                </div>
              </div>
              
              <div className="mt-4 space-y-2">
                <div className="bg-white rounded p-3 border">
                  <div className="font-semibold text-sm text-gray-700">FAQs Implementadas:</div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>Horário de atendimento</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>Endereço da empresa</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>Telefone/Contatos</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>[Expansível para mais FAQs]</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fluxo Inteligente */}
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                3. Fluxo Inteligente (Gatekeeper de IA)
              </h3>
              <p className="text-gray-600 mb-3">
                📁 <code className="bg-gray-100 px-2 py-1 rounded">functions/preAtendimentoHandler.js</code>
              </p>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-white rounded-lg shadow p-4 flex-1">
                      <div className="text-center font-semibold text-gray-700">MENSAGEM RECEBIDA</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                  </div>
                  
                  <div className="bg-blue-100 rounded-lg p-4 border-2 border-blue-500">
                    <div className="font-semibold text-blue-900 mb-1">CHECKPOINT 1: Horário Expediente</div>
                    <div className="text-sm text-blue-700">FASE 1 - Governança</div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                  </div>
                  
                  <div className="bg-blue-100 rounded-lg p-4 border-2 border-blue-500">
                    <div className="font-semibold text-blue-900 mb-1">CHECKPOINT 2: Reset Universal</div>
                    <div className="text-sm text-blue-700">FASE 1 - UX</div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                  </div>
                  
                  <div className="bg-green-100 rounded-lg p-4 border-2 border-green-500">
                    <div className="font-semibold text-green-900 mb-1 flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      GATEKEEPER IA: NLU + RAG
                    </div>
                    <div className="text-sm text-green-700 font-semibold">FASE 2 - NOVO!</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-300">
                      <div className="font-semibold text-purple-900 mb-2">FAQ?</div>
                      <div className="text-sm text-purple-700">→ RAG AUTO</div>
                      <div className="text-xs text-purple-600 mt-1">Thread: COMPLETED_AUTO</div>
                    </div>
                    
                    <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-300">
                      <div className="font-semibold text-indigo-900 mb-2">Setor Claro?</div>
                      <div className="text-sm text-indigo-700">→ MAPEAR SETOR</div>
                      <div className="text-xs text-indigo-600 mt-1">→ Atendente</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                  </div>
                  
                  <div className="bg-gray-200 rounded-lg p-4 border border-gray-400">
                    <div className="font-semibold text-gray-700 mb-1">FLUXO LEGADO (Menu Numérico)</div>
                    <div className="text-sm text-gray-600">Contingência - IA não resolveu</div>
                  </div>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Exemplos de Uso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-indigo-600" />
              Exemplos de Uso Real
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-300">
              <div className="font-semibold text-green-900 mb-3">Exemplo 1: FAQ Resolvido por IA</div>
              <div className="space-y-2 text-sm">
                <div className="bg-white rounded p-2">
                  <span className="font-semibold">Cliente:</span> "Qual o horário de vocês?"
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-blue-50 rounded p-2">
                  <span className="font-semibold">NLU:</span> FAQ_HORARIO (confiança: 0.9)
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-purple-50 rounded p-2">
                  <span className="font-semibold">RAG:</span> ✅ Resposta encontrada
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-green-50 rounded p-2">
                  <span className="font-semibold">🤖 Resposta:</span> "🕐 Horário de Atendimento<br/>Segunda a Sexta: 8h às 18h..."
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-green-200 rounded p-2 font-semibold text-center">
                  Thread: COMPLETED_AUTO
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-300">
              <div className="font-semibold text-blue-900 mb-3">Exemplo 2: Roteamento Inteligente</div>
              <div className="space-y-2 text-sm">
                <div className="bg-white rounded p-2">
                  <span className="font-semibold">Cliente:</span> "Quero comprar um notebook"
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-blue-50 rounded p-2">
                  <span className="font-semibold">NLU:</span> VENDAS_PRODUTO (confiança: 0.85)
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-indigo-50 rounded p-2">
                  <span className="font-semibold">Setor:</span> vendas (auto-mapeado)
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-blue-200 rounded p-2 font-semibold text-center">
                  Thread: Atribuída a João (Vendas)
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-300">
              <div className="font-semibold text-gray-900 mb-3">Exemplo 3: Fallback para Menu</div>
              <div className="space-y-2 text-sm">
                <div className="bg-white rounded p-2">
                  <span className="font-semibold">Cliente:</span> "oi tudo bem?"
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-yellow-50 rounded p-2">
                  <span className="font-semibold">NLU:</span> SAUDACAO (confiança: 0.6)
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-red-50 rounded p-2">
                  ❌ Confiança baixa, não é FAQ
                </div>
                <div className="flex justify-center">↓</div>
                <div className="bg-gray-200 rounded p-2 font-semibold text-center">
                  🤖 Menu numérico tradicional
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Métricas Esperadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-600" />
              Métricas Esperadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Redução de Tempo</h3>
                <div className="space-y-3">
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-green-900">FAQ auto-resolvido</span>
                      <Badge className="bg-green-600">0s</Badge>
                    </div>
                    <div className="text-xs text-green-700">vs. 2-5 min humano</div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-blue-900">Roteamento direto</span>
                      <Badge className="bg-blue-600">3s</Badge>
                    </div>
                    <div className="text-xs text-blue-700">vs. 30-60s menu</div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">Fallback menu</span>
                      <Badge variant="outline">30-60s</Badge>
                    </div>
                    <div className="text-xs text-gray-700">Mesma experiência atual</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Taxa de Resolução</h3>
                <div className="space-y-3">
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-purple-900">Resolvidas por IA</span>
                      <Badge className="bg-purple-600">15-25%</Badge>
                    </div>
                    <div className="text-xs text-purple-700">Meta: Autoatendimento completo</div>
                  </div>
                  
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-indigo-900">Roteamento direto</span>
                      <Badge className="bg-indigo-600">40-50%</Badge>
                    </div>
                    <div className="text-xs text-indigo-700">Pulam menu numérico</div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">Fallback</span>
                      <Badge variant="outline">25-45%</Badge>
                    </div>
                    <div className="text-xs text-gray-700">Usam menu tradicional</div>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Como Testar */}
        <Card>
          <CardHeader>
            <CardTitle>🧪 Como Testar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-300">
              <h3 className="font-semibold text-blue-900 mb-3">Testes Manuais via WhatsApp:</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-gray-700 mb-1">1. Teste FAQ:</div>
                  <div className="text-gray-600">Enviar: "Qual o horário de atendimento?"</div>
                  <div className="text-green-600 mt-1">✅ Esperado: Resposta automática da IA</div>
                </div>
                
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-gray-700 mb-1">2. Teste Roteamento:</div>
                  <div className="text-gray-600">Enviar: "Quero comprar um notebook"</div>
                  <div className="text-green-600 mt-1">✅ Esperado: Roteamento direto para Vendas</div>
                </div>
                
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-gray-700 mb-1">3. Teste Fallback:</div>
                  <div className="text-gray-600">Enviar: "oi"</div>
                  <div className="text-green-600 mt-1">✅ Esperado: Menu numérico tradicional</div>
                </div>
                
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-gray-700 mb-1">4. Teste Fora de Expediente:</div>
                  <div className="text-gray-600">Enviar mensagem fora do horário</div>
                  <div className="text-green-600 mt-1">✅ Esperado: Mensagem automática de expediente</div>
                </div>
                
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-gray-700 mb-1">5. Teste Reset:</div>
                  <div className="text-gray-600">Enviar: "0"</div>
                  <div className="text-green-600 mt-1">✅ Esperado: Reiniciar conversa</div>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Próximos Passos */}
        <Card className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-600" />
              🚀 Próximos Passos (FASE 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4 border-l-4 border-yellow-500">
                <h3 className="font-semibold text-gray-900 mb-2">1. Roteamento Ponderado Avançado</h3>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Score baseado em carga do atendente</li>
                  <li>• Matching por skills/especialização</li>
                  <li>• Priorização de clientes VIP</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
                <h3 className="font-semibold text-gray-900 mb-2">2. Aprendizado Contínuo</h3>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Feedback loop de respostas</li>
                  <li>• Refinamento automático de intenções</li>
                  <li>• Expansão da base de conhecimento</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
                <h3 className="font-semibold text-gray-900 mb-2">3. Integrações LLM Reais</h3>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Substituir keywords por LLM real (GPT-4o-mini)</li>
                  <li>• RAG vetorial (embeddings)</li>
                  <li>• Respostas mais naturais</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">🎉 FASE 2 CONCLUÍDA COM SUCESSO!</h2>
          <p className="text-lg mb-6">
            Sistema de Pré-Atendimento agora possui Inteligência Artificial completa!
          </p>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white/20 rounded-lg p-3">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
              <div>IA (NLU + RAG)</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
              <div>Autoatendimento</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
              <div>Roteamento Inteligente</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
              <div>Fallback Robusto</div>
            </div>
          </div>
          <div className="mt-6 text-xl font-semibold">
            Pronto para FASE 3: Roteamento Ponderado Avançado! 🚀
          </div>
        </div>

      </div>
    </div>
  );
}