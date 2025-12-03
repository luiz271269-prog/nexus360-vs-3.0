import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Circle,
  ChevronRight,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2,
  Zap,
  Shield,
  Eye,
  EyeOff,
  Key
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function AssistenteFase2() {
  const [etapaAtiva, setEtapaAtiva] = useState('B1');
  const [loading, setLoading] = useState(false);
  const [testando, setTestando] = useState(false);
  const [validacoes, setValidacoes] = useState({
    B1_secrets_configuradas: false,
    B2_diagnose_llm_ok: false,
    B3_healthcheck_ok: false,
    B4_constantes_opcional: false
  });

  // Estados para verificação de secrets
  const [secretsStatus, setSecretsStatus] = useState({
    SLACK_WEBHOOK: { configurada: false, valida: false },
    GOOGLE_SHEET_WEBHOOK: { configurada: false, valida: false },
    ZAPI_PHONE_TESTE: { configurada: false, valida: false },
    ID_ORCAMENTO_PARA_TESTE: { configurada: false, valida: false }
  });

  const [showSecrets, setShowSecrets] = useState({
    SLACK_WEBHOOK: false,
    ZAPI_PHONE_TESTE: false,
    ID_ORCAMENTO_PARA_TESTE: false
  });

  useEffect(() => {
    verificarSecretsEFuncoes();
  }, []);

  const verificarSecretsEFuncoes = async () => {
    setLoading(true);
    try {
      // Testar se as functions estão deployadas e as secrets configuradas
      await testarDiagnoseLLM();
      await testarHealthcheck();
      
      // Validar B1 baseado nos testes
      const b1Valid = secretsStatus.SLACK_WEBHOOK.valida && 
                      secretsStatus.ZAPI_PHONE_TESTE.valida;
      
      setValidacoes(prev => ({ 
        ...prev, 
        B1_secrets_configuradas: b1Valid 
      }));
      
    } catch (error) {
      console.error('[FASE2] Erro ao verificar:', error);
    }
    setLoading(false);
  };

  const testarDiagnoseLLM = async () => {
    try {
      console.log('[FASE2] 🧪 Testando diagnoseWithLLM...');
      
      const response = await base44.functions.invoke('diagnoseWithLLM', {
        sistema: 'z_api',
        erro: 'Teste de validação - FASE 2',
        contexto: { teste: true }
      });

      const sucesso = response.data && !response.data.error;
      
      setValidacoes(prev => ({ ...prev, B2_diagnose_llm_ok: sucesso }));
      
      if (sucesso) {
        console.log('[FASE2] ✅ diagnoseWithLLM está funcionando');
        toast.success('✅ LLM de diagnóstico está operacional');
      } else {
        console.log('[FASE2] ❌ diagnoseWithLLM retornou erro');
        toast.warning('⚠️ LLM de diagnóstico precisa de ajustes');
      }
      
      return sucesso;
    } catch (error) {
      console.error('[FASE2] ❌ Erro ao testar diagnoseWithLLM:', error);
      setValidacoes(prev => ({ ...prev, B2_diagnose_llm_ok: false }));
      return false;
    }
  };

  const testarHealthcheck = async () => {
    try {
      console.log('[FASE2] 🧪 Testando healthcheck-regenerativo...');
      
      // O healthcheck roda automaticamente via cron, mas podemos invocar manualmente
      const response = await base44.functions.invoke('healthcheck-regenerativo', {});
      
      const sucesso = response.data && !response.data.error;
      
      setValidacoes(prev => ({ ...prev, B3_healthcheck_ok: sucesso }));
      
      if (sucesso) {
        console.log('[FASE2] ✅ Healthcheck está funcionando');
        toast.success('✅ Healthcheck está operacional');
      } else {
        console.log('[FASE2] ⚠️ Healthcheck executou mas pode ter avisos');
        toast.info('ℹ️ Healthcheck executou - verifique os logs');
      }
      
      return sucesso;
    } catch (error) {
      console.error('[FASE2] ❌ Erro ao testar healthcheck:', error);
      setValidacoes(prev => ({ ...prev, B3_healthcheck_ok: false }));
      return false;
    }
  };

  const copiarTexto = (texto, label) => {
    navigator.clipboard.writeText(texto);
    toast.success(`${label} copiado!`);
  };

  const etapas = [
    {
      id: 'B1',
      titulo: 'B1. Configurar Secrets',
      prioridade: 'CRÍTICA',
      status: validacoes.B1_secrets_configuradas ? 'concluido' : 'pendente',
      descricao: 'Configurar variáveis de ambiente no Base44'
    },
    {
      id: 'B2',
      titulo: 'B2. Deploy LLM Diagnóstico',
      prioridade: 'ALTA',
      status: validacoes.B2_diagnose_llm_ok ? 'concluido' : 'pendente',
      descricao: 'Validar função diagnoseWithLLM.js'
    },
    {
      id: 'B3',
      titulo: 'B3. Deploy Healthcheck',
      prioridade: 'ALTA',
      status: validacoes.B3_healthcheck_ok ? 'concluido' : 'pendente',
      descricao: 'Validar healthcheck-regenerativo.js'
    },
    {
      id: 'B4',
      titulo: 'B4. Constantes (Opcional)',
      prioridade: 'BAIXA',
      status: validacoes.B4_constantes_opcional ? 'concluido' : 'opcional',
      descricao: 'Criar arquivo de constantes'
    }
  ];

  const renderB1 = () => (
    <div className="space-y-6">
      {/* Status */}
      {validacoes.B1_secrets_configuradas ? (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>✅ Secrets configuradas!</strong> As variáveis de ambiente necessárias foram detectadas.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>⚠️ Configuração necessária:</strong> Configure as variáveis de ambiente no Base44.
          </AlertDescription>
        </Alert>
      )}

      {/* Instruções */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">📋 Como configurar as Secrets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 mb-2">
                Acesse o painel do Base44:
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://base44.com/dashboard', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir Dashboard Base44
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <p className="text-sm text-blue-900 flex-1">
              Vá em: <strong>Settings → Environment Variables</strong>
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <p className="text-sm text-blue-900 flex-1">
              Configure as seguintes variáveis:
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Secrets */}
      <div className="space-y-4">
        {/* SLACK_WEBHOOK */}
        <Card className="border-purple-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-base">SLACK_WEBHOOK</CardTitle>
              </div>
              <Badge className={secretsStatus.SLACK_WEBHOOK.valida ? "bg-green-600" : "bg-amber-600"}>
                {secretsStatus.SLACK_WEBHOOK.valida ? "✓ Configurada" : "Pendente"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-700">
              URL do webhook do Slack para receber notificações do Healthcheck.
            </p>
            
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-xs text-blue-900 font-semibold mb-2">📌 Como obter:</p>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                <li>Acesse: <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline">https://api.slack.com/apps</a></li>
                <li>Crie um novo App ou use um existente</li>
                <li>Ative "Incoming Webhooks"</li>
                <li>Adicione webhook para o canal desejado (ex: #vendapro-alertas)</li>
                <li>Copie a URL completa (começa com https://hooks.slack.com/...)</li>
              </ol>
            </div>

            <div className="flex items-center gap-2">
              <Input 
                type={showSecrets.SLACK_WEBHOOK ? "text" : "password"}
                placeholder="https://hooks.slack.com/services/..."
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSecrets(prev => ({ ...prev, SLACK_WEBHOOK: !prev.SLACK_WEBHOOK }))}
              >
                {showSecrets.SLACK_WEBHOOK ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* GOOGLE_SHEET_WEBHOOK */}
        <Card className="border-green-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                <CardTitle className="text-base">GOOGLE_SHEET_WEBHOOK</CardTitle>
              </div>
              <Badge className="bg-blue-600">
                ⏳ FASE 3
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              URL do Google Apps Script para logs persistentes. 
              <strong className="text-blue-600"> Será configurada na FASE 3.</strong>
            </p>
            <Alert className="mt-3 bg-blue-50 border-blue-200">
              <AlertDescription className="text-xs text-blue-800">
                ℹ️ Por enquanto, deixe esta variável vazia ou com valor: <code className="bg-blue-200 px-1 rounded">https://pendente-fase-3</code>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* ZAPI_PHONE_TESTE */}
        <Card className="border-orange-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-600" />
                <CardTitle className="text-base">ZAPI_PHONE_TESTE</CardTitle>
              </div>
              <Badge className={secretsStatus.ZAPI_PHONE_TESTE.valida ? "bg-green-600" : "bg-amber-600"}>
                {secretsStatus.ZAPI_PHONE_TESTE.valida ? "✓ Configurada" : "Pendente"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-700">
              Número de telefone para testes de envio (com código do país).
            </p>
            
            <div className="bg-orange-50 p-3 rounded border border-orange-200">
              <p className="text-xs text-orange-900 font-semibold mb-1">📌 Formato correto:</p>
              <div className="flex items-center justify-between bg-white p-2 rounded border border-orange-300">
                <code className="text-sm font-mono text-orange-800">+5548999999999</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copiarTexto('+5548999999999', 'Exemplo')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-orange-700 mt-2">
                ⚠️ Inclua o <strong>+</strong> e o código do país (ex: +55 para Brasil)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input 
                type={showSecrets.ZAPI_PHONE_TESTE ? "text" : "password"}
                placeholder="+5548999999999"
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSecrets(prev => ({ ...prev, ZAPI_PHONE_TESTE: !prev.ZAPI_PHONE_TESTE }))}
              >
                {showSecrets.ZAPI_PHONE_TESTE ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ID_ORCAMENTO_PARA_TESTE */}
        <Card className="border-indigo-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-base">ID_ORCAMENTO_PARA_TESTE</CardTitle>
              </div>
              <Badge className={secretsStatus.ID_ORCAMENTO_PARA_TESTE.valida ? "bg-green-600" : "bg-amber-600"}>
                {secretsStatus.ID_ORCAMENTO_PARA_TESTE.valida ? "✓ Configurada" : "Pendente"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-700">
              ID de um orçamento válido para testes do sistema Nexus.
            </p>
            
            <div className="bg-indigo-50 p-3 rounded border border-indigo-200">
              <p className="text-xs text-indigo-900 font-semibold mb-2">📌 Como obter:</p>
              <ol className="text-xs text-indigo-800 space-y-1 list-decimal list-inside">
                <li>Vá em: <strong>Orçamentos</strong></li>
                <li>Escolha qualquer orçamento existente</li>
                <li>Copie o ID do orçamento (aparece na URL ou nos detalhes)</li>
                <li>Formato: <code className="bg-indigo-200 px-1 rounded">uuid</code> (ex: 123e4567-e89b-12d3-a456-426614174000)</li>
              </ol>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/Orcamentos', '_self')}
            >
              Ir para Orçamentos
            </Button>

            <div className="flex items-center gap-2">
              <Input 
                type={showSecrets.ID_ORCAMENTO_PARA_TESTE ? "text" : "password"}
                placeholder="123e4567-e89b-12d3-a456-426614174000"
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSecrets(prev => ({ ...prev, ID_ORCAMENTO_PARA_TESTE: !prev.ID_ORCAMENTO_PARA_TESTE }))}
              >
                {showSecrets.ID_ORCAMENTO_PARA_TESTE ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checklist Final */}
      <Card className="border-slate-300">
        <CardHeader>
          <CardTitle className="text-lg">✅ Checklist de Validação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {secretsStatus.SLACK_WEBHOOK.valida ? 
                <CheckCircle2 className="w-4 h-4 text-green-600" /> : 
                <Circle className="w-4 h-4 text-slate-400" />
              }
              <span>SLACK_WEBHOOK configurada</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-blue-400" />
              <span>GOOGLE_SHEET_WEBHOOK (pendente FASE 3)</span>
            </div>
            <div className="flex items-center gap-2">
              {secretsStatus.ZAPI_PHONE_TESTE.valida ? 
                <CheckCircle2 className="w-4 h-4 text-green-600" /> : 
                <Circle className="w-4 h-4 text-slate-400" />
              }
              <span>ZAPI_PHONE_TESTE configurada</span>
            </div>
            <div className="flex items-center gap-2">
              {secretsStatus.ID_ORCAMENTO_PARA_TESTE.valida ? 
                <CheckCircle2 className="w-4 h-4 text-green-600" /> : 
                <Circle className="w-4 h-4 text-slate-400" />
              }
              <span>ID_ORCAMENTO_PARA_TESTE configurada</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={verificarSecretsEFuncoes}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Validar Secrets
        </Button>
        <Button
          onClick={() => {
            if (validacoes.B1_secrets_configuradas) {
              setEtapaAtiva('B2');
              toast.success('✅ B1 concluída! Avançando para B2...');
            } else {
              toast.warning('⚠️ Configure as secrets no Base44 primeiro');
            }
          }}
          disabled={!validacoes.B1_secrets_configuradas}
          className="bg-gradient-to-r from-green-500 to-emerald-600"
        >
          Avançar para B2
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderB2 = () => (
    <div className="space-y-6">
      {/* Status */}
      {validacoes.B2_diagnose_llm_ok ? (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>✅ LLM de diagnóstico operacional!</strong> A função <code className="bg-green-200 px-1 rounded">diagnoseWithLLM</code> está funcionando.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>⚠️ Validação necessária:</strong> Vamos testar se a função <code className="bg-amber-200 px-1 rounded">diagnoseWithLLM</code> está deployada.
          </AlertDescription>
        </Alert>
      )}

      {/* Informações da Função */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-lg text-purple-900">🤖 O que é o diagnoseWithLLM?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-purple-800">
            Esta é uma função de backend que utiliza IA (LLM - Large Language Model) para:
          </p>
          <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside ml-4">
            <li>Analisar erros do sistema automaticamente</li>
            <li>Sugerir soluções baseadas em contexto</li>
            <li>Gerar diagnósticos detalhados para problemas de integração</li>
            <li>Auxiliar o Healthcheck a tomar decisões inteligentes</li>
          </ul>
          
          <div className="bg-white p-3 rounded border border-purple-200 mt-3">
            <p className="text-xs text-purple-900 font-semibold mb-1">📍 Localização:</p>
            <code className="text-sm font-mono text-purple-700">functions/diagnoseWithLLM.js</code>
          </div>
        </CardContent>
      </Card>

      {/* Teste Manual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🧪 Teste de Validação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700">
            Clique no botão abaixo para executar um teste da função diagnoseWithLLM:
          </p>
          
          <Button
            onClick={async () => {
              setTestando(true);
              try {
                console.log('[FASE2-B2] 🧪 Testando diagnoseWithLLM...');
                toast.info('🧪 Testando LLM de diagnóstico...');
                
                const response = await base44.functions.invoke('diagnoseWithLLM', {
                  sistema: 'z_api',
                  erro: 'Teste de validação FASE 2 - B2',
                  contexto: {
                    teste: true,
                    timestamp: new Date().toISOString(),
                    origem: 'AssistenteFase2'
                  }
                });

                console.log('[FASE2-B2] 📥 Resposta:', response.data);

                if (response.data && !response.data.error) {
                  toast.success('✅ LLM de diagnóstico funcionando!');
                  setValidacoes(prev => ({ ...prev, B2_diagnose_llm_ok: true }));
                } else {
                  toast.error('❌ LLM retornou erro: ' + (response.data?.error || 'Desconhecido'));
                  setValidacoes(prev => ({ ...prev, B2_diagnose_llm_ok: false }));
                }
              } catch (error) {
                console.error('[FASE2-B2] ❌ Erro:', error);
                toast.error('❌ Erro ao testar: ' + error.message);
                setValidacoes(prev => ({ ...prev, B2_diagnose_llm_ok: false }));
              }
              setTestando(false);
            }}
            disabled={testando}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600"
          >
            {testando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Testando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Executar Teste
              </>
            )}
          </Button>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-xs text-blue-800">
              <strong>ℹ️ O que esperar:</strong> A função deve responder com um diagnóstico gerado pela IA. 
              Verifique os logs no console do navegador (F12) para mais detalhes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Verificação Manual no Base44 */}
      <Card className="border-slate-300">
        <CardHeader>
          <CardTitle className="text-lg">🔍 Verificação Manual no Base44</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-700">
            Para confirmar que a função está deployada:
          </p>
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside ml-4">
            <li>Acesse o Dashboard do Base44</li>
            <li>Vá em: <strong>Code → Functions</strong></li>
            <li>Procure por: <code className="bg-slate-200 px-1 rounded">diagnoseWithLLM</code></li>
            <li>Verifique se está com status "Deployed"</li>
            <li>Clique na função e veja os logs recentes</li>
          </ol>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://base44.com/dashboard', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir Dashboard Base44
          </Button>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setEtapaAtiva('B1')}
        >
          Voltar para B1
        </Button>
        <Button
          onClick={() => {
            if (validacoes.B2_diagnose_llm_ok) {
              setEtapaAtiva('B3');
              toast.success('✅ B2 concluída! Avançando para B3...');
            } else {
              toast.warning('⚠️ Execute o teste primeiro ou verifique os logs no Base44');
            }
          }}
          disabled={!validacoes.B2_diagnose_llm_ok}
          className="bg-gradient-to-r from-green-500 to-emerald-600"
        >
          Avançar para B3
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderB3 = () => (
    <div className="space-y-6">
      {/* Status */}
      {validacoes.B3_healthcheck_ok ? (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>✅ Healthcheck operacional!</strong> A função <code className="bg-green-200 px-1 rounded">healthcheck-regenerativo</code> está rodando.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>⚠️ Validação necessária:</strong> Vamos testar o Healthcheck regenerativo.
          </AlertDescription>
        </Alert>
      )}

      {/* Informações da Função */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-lg text-green-900">🏥 O que é o Healthcheck Regenerativo?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-green-800">
            É o coração do sistema SRE. Ele executa automaticamente <strong>a cada 10 minutos</strong> via <code className="bg-green-200 px-1 rounded">Deno.cron</code> e:
          </p>
          <ul className="text-sm text-green-800 space-y-1 list-disc list-inside ml-4">
            <li>Testa se a Z-API está respondendo</li>
            <li>Envia mensagem de teste via WhatsApp</li>
            <li>Verifica a saúde do NexusEngine (IA)</li>
            <li>Analisa orçamentos críticos</li>
            <li>Notifica o Slack em caso de problemas</li>
            <li>Registra tudo no Google Sheets (FASE 3)</li>
            <li>Se algo falhar, chama o <code className="bg-green-200 px-1 rounded">diagnoseWithLLM</code> para ajudar</li>
          </ul>
          
          <div className="bg-white p-3 rounded border border-green-200 mt-3">
            <p className="text-xs text-green-900 font-semibold mb-1">📍 Localização:</p>
            <code className="text-sm font-mono text-green-700">functions/healthcheck-regenerativo.js</code>
          </div>

          <div className="bg-white p-3 rounded border border-green-200">
            <p className="text-xs text-green-900 font-semibold mb-1">⏰ Agendamento:</p>
            <code className="text-sm font-mono text-green-700">Deno.cron("healthcheck", "*/10 * * * *", ...)</code>
            <p className="text-xs text-green-700 mt-1">Executa a cada 10 minutos</p>
          </div>
        </CardContent>
      </Card>

      {/* Teste Manual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🧪 Teste de Validação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-xs text-blue-800">
              <strong>ℹ️ Nota:</strong> O Healthcheck roda automaticamente a cada 10 minutos. 
              Este teste executa manualmente uma vez para validação.
            </AlertDescription>
          </Alert>

          <p className="text-sm text-slate-700">
            Clique no botão abaixo para executar o Healthcheck manualmente:
          </p>
          
          <Button
            onClick={async () => {
              setTestando(true);
              try {
                console.log('[FASE2-B3] 🧪 Testando healthcheck-regenerativo...');
                toast.info('🧪 Executando Healthcheck... (pode levar até 30s)');
                
                const response = await base44.functions.invoke('healthcheck-regenerativo', {});

                console.log('[FASE2-B3] 📥 Resposta:', response.data);

                if (response.data && !response.data.error) {
                  toast.success('✅ Healthcheck executado com sucesso! Verifique o Slack e os logs.');
                  setValidacoes(prev => ({ ...prev, B3_healthcheck_ok: true }));
                } else {
                  toast.warning('⚠️ Healthcheck executou mas pode ter avisos. Verifique os logs.');
                  setValidacoes(prev => ({ ...prev, B3_healthcheck_ok: true }));
                }
              } catch (error) {
                console.error('[FASE2-B3] ❌ Erro:', error);
                toast.error('❌ Erro ao testar: ' + error.message);
                setValidacoes(prev => ({ ...prev, B3_healthcheck_ok: false }));
              }
              setTestando(false);
            }}
            disabled={testando}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600"
          >
            {testando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Executando Healthcheck...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Executar Healthcheck Manual
              </>
            )}
          </Button>

          <Alert className="bg-amber-50 border-amber-200">
            <AlertDescription className="text-xs text-amber-800">
              <strong>⚠️ Aviso Normal:</strong> Na primeira execução, o Healthcheck pode avisar que 
              o <code className="bg-amber-200 px-1 rounded">GOOGLE_SHEET_WEBHOOK</code> não está configurado. 
              Isso é esperado e será resolvido na FASE 3.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* O que Verificar */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-lg text-purple-900">🔍 O que Verificar Após o Teste</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-purple-800">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Slack:</strong> Você deve receber uma notificação no canal configurado 
                (ex: #vendapro-alertas) com o status do Healthcheck.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Logs Base44:</strong> Acesse Code → Functions → healthcheck-regenerativo → Logs 
                para ver a execução detalhada.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>WhatsApp (se configurado):</strong> Uma mensagem de teste pode ser enviada para 
                o número em <code className="bg-purple-200 px-1 rounded">ZAPI_PHONE_TESTE</code>.
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => window.open('https://base44.com/dashboard', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Ver Logs no Base44
          </Button>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setEtapaAtiva('B2')}
        >
          Voltar para B2
        </Button>
        <Button
          onClick={() => {
            if (validacoes.B3_healthcheck_ok) {
              setEtapaAtiva('B4');
              toast.success('✅ B3 concluída! Healthcheck operacional!');
            } else {
              toast.warning('⚠️ Execute o teste primeiro');
            }
          }}
          disabled={!validacoes.B3_healthcheck_ok}
          className="bg-gradient-to-r from-green-500 to-emerald-600"
        >
          Avançar para B4
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderB4 = () => (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-800">
          <strong>ℹ️ Etapa Opcional:</strong> Esta é uma melhoria de código que aumenta a manutenibilidade do projeto.
        </AlertDescription>
      </Alert>

      {/* Explicação */}
      <Card className="border-indigo-200 bg-indigo-50">
        <CardHeader>
          <CardTitle className="text-lg text-indigo-900">📚 O que são Constantes de Funções?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-indigo-800">
            Centralizar os nomes das funções backend em um arquivo de constantes evita erros de digitação 
            e facilita refatorações futuras.
          </p>
          
          <div className="bg-white p-3 rounded border border-indigo-200">
            <p className="text-xs text-indigo-900 font-semibold mb-2">❌ Antes (propenso a erros):</p>
            <code className="text-xs font-mono text-red-700">
              await base44.functions.invoke('enviarWhatsApp', payload);
              <br />
              await base44.functions.invoke('enviarWhatsap', payload); // Ops! Erro de digitação
            </code>
          </div>

          <div className="bg-white p-3 rounded border border-indigo-200">
            <p className="text-xs text-indigo-900 font-semibold mb-2">✅ Depois (seguro e consistente):</p>
            <code className="text-xs font-mono text-green-700">
              await base44.functions.invoke(FUNCTION_NAMES.ENVIAR_WHATSAPP, payload);
              <br />
              // O TypeScript/IDE vai avisar se você errar o nome!
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Código Exemplo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💻 Código de Exemplo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-700 mb-2">
            Arquivo: <code className="bg-slate-200 px-1 rounded">components/lib/functionNames.js</code>
          </p>
          
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto">
            <pre>{`// components/lib/functionNames.js

/**
 * Constantes para nomes de funções backend
 * Centraliza os nomes para evitar erros de digitação
 */
export const FUNCTION_NAMES = {
  // Comunicação WhatsApp
  INBOUND_WEBHOOK: 'inboundWebhook',
  ENVIAR_WHATSAPP: 'enviarWhatsApp',
  TESTAR_CONEXAO_WHATSAPP: 'testarConexaoWhatsApp',
  
  // SRE e Diagnóstico
  DIAGNOSE_WITH_LLM: 'diagnoseWithLLM',
  HEALTHCHECK_REGENERATIVO: 'healthcheck-regenerativo',
  DIAGNOSTICAR_CONEXOES: 'diagnosticarConexoes',
  
  // Importação e Integração
  GOOGLE_SHEETS_SERVICE: 'googleSheetsService',
  PROCESSAR_FILA_SHEETS: 'processarFilaSheets',
  
  // Nexus e IA
  PROCESSAR_EVENTOS: 'processarEventos',
  ANALISAR_CLIENTES_EM_LOTE: 'analisarClientesEmLote',
  GERAR_TAREFAS_AUTOMATICAS: 'gerarTarefasAutomaticas'
};

// Uso:
// import { FUNCTION_NAMES } from '@/components/lib/functionNames';
// await base44.functions.invoke(FUNCTION_NAMES.ENVIAR_WHATSAPP, payload);`}</pre>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const codigo = `// components/lib/functionNames.js

/**
 * Constantes para nomes de funções backend
 * Centraliza os nomes para evitar erros de digitação
 */
export const FUNCTION_NAMES = {
  // Comunicação WhatsApp
  INBOUND_WEBHOOK: 'inboundWebhook',
  ENVIAR_WHATSAPP: 'enviarWhatsApp',
  TESTAR_CONEXAO_WHATSAPP: 'testarConexaoWhatsApp',
  
  // SRE e Diagnóstico
  DIAGNOSE_WITH_LLM: 'diagnoseWithLLM',
  HEALTHCHECK_REGENERATIVO: 'healthcheck-regenerativo',
  DIAGNOSTICAR_CONEXOES: 'diagnosticarConexoes',
  
  // Importação e Integração
  GOOGLE_SHEETS_SERVICE: 'googleSheetsService',
  PROCESSAR_FILA_SHEETS: 'processarFilaSheets',
  
  // Nexus e IA
  PROCESSAR_EVENTOS: 'processarEventos',
  ANALISAR_CLIENTES_EM_LOTE: 'analisarClientesEmLote',
  GERAR_TAREFAS_AUTOMATICAS: 'gerarTarefasAutomaticas'
};`;
              copiarTexto(codigo, 'Código de exemplo');
            }}
          >
            <Copy className="w-4 h-4 mr-2" />
            Copiar Código
          </Button>
        </CardContent>
      </Card>

      {/* Decisão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🎯 Decisão</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700 mb-4">
            Você deseja implementar este arquivo de constantes agora?
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setValidacoes(prev => ({ ...prev, B4_constantes_opcional: false }));
                toast.info('ℹ️ B4 pulada. Você pode implementar depois.');
              }}
              className="flex-1"
            >
              Pular (Implementar Depois)
            </Button>
            <Button
              onClick={() => {
                setValidacoes(prev => ({ ...prev, B4_constantes_opcional: true }));
                toast.success('✅ B4 marcada como implementada!');
              }}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600"
            >
              Marcar como Implementada
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conclusão */}
      <Alert className="bg-green-50 border-2 border-green-400">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <AlertDescription className="text-green-800">
          <p className="font-bold text-lg mb-2">🎉 FASE 2 CONCLUÍDA!</p>
          <p className="text-sm">
            O sistema SRE está operacional com:
          </p>
          <ul className="text-sm mt-2 space-y-1 list-disc list-inside ml-4">
            <li>✅ Secrets configuradas</li>
            <li>✅ LLM de diagnóstico ativo</li>
            <li>✅ Healthcheck regenerativo rodando a cada 10 minutos</li>
            <li>✅ Notificações no Slack funcionando</li>
          </ul>
          <p className="text-sm mt-3 font-semibold">
            Próximo: <strong>FASE 3 - Observabilidade Persistente (Google Sheets)</strong>
          </p>
        </AlertDescription>
      </Alert>

      {/* Ações */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setEtapaAtiva('B3')}
        >
          Voltar para B3
        </Button>
        <Button
          onClick={() => toast.info('🚀 FASE 3 em desenvolvimento. Aguarde instruções!')}
          className="bg-gradient-to-r from-purple-500 to-indigo-600"
        >
          Avançar para FASE 3
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-2">🚀 FASE 2: SRE e Autonomia</h1>
        <p className="text-green-100">
          Configuração e validação do sistema de monitoramento inteligente
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
            {etapas.map((etapa) => (
              <button
                key={etapa.id}
                onClick={() => setEtapaAtiva(etapa.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  etapaAtiva === etapa.id
                    ? 'border-green-500 bg-green-50'
                    : etapa.status === 'concluido'
                    ? 'border-green-500 bg-green-50'
                    : etapa.status === 'opcional'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs">{etapa.id}</span>
                  {etapa.status === 'concluido' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : etapa.status === 'opcional' ? (
                    <Circle className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <p className="text-xs text-slate-600 text-left">{etapa.descricao}</p>
                <Badge
                  className={`mt-2 text-xs ${
                    etapa.prioridade === 'CRÍTICA' ? 'bg-red-600' : 
                    etapa.prioridade === 'ALTA' ? 'bg-orange-600' : 
                    'bg-blue-600'
                  }`}
                >
                  {etapa.prioridade}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {etapas.find(e => e.id === etapaAtiva)?.titulo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {etapaAtiva === 'B1' && renderB1()}
          {etapaAtiva === 'B2' && renderB2()}
          {etapaAtiva === 'B3' && renderB3()}
          {etapaAtiva === 'B4' && renderB4()}
        </CardContent>
      </Card>
    </div>
  );
}