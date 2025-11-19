import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Search,
  Database,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function AnalisadorLogsWebhook({ integracoes = [] }) {
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const analisarSistema = async () => {
    setAnalisando(true);
    setResultado(null);

    try {
      toast.info('🔍 Analisando sistema...', { duration: 2000 });

      // 1. Verificar payloads no banco
      const payloadsDB = await base44.entities.ZapiPayloadNormalized.list('-created_date', 20);
      
      // 2. Verificar mensagens recebidas
      const mensagensRecebidas = await base44.entities.Message.filter(
        { sender_type: 'contact' },
        '-created_date',
        20
      );

      // 3. Verificar threads
      const threads = await base44.entities.MessageThread.list('-created_date', 20);

      // 4. Analisar por instância
      const analiseInstancias = {};
      
      for (const int of integracoes) {
        const payloadsInstancia = payloadsDB.filter(p => 
          p.instance_identificado === int.instance_id_provider ||
          p.instance_identificado === int.nome_instancia
        );

        const mensagensInstancia = mensagensRecebidas.filter(m => {
          const thread = threads.find(t => t.id === m.thread_id);
          return thread?.whatsapp_integration_id === int.id;
        });

        analiseInstancias[int.id] = {
          nome: int.nome_instancia,
          instance_id: int.instance_id_provider,
          numero: int.numero_telefone,
          payloads_recebidos: payloadsInstancia.length,
          mensagens_salvas: mensagensInstancia.length,
          ultimo_payload: payloadsInstancia[0]?.created_date || null,
          ultima_mensagem: mensagensInstancia[0]?.created_date || null,
          status_conexao: int.status,
          problema_detectado: null
        };

        // Detectar problemas
        if (payloadsInstancia.length === 0) {
          analiseInstancias[int.id].problema_detectado = 'Nenhum payload recebido - Webhook pode não estar configurado';
        } else if (mensagensInstancia.length === 0) {
          analiseInstancias[int.id].problema_detectado = 'Payloads recebidos mas mensagens não salvas - Erro no processamento';
        } else if (payloadsInstancia.length > mensagensInstancia.length * 2) {
          analiseInstancias[int.id].problema_detectado = 'Muitos payloads vs poucas mensagens - Possível erro de parsing';
        }
      }

      setResultado({
        total_payloads: payloadsDB.length,
        total_mensagens: mensagensRecebidas.length,
        total_threads: threads.length,
        instancias: analiseInstancias,
        timestamp: new Date().toISOString()
      });

      toast.success('✅ Análise concluída!');

    } catch (error) {
      console.error('[ANALISADOR] Erro:', error);
      toast.error(`Erro na análise: ${error.message}`);
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            Analisador de Sistema
          </CardTitle>
          <Button 
            onClick={analisarSistema}
            disabled={analisando}
            className="gap-2"
          >
            {analisando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Analisar Sistema
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!resultado ? (
          <Alert>
            <AlertDescription>
              Clique em "Analisar Sistema" para diagnosticar o recebimento de mensagens em todas as instâncias.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Resumo Geral */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-600 font-medium">Payloads no Banco</p>
                <p className="text-2xl font-bold text-blue-900">{resultado.total_payloads}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-600 font-medium">Mensagens Salvas</p>
                <p className="text-2xl font-bold text-green-900">{resultado.total_mensagens}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-purple-600 font-medium">Conversas Ativas</p>
                <p className="text-2xl font-bold text-purple-900">{resultado.total_threads}</p>
              </div>
            </div>

            {/* Análise por Instância */}
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900">Análise por Instância:</h4>
              
              {Object.values(resultado.instancias).map((instancia) => (
                <div 
                  key={instancia.instance_id}
                  className={`border rounded-lg p-4 ${
                    instancia.problema_detectado 
                      ? 'bg-red-50 border-red-300' 
                      : 'bg-green-50 border-green-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h5 className="font-bold text-slate-900">{instancia.nome}</h5>
                      <p className="text-xs text-slate-600">{instancia.numero}</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        ID: {instancia.instance_id}
                      </p>
                    </div>
                    {instancia.problema_detectado ? (
                      <XCircle className="w-6 h-6 text-red-600" />
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-white rounded p-2 border border-slate-200">
                      <p className="text-xs text-slate-600">Payloads Recebidos</p>
                      <p className="text-lg font-bold text-slate-900">{instancia.payloads_recebidos}</p>
                    </div>
                    <div className="bg-white rounded p-2 border border-slate-200">
                      <p className="text-xs text-slate-600">Mensagens Salvas</p>
                      <p className="text-lg font-bold text-slate-900">{instancia.mensagens_salvas}</p>
                    </div>
                  </div>

                  {instancia.ultimo_payload && (
                    <p className="text-xs text-slate-600 mb-1">
                      Último payload: {new Date(instancia.ultimo_payload).toLocaleString('pt-BR')}
                    </p>
                  )}
                  
                  {instancia.ultima_mensagem && (
                    <p className="text-xs text-slate-600 mb-2">
                      Última mensagem: {new Date(instancia.ultima_mensagem).toLocaleString('pt-BR')}
                    </p>
                  )}

                  {instancia.problema_detectado && (
                    <Alert className="mt-3 bg-red-100 border-red-400">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800 text-sm">
                        <strong>Problema:</strong> {instancia.problema_detectado}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>

            {/* Recomendações */}
            {resultado.total_payloads === 0 && (
              <Alert className="bg-yellow-50 border-yellow-400">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>⚠️ PROBLEMA CRÍTICO:</strong> Nenhum payload está sendo salvo no banco de dados.
                  <br /><br />
                  <strong>Possíveis causas:</strong>
                  <ul className="list-disc ml-5 mt-2 space-y-1">
                    <li>Webhook URL não configurado na Z-API</li>
                    <li>Erro no código do whatsappWebhook.js antes de salvar</li>
                    <li>Problema de permissões no banco de dados</li>
                  </ul>
                  <br />
                  <strong>Próximos passos:</strong>
                  <ol className="list-decimal ml-5 mt-2 space-y-1">
                    <li>Verifique os logs da função whatsappWebhook no painel Base44</li>
                    <li>Teste o webhook usando o botão "Testar Recebimento"</li>
                    <li>Confirme que o URL do webhook está correto na Z-API</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-slate-500 text-center mt-4">
              Análise realizada em {new Date(resultado.timestamp).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}