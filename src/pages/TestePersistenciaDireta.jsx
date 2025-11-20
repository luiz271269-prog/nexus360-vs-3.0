import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Database, Zap, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function TestePersistenciaDireta() {
  const [testando, setTestando] = useState(false);
  const [resultados, setResultados] = useState([]);

  const executarTestes = async () => {
    setTestando(true);
    setResultados([]);
    const novosResultados = [];

    try {
      // ========== TESTE 1: CRIAR ZAPIPALOADNORMALIZED SEM SERVICE ROLE ==========
      console.log('[TESTE] 🧪 Teste 1: Criar ZapiPayloadNormalized (sem asServiceRole)...');
      try {
        const resultado1 = await base44.entities.ZapiPayloadNormalized.create({
          payload_bruto: { teste: 'sem_service_role', timestamp: Date.now() },
          instance_identificado: 'TESTE_DIRETO',
          evento: 'teste_sem_service_role',
          timestamp_recebido: new Date().toISOString(),
          sucesso_processamento: true
        });
        
        novosResultados.push({
          teste: '1. Create sem asServiceRole',
          status: 'sucesso',
          detalhes: {
            id_criado: resultado1.id,
            mensagem: 'Persistência funcionou SEM asServiceRole'
          }
        });
        console.log('[TESTE] ✅ Teste 1 passou:', resultado1.id);
      } catch (error) {
        novosResultados.push({
          teste: '1. Create sem asServiceRole',
          status: 'erro',
          detalhes: {
            erro: error.message,
            name: error.name,
            stack: error.stack,
            conclusao: 'Usuário não tem permissão direta - esperado se RLS está ativo'
          }
        });
        console.error('[TESTE] ❌ Teste 1 falhou:', error);
      }

      // ========== TESTE 2: CRIAR ZAPIPALOADNORMALIZED COM SERVICE ROLE ==========
      console.log('[TESTE] 🧪 Teste 2: Criar ZapiPayloadNormalized (COM asServiceRole)...');
      try {
        const resultado2 = await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
          payload_bruto: { teste: 'com_service_role', timestamp: Date.now() },
          instance_identificado: 'TESTE_DIRETO_SR',
          evento: 'teste_com_service_role',
          timestamp_recebido: new Date().toISOString(),
          sucesso_processamento: true
        });
        
        novosResultados.push({
          teste: '2. Create COM asServiceRole',
          status: 'sucesso',
          detalhes: {
            id_criado: resultado2.id,
            mensagem: 'Persistência funcionou COM asServiceRole - Este é o método usado pelo webhook'
          }
        });
        console.log('[TESTE] ✅ Teste 2 passou:', resultado2.id);
      } catch (error) {
        novosResultados.push({
          teste: '2. Create COM asServiceRole',
          status: 'erro',
          detalhes: {
            erro: error.message,
            name: error.name,
            code: error.code,
            stack: error.stack,
            conclusao: '🚨 CRÍTICO: Service Role não funciona - problema de configuração do Base44'
          }
        });
        console.error('[TESTE] ❌ Teste 2 falhou:', error);
      }

      // ========== TESTE 3: LISTAR REGISTROS CRIADOS ==========
      console.log('[TESTE] 🧪 Teste 3: Listar ZapiPayloadNormalized criados...');
      try {
        const lista = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
          { 
            $or: [
              { instance_identificado: 'TESTE_DIRETO' },
              { instance_identificado: 'TESTE_DIRETO_SR' }
            ]
          },
          '-timestamp_recebido',
          10
        );
        
        novosResultados.push({
          teste: '3. Listar registros criados',
          status: 'sucesso',
          detalhes: {
            total_encontrado: lista.length,
            registros: lista.map(r => ({
              id: r.id,
              instance: r.instance_identificado,
              evento: r.evento,
              created_date: r.created_date
            }))
          }
        });
        console.log('[TESTE] ✅ Teste 3 passou:', lista.length, 'registros');
      } catch (error) {
        novosResultados.push({
          teste: '3. Listar registros criados',
          status: 'erro',
          detalhes: {
            erro: error.message
          }
        });
        console.error('[TESTE] ❌ Teste 3 falhou:', error);
      }

      // ========== TESTE 4: VERIFICAR SCHEMA ==========
      console.log('[TESTE] 🧪 Teste 4: Verificar schema ZapiPayloadNormalized...');
      try {
        const schema = await base44.entities.ZapiPayloadNormalized.schema();
        
        const camposObrigatorios = Object.entries(schema.properties)
          .filter(([key, value]) => schema.required?.includes(key))
          .map(([key]) => key);
        
        novosResultados.push({
          teste: '4. Schema ZapiPayloadNormalized',
          status: 'sucesso',
          detalhes: {
            total_campos: Object.keys(schema.properties).length,
            campos: Object.keys(schema.properties),
            campos_obrigatorios: camposObrigatorios,
            required_array: schema.required
          }
        });
        console.log('[TESTE] ✅ Teste 4 passou');
      } catch (error) {
        novosResultados.push({
          teste: '4. Schema ZapiPayloadNormalized',
          status: 'erro',
          detalhes: {
            erro: error.message
          }
        });
        console.error('[TESTE] ❌ Teste 4 falhou:', error);
      }

      // ========== TESTE 5: CRIAR MESSAGE COM SERVICE ROLE ==========
      console.log('[TESTE] 🧪 Teste 5: Criar Message (COM asServiceRole)...');
      try {
        // Primeiro, criar um Contact de teste
        const contactTeste = await base44.asServiceRole.entities.Contact.create({
          nome: 'Teste Persistência',
          telefone: '5548999000999'
        });

        // Criar uma Thread de teste
        const threadTeste = await base44.asServiceRole.entities.MessageThread.create({
          contact_id: contactTeste.id,
          status: 'aberta'
        });

        // Criar a Message
        const messageTeste = await base44.asServiceRole.entities.Message.create({
          thread_id: threadTeste.id,
          sender_id: contactTeste.id,
          sender_type: 'contact',
          content: 'Teste de persistência direta',
          channel: 'whatsapp',
          status: 'enviada',
          whatsapp_message_id: `TEST_DIRECT_${Date.now()}`
        });
        
        novosResultados.push({
          teste: '5. Create Message COM asServiceRole',
          status: 'sucesso',
          detalhes: {
            message_id: messageTeste.id,
            contact_id: contactTeste.id,
            thread_id: threadTeste.id,
            whatsapp_message_id: messageTeste.whatsapp_message_id,
            mensagem: 'Fluxo completo Contact → Thread → Message funcionou'
          }
        });
        console.log('[TESTE] ✅ Teste 5 passou');
      } catch (error) {
        novosResultados.push({
          teste: '5. Create Message COM asServiceRole',
          status: 'erro',
          detalhes: {
            erro: error.message,
            name: error.name,
            stack: error.stack,
            conclusao: 'Falha ao criar Message - problema no schema ou permissões'
          }
        });
        console.error('[TESTE] ❌ Teste 5 falhou:', error);
      }

      setResultados(novosResultados);

    } catch (error) {
      console.error('[TESTE] ❌ Erro fatal:', error);
      toast.error('Erro nos testes: ' + error.message);
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Database className="w-8 h-8 text-purple-600" />
              Teste de Persistência Direta
            </h1>
            <p className="text-slate-600 mt-1">
              Testa a capacidade de criar registros diretamente no banco
            </p>
          </div>
          
          <Button 
            onClick={executarTestes}
            disabled={testando}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
            size="lg"
          >
            {testando ? (
              <>
                <Activity className="w-5 h-5 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Executar Testes
              </>
            )}
          </Button>
        </div>

        {/* Alerta */}
        <Alert className="bg-purple-50 border-purple-300">
          <Database className="h-4 w-4 text-purple-700" />
          <AlertDescription className="text-purple-800">
            <strong>O que estes testes fazem:</strong>
            <ol className="list-decimal ml-6 mt-2 space-y-1">
              <li>Tenta criar ZapiPayloadNormalized SEM asServiceRole (deve falhar por RLS)</li>
              <li>Tenta criar ZapiPayloadNormalized COM asServiceRole (deve funcionar)</li>
              <li>Lista os registros criados para confirmar persistência</li>
              <li>Verifica o schema da entidade</li>
              <li>Testa o fluxo completo Contact → Thread → Message</li>
            </ol>
            <p className="mt-2 font-semibold">
              Se o Teste 2 falhar, o problema é no Service Role do Base44, não no código.
            </p>
          </AlertDescription>
        </Alert>

        {/* Resultados */}
        {resultados.length > 0 && (
          <Card>
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-sm flex items-center gap-2">
                Resultados dos Testes
                <Badge className="ml-auto">
                  {resultados.filter(r => r.status === 'sucesso').length} / {resultados.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {resultados.map((resultado, idx) => (
                  <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      {resultado.status === 'sucesso' ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-slate-900">
                          {resultado.teste}
                        </h4>
                        <Badge 
                          className={`mt-1 text-xs ${
                            resultado.status === 'sucesso' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {resultado.status.toUpperCase()}
                        </Badge>
                        
                        {/* Detalhes */}
                        <details className="mt-2">
                          <summary className="text-xs text-purple-600 cursor-pointer hover:underline">
                            Ver detalhes completos
                          </summary>
                          <pre className="mt-2 text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
                            {JSON.stringify(resultado.detalhes, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Diagnóstico */}
        {resultados.length > 0 && (
          <Card className="border-2 border-purple-300 bg-purple-50">
            <CardHeader>
              <CardTitle className="text-sm text-purple-900">
                🔍 Diagnóstico Automático
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              {resultados.find(r => r.teste.includes('asServiceRole') && r.status === 'erro') ? (
                <Alert className="bg-red-50 border-red-300">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-900">
                    <strong>🚨 PROBLEMA CRÍTICO IDENTIFICADO:</strong>
                    <p className="mt-1">
                      O Service Role não consegue persistir dados. Isto significa que o webhook
                      NUNCA vai funcionar, mesmo que todo o resto esteja correto.
                    </p>
                    <p className="mt-2 font-semibold">
                      Solução: Verifique as configurações do Service Role no Base44.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : resultados.find(r => r.teste.includes('asServiceRole') && r.status === 'sucesso') ? (
                <Alert className="bg-green-50 border-green-300">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>✅ PERSISTÊNCIA FUNCIONA CORRETAMENTE</strong>
                    <p className="mt-1">
                      O Service Role consegue criar registros. O problema do webhook não é de permissão,
                      deve ser na normalização ou no fluxo de processamento.
                    </p>
                    <p className="mt-2 font-semibold">
                      Próximo passo: Verificar logs da função whatsappWebhook para ver onde está falhando.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}