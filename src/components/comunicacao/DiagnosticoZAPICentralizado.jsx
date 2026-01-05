import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Phone,
  Wifi,
  Server,
  Activity,
  Copy,
  Settings
} from "lucide-react";
import { toast } from "sonner";

// Configuração dos provedores - ISOLADOS
const PROVIDERS = {
  z_api: {
    nome: "Z-API",
    cor: "blue",
    webhookFn: "webhookWatsZapi",
    testarFn: "testarConexaoWhatsApp",
    requerClientToken: true,
    baseUrl: "https://api.z-api.io"
  },
  w_api: {
    nome: "W-API",
    cor: "purple",
    webhookFn: "webhookWapi",
    testarFn: "testarConexaoWapi",
    requerClientToken: false,
    baseUrl: "https://api.w-api.app/v1"
  },
  w_api_integrator: {
    nome: "W-API Integrador",
    cor: "indigo",
    webhookFn: "webhookWapi",
    testarFn: "testarConexaoWapi",
    requerClientToken: false,
    baseUrl: "https://api.w-api.app/v1"
  }
};

export default function DiagnosticoZAPICentralizado({ integracao, onRecarregar, testarConexao, isTesting }) {
  const [diagnostico, setDiagnostico] = useState(null);
  const [executando, setExecutando] = useState(false);

  const executarDiagnostico = async () => {
    setExecutando(true);
    setDiagnostico(null);

    // Detectar provedor
    const providerKey = integracao.api_provider || 'z_api';
    const provider = PROVIDERS[providerKey] || PROVIDERS.z_api;

    try {
      console.log('[DIAGNOSTICO] Iniciando diagnóstico completo da instância:', integracao.instance_id_provider, '- Provedor:', provider.nome);

      const resultado = {
        timestamp: new Date().toISOString(),
        instancia: integracao.nome_instancia,
        provider: provider.nome,
        testes: []
      };

      // Teste 1: Verificar conexão via função específica do provedor
      resultado.testes.push({
        nome: `Conexão ${provider.nome}`,
        status: 'executando',
        mensagem: `Testando conexão com ${provider.nome}...`
      });

      try {
        // Usar função de teste específica do provedor
        const response = await base44.functions.invoke(provider.testarFn, {
          integration_id: integracao.id
        });

        if (response.data?.success) {
          resultado.testes[0].status = 'sucesso';
          resultado.testes[0].mensagem = `Conectado! Status: ${response.data?.dados?.conectado ? 'Online' : 'Verificado'}`;
          resultado.testes[0].detalhes = response.data;
        } else {
          resultado.testes[0].status = 'erro';
          resultado.testes[0].mensagem = response.data?.error || 'Falha na conexão';
          resultado.testes[0].detalhes = response.data;
        }
      } catch (error) {
        resultado.testes[0].status = 'erro';
        resultado.testes[0].mensagem = `Erro: ${error.message}`;
      }

      // Teste 2: Verificar configurações (adaptar ao provedor)
      let configOk = !!integracao.api_key_provider;
      let configMsg = '';
      
      if (provider.requerClientToken) {
        // Z-API requer Client-Token
        configOk = configOk && !!integracao.security_client_token_header;
        configMsg = configOk 
          ? 'Token da Instância e Client-Token configurados' 
          : 'Tokens incompletos (Z-API requer Token + Client-Token)';
      } else {
        // W-API só precisa do Bearer Token
        configMsg = configOk 
          ? 'Bearer Token configurado corretamente' 
          : 'Bearer Token não configurado';
      }

      resultado.testes.push({
        nome: 'Configurações',
        status: configOk ? 'sucesso' : 'erro',
        mensagem: configMsg
      });

      // Teste 3: Verificar Security Token (apenas para Z-API)
      if (provider.requerClientToken) {
        resultado.testes.push({
          nome: 'Security Token',
          status: integracao.security_client_token_header ? 'sucesso' : 'erro',
          mensagem: integracao.security_client_token_header 
            ? 'Client-Token de Segurança configurado' 
            : 'Client-Token não configurado (obrigatório para Z-API)'
        });
      } else {
        resultado.testes.push({
          nome: 'Security Token',
          status: 'sucesso',
          mensagem: `Não aplicável para ${provider.nome} (usa Bearer Token)`
        });
      }

      // Teste 4: Verificar webhook (SEMPRE usar URL salva no banco)
      const webhookUrlSalva = integracao.webhook_url;

      resultado.testes.push({
        nome: 'Webhook',
        status: webhookUrlSalva ? 'sucesso' : 'erro',
        mensagem: webhookUrlSalva 
          ? `URL configurada e pronta para uso na ${provider.nome}` 
          : `❌ URL do webhook não configurada no banco de dados`,
        webhookUrl: webhookUrlSalva
      });

      setDiagnostico(resultado);
      
      const sucessos = resultado.testes.filter(t => t.status === 'sucesso').length;
      const total = resultado.testes.length;
      
      // ✅ ATUALIZAR STATUS: Se todos os testes passaram, marcar como conectado
      if (sucessos === total) {
        try {
          await base44.entities.WhatsAppIntegration.update(integracao.id, {
            status: 'conectado',
            ultima_atividade: new Date().toISOString(),
            token_status: 'valido',
            token_ultima_verificacao: new Date().toISOString()
          });
          console.log('[DIAGNOSTICO] ✅ Status atualizado para CONECTADO');
          toast.success(`✅ Diagnóstico ${provider.nome}: ${sucessos}/${total} testes OK - Status: Conectado`);
          
          // Recarregar lista de integrações
          if (onRecarregar) await onRecarregar();
        } catch (error) {
          console.error('[DIAGNOSTICO] Erro ao atualizar status:', error);
          toast.success(`Diagnóstico ${provider.nome}: ${sucessos}/${total} testes OK`);
        }
      } else {
        toast.warning(`Diagnóstico ${provider.nome}: ${sucessos}/${total} testes OK`);
      }

    } catch (error) {
      console.error('[DIAGNOSTICO] Erro ao executar teste:', error);
      toast.error('Erro ao executar diagnóstico');
      
      setDiagnostico({
        timestamp: new Date().toISOString(),
        instancia: integracao.nome_instancia,
        provider: provider.nome,
        erro: error.message,
        testes: []
      });
    } finally {
      setExecutando(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sucesso':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'erro':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'aviso':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'executando':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sucesso':
        return 'bg-green-50 border-green-200';
      case 'erro':
        return 'bg-red-50 border-red-200';
      case 'aviso':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-indigo-900">
            <Activity className="w-5 h-5" />
            Diagnóstico Completo
          </span>
          <div className="flex gap-2">
{(integracao?.api_provider === 'w_api' || integracao?.modo === 'integrator') && (
              <Button
                onClick={async () => {
                  try {
                    console.log('[DIAGNOSTICO] 🔧 Iniciando registro de webhooks para:', integracao.id);
                    toast.info('🔄 Registrando webhooks na W-API...');
                    
                    const response = await base44.functions.invoke('wapiGerenciarWebhooks', {
                      action: 'register',
                      integration_id: integracao.id
                    });
                    
                    console.log('[DIAGNOSTICO] 📥 Resposta:', response.data);
                    
                    if (response.data.success) {
                      toast.success(
                        <div className="space-y-1">
                          <p className="font-bold">✅ Webhooks registrados!</p>
                          {response.data.resultados?.map((r, i) => (
                            <p key={i} className="text-xs">
                              {r.sucesso ? '✅' : '❌'} {r.descricao}
                            </p>
                          ))}
                        </div>,
                        { duration: 6000 }
                      );
                      if (onRecarregar) await onRecarregar();
                    } else {
                      toast.error(
                        <div className="space-y-1">
                          <p className="font-bold">⚠️ {response.data.message}</p>
                          {response.data.resultados?.filter(r => !r.sucesso).map((r, i) => (
                            <p key={i} className="text-xs">{r.descricao}: {r.erro}</p>
                          ))}
                        </div>,
                        { duration: 10000 }
                      );
                    }
                  } catch (error) {
                    console.error('[DIAGNOSTICO] ❌ Erro ao registrar webhooks:', error);
                    toast.error('Erro ao executar: ' + error.message);
                  }
                }}
                size="sm"
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <Settings className="w-4 h-4 mr-2" />
                Registrar Webhooks W-API
              </Button>
            )}
            <Button
              onClick={executarDiagnostico}
              disabled={executando || isTesting}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {executando || isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Executar Diagnóstico
                </>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!diagnostico && !executando && (
          <Alert className="bg-indigo-100 border-indigo-300">
            <Activity className="h-4 w-4 text-indigo-700" />
            <AlertDescription className="text-indigo-900">
              Clique em "Executar Diagnóstico" para testar a conexão e configurações desta instância.
            </AlertDescription>
          </Alert>
        )}

        {diagnostico && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-indigo-700">
              <span>Executado em: {new Date(diagnostico.timestamp).toLocaleString('pt-BR')}</span>
            </div>

            {diagnostico.erro && (
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900">
                  {diagnostico.erro}
                </AlertDescription>
              </Alert>
            )}

            {diagnostico.testes && diagnostico.testes.length > 0 && diagnostico.testes.map((teste, index) => (
              <div
                key={`teste-${index}-${teste.nome}`}
                className={`p-4 rounded-lg border-2 ${getStatusColor(teste.status)} transition-all`}
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(teste.status)}
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1">{teste.nome}</h4>
                    {teste.webhookUrl ? (
                      <div className="space-y-2">
                        <div className="bg-white p-2 rounded border border-gray-300 flex items-center gap-2">
                          <code className="text-xs text-gray-700 flex-1 break-all font-mono">
                            {teste.webhookUrl}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(teste.webhookUrl);
                              toast.success("URL do webhook copiada!");
                            }}
                            className="flex-shrink-0 h-7 w-7 p-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-green-700">URL configurada e pronta para uso na {diagnostico.provider}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700">{teste.mensagem}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {diagnostico.testes.length > 0 && (
              <div className="mt-4 p-4 bg-white rounded-lg border-2 border-indigo-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-indigo-900">Resultado Geral:</span>
                  <Badge className={
                    diagnostico.testes.every(t => t.status === 'sucesso')
                      ? 'bg-green-100 text-green-800'
                      : diagnostico.testes.some(t => t.status === 'erro')
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }>
                    {diagnostico.testes.filter(t => t.status === 'sucesso').length} / {diagnostico.testes.length} OK
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}