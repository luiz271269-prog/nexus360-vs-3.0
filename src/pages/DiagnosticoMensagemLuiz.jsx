import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticoMensagemLuiz() {
  const [threadId, setThreadId] = useState('6932fbf5e7708be9b205eaae'); // Thread canônica do Luiz
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);

  const executarDiagnostico = async () => {
    if (!threadId.trim()) {
      toast.error('Digite um ID de thread');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('verificarMensagensSemRLS', {
        thread_id: threadId
      });

      if (response.data.success) {
        setResultado(response.data);
        toast.success(`✅ Diagnóstico concluído: ${response.data.total_mensagens} mensagens encontradas`);
      } else {
        toast.error(`❌ Erro: ${response.data.error}`);
      }
    } catch (error) {
      toast.error(`Erro ao executar diagnóstico: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-blue-900">🔍 Diagnóstico de Mensagens (RLS Bypass)</h1>
          <p className="text-blue-700">Verifica se mensagens estão salvas no banco ignorando políticas de RLS</p>
        </div>

        {/* Input */}
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              Configuração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID da Thread
              </label>
              <Input
                type="text"
                value={threadId}
                onChange={(e) => setThreadId(e.target.value)}
                placeholder="Ex: 6932fbf5e7708be9b205eaae"
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Thread canônica Luiz Liesch: <code className="bg-gray-100 px-2 py-1 rounded">6932fbf5e7708be9b205eaae</code>
              </p>
            </div>

            <Button
              onClick={executarDiagnostico}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Executando diagnóstico...
                </>
              ) : (
                'Executar Diagnóstico'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resultados */}
        {resultado && (
          <Card className={`border-2 ${resultado.total_mensagens > 0 ? 'border-green-200' : 'border-red-200'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {resultado.total_mensagens > 0 ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-green-600">Mensagens Encontradas ✅</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-600">Nenhuma Mensagem Encontrada ❌</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm font-medium">Total de Mensagens</p>
                  <p className="text-2xl font-bold text-blue-600">{resultado.total_mensagens}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm font-medium">Mensagens do Contato</p>
                  <p className="text-2xl font-bold text-green-600">{resultado.mensagens_contato}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-gray-600 text-sm font-medium">Mensagens do Usuário</p>
                  <p className="text-2xl font-bold text-purple-600">{resultado.mensagens_usuario}</p>
                </div>
              </div>

              {/* Amostra de Mensagens */}
              {resultado.amostra_mensagens_contato.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-800">📋 Amostra de Mensagens do Contato (Últimas 5)</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {resultado.amostra_mensagens_contato.map((msg, idx) => (
                      <div key={idx} className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm text-gray-700 break-words">{msg.content}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{msg.id.substring(0, 12)}...</code>
                            </p>
                          </div>
                          <Badge className="bg-green-600 text-white whitespace-nowrap">
                            {new Date(msg.created_date).toLocaleTimeString()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Análise de RLS */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-2">
                <h3 className="font-semibold text-blue-900">🔐 Análise de RLS</h3>
                {resultado.mensagens_contato > 0 ? (
                  <>
                    <p className="text-sm text-blue-800">
                      ✅ <strong>RLS PERMITE leitura</strong> de mensagens com <code className="bg-white px-1 py-0.5 rounded">sender_type: 'contact'</code>
                    </p>
                    <p className="text-sm text-gray-700">
                      O bloqueio de visibilidade está <strong>em outro lugar</strong>:
                    </p>
                    <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                      <li>🎯 <strong>Frontend Filter</strong>: ChatWindow está filtrando por `sender_type`?</li>
                      <li>👁️ <strong>threadVisibility.js</strong>: Está excluindo a thread para este usuário?</li>
                      <li>🔍 <strong>Message Query</strong>: `Message.filter()` está aplicando filtro extra?</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-red-800">
                      ❌ <strong>RLS BLOQUEIA leitura</strong> de mensagens com <code className="bg-white px-1 py-0.5 rounded">sender_type: 'contact'</code>
                    </p>
                    <p className="text-sm text-gray-700">
                      Solução: Adicione política RLS permissiva:
                    </p>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`CREATE POLICY "Allow viewing contact messages"
ON "Message"
FOR SELECT
USING (
  sender_type = 'contact' OR
  sender_id = auth.uid()
);`}
                    </pre>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informações Úteis */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-sm">📌 IDs do Caso Luiz Liesch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <p><strong>Contato ID:</strong> <code className="bg-white px-2 py-1 rounded">69264ec3c25028d438311f14</code></p>
            <p><strong>Thread Canônica:</strong> <code className="bg-white px-2 py-1 rounded">6932fbf5e7708be9b205eaae</code></p>
            <p><strong>Mensagem de Áudio (Z-API):</strong> <code className="bg-white px-2 py-1 rounded">696662b6d5e05e79b1318c13</code></p>
            <p><strong>Integração Z-API:</strong> <code className="bg-white px-2 py-1 rounded">68ecf26a5ca42338e76804a0</code></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}