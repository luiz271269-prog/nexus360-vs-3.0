import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Plus,
  CheckCircle,
  AlertCircle,
  Trash2,
  Loader2,
  Zap,
  Eye,
  EyeOff,
  Shield,
  Edit,
  Key
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

import DiagnosticoZAPICentralizado from "./DiagnosticoZAPICentralizado";
import { getWebhookUrlProducao, getWebhookUrlAmbienteAtual } from "../lib/webhookUtils";

export default function ConfiguracaoWhatsAppHub({ integracoes, onRecarregar }) {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showTokenInstancia, setShowTokenInstancia] = useState(false);
  const [showTokenConta, setShowTokenConta] = useState(false);
  const [editandoIntegracao, setEditandoIntegracao] = useState(null);
  const [testando, setTestando] = useState(null); // State to track which integration is being tested

  const initialNovaIntegracaoState = {
    nome_instancia: "",
    numero_telefone: "",
    zapi_instance_id: "",
    zapi_token_instancia: "", // Token da URL
    zapi_client_token_conta: "", // Token de Segurança da Conta (Header)
    zapi_base_url: "https://api.z-api.io"
  };

  const [novaIntegracao, setNovaIntegracao] = useState(initialNovaIntegracaoState);

  const resetForm = () => {
    setNovaIntegracao(initialNovaIntegracaoState);
  };

  const validarCampos = () => {
    const erros = [];

    if (!novaIntegracao.nome_instancia?.trim()) {
      erros.push("Nome da instância é obrigatório");
    }

    if (!novaIntegracao.numero_telefone?.trim()) {
      erros.push("Número de telefone é obrigatório");
    }

    const instanceId = novaIntegracao.zapi_instance_id.trim();
    if (!instanceId) {
      erros.push("Instance ID é obrigatório");
    } else if (instanceId.includes('http') || instanceId.includes('/')) {
      erros.push("Instance ID inválido: não deve conter URL, apenas o ID");
    } else if (instanceId.length < 10) {
      erros.push("Instance ID muito curto: verifique se copiou corretamente");
    }

    const tokenInstancia = novaIntegracao.zapi_token_instancia.trim();
    if (!tokenInstancia) {
      erros.push("Token da Instância é obrigatório");
    } else if (tokenInstancia.length < 10) {
      erros.push("Token da Instância muito curto: verifique se copiou corretamente");
    }

    const tokenConta = novaIntegracao.zapi_client_token_conta.trim();
    if (!tokenConta) {
      erros.push("Client-Token de Segurança da Conta é obrigatório");
    } else if (tokenConta.length < 10) {
      erros.push("Client-Token de Segurança muito curto: verifique se copiou corretamente");
    }

    return erros;
  };

  const detectarAmbiente = () => {
    const hostname = window.location.hostname;
    
    // Detecta se é preview/staging
    const isPreview = hostname.includes('preview--');
    const isStaging = hostname.includes('staging');
    const isProduction = !isPreview && !isStaging;
    
    return {
      ambiente: isPreview ? 'preview' : (isStaging ? 'staging' : 'production'),
      isProduction,
      webhookUrl: isProduction ? getWebhookUrlProducao() : getWebhookUrlAmbienteAtual(),
      alertMessage: (isPreview || isStaging) ? 
        `⚠️ ATENÇÃO: Você está em ambiente de ${isPreview ? 'PREVIEW' : 'STAGING'}. Esta URL NÃO deve ser usada em produção!` : 
        null
    };
  };

  const handleCriarInstancia = async () => {
    try {
      setLoading(true);

      const erros = validarCampos();
      if (erros.length > 0) {
        toast.error("Erros de validação:", {
          description: erros.join('. '),
          duration: 10000
        });
        setLoading(false);
        return;
      }
      
      const instanceId = novaIntegracao.zapi_instance_id.trim();
      const tokenInstancia = novaIntegracao.zapi_token_instancia.trim();
      const tokenConta = novaIntegracao.zapi_client_token_conta.trim();
      const baseUrl = novaIntegracao.zapi_base_url.trim();

      // DETECTAR AMBIENTE E GERAR URL CORRETA
      const { ambiente, isProduction, webhookUrl, alertMessage } = detectarAmbiente();

      console.log('[CONFIG] 🌐 Ambiente detectado:', ambiente);
      console.log('[CONFIG] 🔗 URL do Webhook:', webhookUrl);

      // Alertar se não for produção
      if (alertMessage) {
        toast.warning(alertMessage, { duration: 10000 });
      }

      const dadosIntegracao = {
        nome_instancia: novaIntegracao.nome_instancia.trim(),
        numero_telefone: novaIntegracao.numero_telefone.trim(),
        status: 'pendente',
        tipo_conexao: 'webhook',
        api_provider: 'z_api',
        instance_id_provider: instanceId,
        api_key_provider: tokenInstancia, // Token da URL
        security_client_token_header: tokenConta, // Token de Segurança da Conta
        base_url_provider: baseUrl,
        webhook_url: webhookUrl, // SALVAR URL DO WEBHOOK
        configuracoes_avancadas: {
          auto_resposta_fora_horario: false,
          rate_limit_mensagens_hora: 100
        },
        estatisticas: {
          total_mensagens_enviadas: 0,
          total_mensagens_recebidas: 0,
          taxa_resposta_24h: 0,
          tempo_medio_resposta_minutos: 0
        },
        ultima_atividade: new Date().toISOString()
      };

      if (editandoIntegracao) {
        await base44.entities.WhatsAppIntegration.update(editandoIntegracao.id, dadosIntegracao);
        toast.success("Configurações salvas!");
      } else {
        await base44.entities.WhatsAppIntegration.create(dadosIntegracao);
        toast.success("Instância criada! Configure o webhook na Z-API.");
        
        // Mostrar URL do webhook com indicador de ambiente
        const ambienteLabel = isProduction ? 'PRODUÇÃO' : 'TESTE';
        toast.info(
          <div className="space-y-1">
            <p className="font-bold">{ambienteLabel}</p>
            <p className="text-sm">URL do Webhook:</p>
            <code className="text-xs bg-slate-100 px-2 py-1 rounded block">{webhookUrl}</code>
          </div>, 
          { duration: 15000 }
        );
      }

      setShowForm(false);
      setEditandoIntegracao(null);
      resetForm();

      if (onRecarregar) await onRecarregar();

    } catch (error) {
      console.error("[CONFIG] ❌ Erro ao salvar instância:", error);
      toast.error("Erro ao salvar instância", {
        description: error.message,
        duration: 10000
      });
    }

    setLoading(false);
  };

  const handleEditarIntegracao = (integracao) => {
    setEditandoIntegracao(integracao);
    setNovaIntegracao({
      nome_instancia: integracao.nome_instancia,
      numero_telefone: integracao.numero_telefone,
      zapi_instance_id: integracao.instance_id_provider,
      zapi_token_instancia: integracao.api_key_provider || "",
      zapi_client_token_conta: integracao.security_client_token_header || "",
      zapi_base_url: integracao.base_url_provider || "https://api.z-api.io"
    });
    setShowForm(true);
  };

  const handleExcluir = async (integracao) => {
    if (!confirm(`Excluir instância ${integracao.nome_instancia}?`)) return;

    try {
      await base44.entities.WhatsAppIntegration.delete(integracao.id);
      toast.success("Instância excluída!");
      if (onRecarregar) await onRecarregar();
    } catch (error) {
      console.error("[CONFIG] ❌ Erro ao excluir:", error);
      toast.error("Erro ao excluir instância");
    }
  };

  const testarConexao = async (integracao) => {
    setTestando(integracao.id);
    try {
      console.log('[TESTE] Iniciando teste de conexão completo...');
      console.log('[TESTE] Dados da integração:', {
        id: integracao.id,
        instanceId: integracao.instance_id_provider,
        hasToken: !!integracao.api_key_provider,
        hasClientToken: !!integracao.security_client_token_header
      });

      const webhookUrl = getWebhookUrlProducao();
      
      const response = await base44.functions.invoke('testarConexaoWhatsApp', {
        integration_id: integracao.id
      });

      console.log('[TESTE] Resposta recebida:', response.data);

      if (response.data.success) {
        const dados = response.data.dados || {};
        
        toast.success(
          <div className="space-y-2">
            <p className="font-bold">Conexão estabelecida!</p>
            <p className="text-sm">Status: {dados.conectado ? 'Conectado' : 'Desconectado'}</p>
            {dados.smartphoneConectado && (
              <p className="text-sm">Smartphone conectado</p>
            )}
            {dados.nomeInstancia && (
              <p className="text-sm">{dados.nomeInstancia}</p>
            )}
            {dados.telefone && (
              <p className="text-sm">{dados.telefone}</p>
            )}
            {dados.webhookConfigurado && (
              <p className="text-sm">Webhook configurado</p>
            )}
          </div>,
          { duration: 8000 }
        );

        // Update the list of integrations
        if (onRecarregar) await onRecarregar();
      } else {
        toast.error(
          <div>
            <p className="font-bold">Falha na conexão</p>
            <p className="text-sm mt-1">{response.data.error || 'Erro desconhecido'}</p>
            {response.data.detalhes && (
              <p className="text-xs mt-1 opacity-75">{response.data.detalhes}</p>
            )}
          </div>,
          { duration: 10000 }
        );
      }
    } catch (error) {
      console.error('[TESTE] Erro ao testar conexão:', error);
      toast.error(
        <div>
          <p className="font-bold">Erro ao testar</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      );
    } finally {
      setTestando(null);
    }
  };

  const statusBadge = (status) => {
    switch(status) {
      case "conectado":
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case "desconectado":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200"><AlertCircle className="w-3 h-3 mr-1" />Desconectado</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertCircle className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-green-900">Gerenciar Conexões WhatsApp</h2>
                <p className="text-green-700 mt-1">
                  Z-API - Configure múltiplas instâncias
                </p>
                <div className="flex gap-2 mt-3">
                  <Badge className="bg-green-100 text-green-800">
                    {integracoes.filter((i) => i.status === 'conectado').length} Conectadas
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800">
                    {integracoes.length} Total
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditandoIntegracao(null);
                resetForm();
                setShowForm(true);
              }}
              className="bg-gradient-to-r from-green-500 to-emerald-600">
              <Plus className="w-4 h-4 mr-2" />
              Nova Instância
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integracoes && integracoes.length > 0 && integracoes.map((integracao) => (
          <div key={`integracao-${integracao.id}`} className="space-y-4">
            <Card className={`hover:shadow-lg transition-all ${
              integracao.status === 'conectado' ? 'border-green-200 bg-green-50/30' : ''
            }`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{integracao.nome_instancia}</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">{integracao.numero_telefone}</p>

                    <div className="flex gap-2 mt-2 flex-wrap">
                      {statusBadge(integracao.status)}
                      <Badge variant="outline" className="bg-blue-100 text-blue-700">
                        Z-API
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditarIntegracao(integracao)}
                      className="h-8 w-8"
                      title="Editar Instância">
                      <Edit className="w-4 h-4 text-blue-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleExcluir(integracao)}
                      className="h-8 w-8 text-red-500"
                      title="Excluir Instância">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {integracao.estatisticas && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/50 rounded-lg p-2">
                      <div className="text-slate-500">Enviadas</div>
                      <div className="font-bold text-green-600">
                        {integracao.estatisticas.total_mensagens_enviadas || 0}
                      </div>
                    </div>
                    <div className="bg-white/50 rounded-lg p-2">
                      <div className="text-slate-500">Recebidas</div>
                      <div className="font-bold text-blue-600">
                        {integracao.estatisticas.total_mensagens_recebidas || 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            <DiagnosticoZAPICentralizado 
              integracao={integracao} 
              onRecarregar={onRecarregar}
              testarConexao={testarConexao} // Pass the testarConexao function
              isTesting={testando === integracao.id} // Pass the testing state
            />
          </div>
        ))}
      </div>

      {integracoes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-xl font-bold text-slate-700">Nenhuma instância configurada</p>
            <p className="text-slate-500 mt-2">Crie sua primeira instância WhatsApp</p>
            <Button onClick={() => setShowForm(true)} className="mt-4 bg-gradient-to-r from-green-500 to-emerald-600">
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Instância
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Criação/Edição */}
      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) {
          setEditandoIntegracao(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editandoIntegracao ? "Editar" : "Nova"} Instância Z-API
            </DialogTitle>
            <DialogDescription>
              {editandoIntegracao ? "Atualize as configurações" : "Configure uma nova instância"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* DETECÇÃO AUTOMÁTICA DE AMBIENTE */}
            {(() => {
              const { ambiente, isProduction, webhookUrl, alertMessage } = detectarAmbiente();
              return (
                <Alert className={isProduction ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}>
                  <Zap className={`h-4 w-4 ${isProduction ? 'text-green-600' : 'text-orange-600'}`} />
                  <AlertTitle className={isProduction ? "text-green-900" : "text-orange-900"}>
                    {isProduction ? 'Ambiente de PRODUÇÃO' : 'Ambiente de TESTE/PREVIEW'}
                  </AlertTitle>
                  <AlertDescription className={`${isProduction ? 'text-green-800' : 'text-orange-800'} text-sm`}>
                    <div className="space-y-2">
                      <p><strong>URL do Webhook que será configurada:</strong></p>
                      <code className="bg-white px-2 py-1 rounded block text-xs break-all">
                        {webhookUrl}
                      </code>
                      {!isProduction && (
                        <p className="text-orange-700 font-bold mt-2">
                          Esta URL é temporária e NÃO deve ser usada em produção!
                        </p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              );
            })()}

            <Alert className="bg-blue-50 border-blue-200">
              <Zap className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-900">Onde encontrar as credenciais da Z-API</AlertTitle>
              <AlertDescription className="text-blue-800 text-sm">
                <ol className="list-decimal ml-4 mt-2 space-y-1">
                  <li>Acesse <a href="https://www.z-api.io" target="_blank" rel="noopener noreferrer" className="underline font-semibold">https://www.z-api.io</a></li>
                  <li>Vá em "Instâncias" e selecione sua instância</li>
                  <li><strong>IMPORTANTE:</strong> Você precisa de DOIS tokens diferentes:</li>
                  <ul className="list-disc ml-4 mt-1">
                    <li><strong>Token da Instância:</strong> Encontrado na página da instância (vai na URL)</li>
                    <li><strong>Client-Token de Segurança:</strong> Encontrado em "Configurações da Conta" {'>'} "Token de Segurança" (vai no Header)</li>
                  </ul>
                  <li>Copie e cole com MUITO cuidado, sem espaços extras</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div>
              <Label>Nome da Instância *</Label>
              <Input
                value={novaIntegracao.nome_instancia}
                onChange={(e) => setNovaIntegracao({...novaIntegracao, nome_instancia: e.target.value})}
                placeholder="vendas-principal"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Número WhatsApp *</Label>
              <Input
                value={novaIntegracao.numero_telefone}
                onChange={(e) => setNovaIntegracao({...novaIntegracao, numero_telefone: e.target.value})}
                placeholder="+55 48 99999-9999"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Instance ID da Z-API *</Label>
              <Input
                value={novaIntegracao.zapi_instance_id}
                onChange={(e) => setNovaIntegracao({...novaIntegracao, zapi_instance_id: e.target.value.trim()})}
                placeholder="3E5D2BD1BF421127B24ECEF0269361A3"
                className="mt-1"
              />
            </div>

            {/* TOKEN DA INSTÂNCIA (URL) */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Key className="w-4 h-4 text-blue-600" />
                <Label>Token da Instância (vai na URL) *</Label>
              </div>
              <div className="relative mt-1">
                <Input
                  type={showTokenInstancia ? "text" : "password"}
                  value={novaIntegracao.zapi_token_instancia}
                  onChange={(e) => setNovaIntegracao({...novaIntegracao, zapi_token_instancia: e.target.value.trim()})}
                  placeholder="Cole o Token da Instância aqui"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowTokenInstancia(!showTokenInstancia)}>
                  {showTokenInstancia ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Token encontrado na página da instância no painel Z-API
              </p>
            </div>

            {/* CLIENT-TOKEN DE SEGURANÇA DA CONTA (HEADER) */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-purple-600" />
                <Label>Client-Token de Segurança da Conta (vai no Header) *</Label>
              </div>
              <div className="relative mt-1">
                <Input
                  type={showTokenConta ? "text" : "password"}
                  value={novaIntegracao.zapi_client_token_conta}
                  onChange={(e) => setNovaIntegracao({...novaIntegracao, zapi_client_token_conta: e.target.value.trim()})}
                  placeholder="Cole o Client-Token de Segurança aqui"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowTokenConta(!showTokenConta)}>
                  {showTokenConta ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-purple-600 mt-1">
                Token encontrado em "Configurações da Conta" {'>'} "Token de Segurança" (ex: F16***)
              </p>
              <div className="flex items-start gap-2 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Este é um token de nível de CONTA, não de instância. É o mesmo para todas as suas instâncias.</span>
              </div>
            </div>

            <div>
              <Label>URL Base da Z-API *</Label>
              <Input
                value={novaIntegracao.zapi_base_url}
                onChange={(e) => setNovaIntegracao({...novaIntegracao, zapi_base_url: e.target.value.trim()})}
                placeholder="https://api.z-api.io"
                className="mt-1 font-mono text-sm"
                readOnly
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCriarInstancia}
                disabled={loading}
                className="bg-gradient-to-r from-green-500 to-emerald-600">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {loading ? (editandoIntegracao ? 'Atualizando...' : 'Criando...') : (editandoIntegracao ? 'Atualizar' : 'Criar')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}