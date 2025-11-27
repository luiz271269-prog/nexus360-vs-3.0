import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Key,
  Settings,
  QrCode,
  Smartphone
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

// Configuração dos provedores
const PROVIDERS = {
  z_api: {
    nome: "Z-API",
    cor: "blue",
    baseUrl: "https://api.z-api.io",
    requerClientToken: true,
    webhookFn: "webhookWatsZapi",
    testarFn: "testarConexaoWhatsApp"
  },
  w_api: {
    nome: "W-API",
    cor: "purple",
    baseUrl: "https://api.w-api.app/v1",
    requerClientToken: false,
    webhookFn: "webhookWapi",
    testarFn: "testarConexaoWapi"
  }
};

export default function ConfiguracaoWhatsAppHub({ integracoes, onRecarregar, usuarioAtual }) {
  const [loading, setLoading] = useState(false);
  const [showTokenInstancia, setShowTokenInstancia] = useState(false);
  const [showTokenConta, setShowTokenConta] = useState(false);
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [testando, setTestando] = useState(null);

  // 🔐 CONTROLE DE ACESSO POR HIERARQUIA
  const isAdmin = usuarioAtual?.role === 'admin';
  const isGerente = ['gerente', 'coordenador'].includes(usuarioAtual?.attendant_role);
  const podeAdicionar = isAdmin; // Apenas admin adiciona novas conexões
  const podeEditar = isAdmin; // Apenas admin edita configuração completa
  const podeReiniciar = isAdmin || isGerente; // Gerente pode reiniciar
  const podeExcluir = isAdmin; // Apenas admin exclui

  const initialNovaIntegracaoState = {
    nome_instancia: "",
    numero_telefone: "",
    zapi_instance_id: "",
    zapi_token_instancia: "",
    zapi_client_token_conta: "",
    zapi_base_url: "https://api.z-api.io",
    setores_atendidos: ["geral"],
    setor_principal: "geral"
  };

  const [novaIntegracao, setNovaIntegracao] = useState(initialNovaIntegracaoState);

  const resetForm = () => {
    setNovaIntegracao(initialNovaIntegracaoState);
    setModoEdicao(false);
  };

  const selecionarIntegracao = (integracao) => {
    setIntegracaoSelecionada(integracao);
    setNovaIntegracao({
      nome_instancia: integracao.nome_instancia,
      numero_telefone: integracao.numero_telefone,
      zapi_instance_id: integracao.instance_id_provider,
      zapi_token_instancia: integracao.api_key_provider || "",
      zapi_client_token_conta: integracao.security_client_token_header || "",
      zapi_base_url: integracao.base_url_provider || "https://api.z-api.io"
    });
    setModoEdicao(false);
  };

  const iniciarNovaIntegracao = () => {
    setIntegracaoSelecionada(null);
    resetForm();
    setModoEdicao(true);
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

      if (integracaoSelecionada) {
        await base44.entities.WhatsAppIntegration.update(integracaoSelecionada.id, dadosIntegracao);
        toast.success("Configurações salvas!");
        setModoEdicao(false);
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

      resetForm();
      if (onRecarregar) await onRecarregar();
      
      // Reselecionar a integração atualizada
      if (integracaoSelecionada) {
        const atualizada = integracoes.find(i => i.id === integracaoSelecionada.id);
        if (atualizada) setIntegracaoSelecionada(atualizada);
      }

    } catch (error) {
      console.error("[CONFIG] ❌ Erro ao salvar instância:", error);
      toast.error("Erro ao salvar instância", {
        description: error.message,
        duration: 10000
      });
    }

    setLoading(false);
  };

  const handleEditarIntegracao = () => {
    setModoEdicao(true);
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
                  Z-API - Configure multiplas instancias
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
            {podeAdicionar && (
              <Button
                onClick={iniciarNovaIntegracao}
                className="bg-gradient-to-r from-green-500 to-emerald-600">
                <Plus className="w-4 h-4 mr-2" />
                Nova Instância
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Layout 2 Colunas: Lista Compacta | Edição + Diagnóstico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA 1: Lista Compacta de Conexões */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-green-600" />
            Conexões ({integracoes.length})
          </h3>
          
          {integracoes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Nenhuma conexão</p>
                {podeAdicionar && (
                  <Button onClick={iniciarNovaIntegracao} size="sm" className="mt-2 bg-green-600">
                    <Plus className="w-3 h-3 mr-1" />
                    Criar
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            integracoes.map((integracao) => (
              <div
                key={`integracao-${integracao.id}`}
                onClick={() => selecionarIntegracao(integracao)}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                  integracaoSelecionada?.id === integracao.id 
                    ? 'border-green-500 bg-green-50 shadow-md' 
                    : 'border-slate-200 bg-white hover:border-green-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{integracao.nome_instancia}</p>
                    <p className="text-xs text-slate-500 truncate">{integracao.numero_telefone}</p>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    {integracao.status === 'conectado' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* COLUNA 2: Edição + Diagnóstico (2 colunas de largura) */}
        <div className="lg:col-span-2 space-y-4">
          {!integracaoSelecionada && !modoEdicao ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Settings className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-semibold">Selecione uma conexão</p>
                <p className="text-sm text-slate-400 mt-1">Clique em uma conexão à esquerda para ver detalhes</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Card de Edição */}
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Edit className="w-5 h-5 text-blue-600" />
                      {modoEdicao ? (integracaoSelecionada ? 'Editar Instância' : 'Nova Instância') : 'Configurações'}
                    </CardTitle>
                    <div className="flex gap-2">
                      {!modoEdicao && podeEditar && (
                        <Button size="sm" variant="outline" onClick={handleEditarIntegracao}>
                          <Edit className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                      )}
                      {!modoEdicao && podeExcluir && integracaoSelecionada && (
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => handleExcluir(integracaoSelecionada)}>
                          <Trash2 className="w-3 h-3 mr-1" />
                          Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {modoEdicao ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Nome da Instância *</Label>
                          <Input
                            value={novaIntegracao.nome_instancia}
                            onChange={(e) => setNovaIntegracao({...novaIntegracao, nome_instancia: e.target.value})}
                            placeholder="vendas-principal"
                            className="mt-1 h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Número WhatsApp *</Label>
                          <Input
                            value={novaIntegracao.numero_telefone}
                            onChange={(e) => setNovaIntegracao({...novaIntegracao, numero_telefone: e.target.value})}
                            placeholder="+55 48 99999-9999"
                            className="mt-1 h-9"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Instance ID *</Label>
                        <Input
                          value={novaIntegracao.zapi_instance_id}
                          onChange={(e) => setNovaIntegracao({...novaIntegracao, zapi_instance_id: e.target.value.trim()})}
                          placeholder="3E5D2BD1BF421127B24ECEF0269361A3"
                          className="mt-1 h-9 font-mono text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Key className="w-3 h-3 text-blue-600" />
                            Token da Instância *
                          </Label>
                          <div className="relative mt-1">
                            <Input
                              type={showTokenInstancia ? "text" : "password"}
                              value={novaIntegracao.zapi_token_instancia}
                              onChange={(e) => setNovaIntegracao({...novaIntegracao, zapi_token_instancia: e.target.value.trim()})}
                              placeholder="Token..."
                              className="h-9 pr-8 font-mono text-xs"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-9 w-8"
                              onClick={() => setShowTokenInstancia(!showTokenInstancia)}>
                              {showTokenInstancia ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Shield className="w-3 h-3 text-purple-600" />
                            Client-Token Segurança *
                          </Label>
                          <div className="relative mt-1">
                            <Input
                              type={showTokenConta ? "text" : "password"}
                              value={novaIntegracao.zapi_client_token_conta}
                              onChange={(e) => setNovaIntegracao({...novaIntegracao, zapi_client_token_conta: e.target.value.trim()})}
                              placeholder="Token..."
                              className="h-9 pr-8 font-mono text-xs"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-9 w-8"
                              onClick={() => setShowTokenConta(!showTokenConta)}>
                              {showTokenConta ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">URL Base da API (Z-API ou W-API)</Label>
                        <Input
                          value={novaIntegracao.zapi_base_url}
                          onChange={(e) => setNovaIntegracao({...novaIntegracao, zapi_base_url: e.target.value.trim()})}
                          placeholder="https://api.z-api.io"
                          className="mt-1 h-9 font-mono text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={() => {
                          if (integracaoSelecionada) {
                            selecionarIntegracao(integracaoSelecionada);
                          } else {
                            setModoEdicao(false);
                            setIntegracaoSelecionada(null);
                          }
                        }}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleCriarInstancia}
                          disabled={loading}
                          className="bg-gradient-to-r from-green-500 to-emerald-600">
                          {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                          {integracaoSelecionada ? 'Salvar' : 'Criar'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Nome:</span>
                          <p className="font-semibold">{integracaoSelecionada?.nome_instancia}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Telefone:</span>
                          <p className="font-semibold">{integracaoSelecionada?.numero_telefone}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Status:</span>
                          <div className="mt-1">{statusBadge(integracaoSelecionada?.status)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Provedor:</span>
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 mt-1">
                            {integracaoSelecionada?.base_url_provider?.includes('w-api') ? 'W-API' : 'Z-API'}
                          </Badge>
                        </div>
                      </div>
                      {integracaoSelecionada?.estatisticas && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                          <div className="bg-green-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-slate-500">Enviadas</div>
                            <div className="font-bold text-green-600">
                              {integracaoSelecionada.estatisticas.total_mensagens_enviadas || 0}
                            </div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-slate-500">Recebidas</div>
                            <div className="font-bold text-blue-600">
                              {integracaoSelecionada.estatisticas.total_mensagens_recebidas || 0}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Diagnóstico - apenas se tiver integração selecionada e não estiver em modo edição */}
              {integracaoSelecionada && !modoEdicao && (
                <DiagnosticoZAPICentralizado 
                  integracao={integracaoSelecionada} 
                  onRecarregar={onRecarregar}
                  testarConexao={testarConexao}
                  isTesting={testando === integracaoSelecionada.id}
                />
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}