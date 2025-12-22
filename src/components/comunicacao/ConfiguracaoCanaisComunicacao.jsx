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
  Smartphone,
  MessageCircle
} from "lucide-react";

// Logos SVG inline para cada provedor
const WhatsAppLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const InstagramLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
  </svg>
);

const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const GoToLogo = () => (
  <svg viewBox="0 0 120 40" className="h-5" fill="currentColor">
    <rect x="0" y="28" width="40" height="8" fill="#FFD700"/>
    <text x="5" y="22" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="bold">GoTo</text>
  </svg>
);
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
import InstagramConnectionSetup from "./InstagramConnectionSetup";
import FacebookConnectionSetup from "./FacebookConnectionSetup";
import GoToConnectionSetup from "./GoToConnectionSetup";

// Configuração dos provedores
const PROVIDERS = {
  z_api: {
    nome: "Z-API",
    cor: "blue",
    baseUrl: "https://api.z-api.io",
    requerClientToken: true,
    webhookFn: "webhookWatsZapi",
    testarFn: "testarConexaoWhatsApp",
    icon: WhatsAppLogo,
    tipo: "whatsapp"
  },
  w_api: {
    nome: "W-API",
    cor: "purple",
    baseUrl: "https://api.w-api.app/v1",
    requerClientToken: false,
    webhookFn: "webhookWapi",
    testarFn: "testarConexaoWapi",
    icon: WhatsAppLogo,
    tipo: "whatsapp"
  },
  instagram_api: {
    nome: "Instagram",
    cor: "pink",
    baseUrl: "https://graph.facebook.com/v21.0",
    requerClientToken: false,
    webhookFn: "instagramWebhook",
    testarFn: null,
    icon: InstagramLogo,
    tipo: "instagram"
  },
  facebook_graph_api: {
    nome: "Facebook",
    cor: "indigo",
    baseUrl: "https://graph.facebook.com/v21.0",
    requerClientToken: false,
    webhookFn: "facebookWebhook",
    testarFn: null,
    icon: FacebookLogo,
    tipo: "facebook"
  },
  goto_phone: {
    nome: "GoTo (Telefonia)",
    cor: "teal",
    baseUrl: "https://api.goto.com",
    requerClientToken: false,
    webhookFn: "gotoWebhook",
    testarFn: null,
    icon: GoToLogo,
    tipo: "phone"
  }
};

export default function ConfiguracaoCanaisComunicacao({ integracoes, onRecarregar, usuarioAtual }) {
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
    api_provider: "z_api",
    instance_id: "",
    token_instancia: "",
    client_token_conta: "",
    setores_atendidos: ["geral"],
    setor_principal: "geral"
  };

  const [novaIntegracao, setNovaIntegracao] = useState(initialNovaIntegracaoState);
  const [qrCodeData, setQrCodeData] = useState({});
  const [gerandoQR, setGerandoQR] = useState(null);

  const resetForm = () => {
    setNovaIntegracao(initialNovaIntegracaoState);
    setModoEdicao(false);
  };

  const selecionarIntegracao = (integracao) => {
    setIntegracaoSelecionada(integracao);
    setNovaIntegracao({
      nome_instancia: integracao.nome_instancia,
      numero_telefone: integracao.numero_telefone,
      api_provider: integracao.api_provider || "z_api",
      instance_id: integracao.instance_id_provider || "",
      token_instancia: integracao.api_key_provider || "",
      client_token_conta: integracao.security_client_token_header || ""
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
    const provider = PROVIDERS[novaIntegracao.api_provider];

    if (!novaIntegracao.nome_instancia?.trim()) {
      erros.push("Nome da instância é obrigatório");
    }

    if (!novaIntegracao.numero_telefone?.trim()) {
      erros.push("Número de telefone é obrigatório");
    }

    const instanceId = novaIntegracao.instance_id.trim();
    if (!instanceId) {
      erros.push("Instance ID é obrigatório");
    } else if (instanceId.includes('http') || instanceId.includes('/')) {
      erros.push("Instance ID inválido: não deve conter URL, apenas o ID");
    } else if (instanceId.length < 10) {
      erros.push("Instance ID muito curto: verifique se copiou corretamente");
    }

    const tokenInstancia = novaIntegracao.token_instancia.trim();
    if (!tokenInstancia) {
      erros.push("Token da Instância é obrigatório");
    } else if (tokenInstancia.length < 10) {
      erros.push("Token da Instância muito curto: verifique se copiou corretamente");
    }

    // Client-Token apenas obrigatório para Z-API
    if (provider.requerClientToken) {
      const tokenConta = novaIntegracao.client_token_conta.trim();
      if (!tokenConta) {
        erros.push("Client-Token de Segurança da Conta é obrigatório para Z-API");
      } else if (tokenConta.length < 10) {
        erros.push("Client-Token de Segurança muito curto: verifique se copiou corretamente");
      }
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
      
      const provider = PROVIDERS[novaIntegracao.api_provider];
      const instanceId = novaIntegracao.instance_id.trim();
      const tokenInstancia = novaIntegracao.token_instancia.trim();
      const tokenConta = novaIntegracao.client_token_conta.trim();

      // DETECTAR AMBIENTE E GERAR URL CORRETA (com função de webhook específica)
      const { ambiente, isProduction, alertMessage } = detectarAmbiente();
      const baseAppUrl = window.location.origin.replace('preview.', '').replace(':3000', '');
      const webhookUrl = `${baseAppUrl}/api/functions/${provider.webhookFn}`;

      console.log('[CONFIG] 🌐 Ambiente detectado:', ambiente);
      console.log('[CONFIG] 🔗 URL do Webhook:', webhookUrl);
      console.log('[CONFIG] 📦 Provedor:', provider.nome);

      // Alertar se não for produção
      if (alertMessage) {
        toast.warning(alertMessage, { duration: 10000 });
      }

      const dadosIntegracao = {
        nome_instancia: novaIntegracao.nome_instancia.trim(),
        numero_telefone: novaIntegracao.numero_telefone.trim(),
        status: 'pendente',
        tipo_conexao: 'webhook',
        api_provider: novaIntegracao.api_provider,
        instance_id_provider: instanceId,
        api_key_provider: tokenInstancia,
        security_client_token_header: provider.requerClientToken ? tokenConta : null,
        base_url_provider: provider.baseUrl,
        webhook_url: webhookUrl,
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
        toast.success(`Instância ${provider.nome} criada! Configure o webhook.`);
        
        // Mostrar URL do webhook com indicador de ambiente e provedor
        const ambienteLabel = isProduction ? 'PRODUÇÃO' : 'TESTE';
        toast.info(
          <div className="space-y-1">
            <p className="font-bold">{ambienteLabel} - {provider.nome}</p>
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
      const provider = PROVIDERS[integracao.api_provider] || PROVIDERS.z_api;
      console.log('[TESTE] Iniciando teste de conexão...', provider.nome);
      
      const response = await base44.functions.invoke(provider.testarFn, {
        integration_id: integracao.id
      });

      console.log('[TESTE] Resposta recebida:', response.data);

      if (response.data.success) {
        const dados = response.data.dados || {};
        
        toast.success(
          <div className="space-y-2">
            <p className="font-bold">{provider.nome} - Conexão OK!</p>
            <p className="text-sm">Status: {dados.conectado ? 'Conectado' : 'Desconectado'}</p>
            {dados.smartphoneConectado && (
              <p className="text-sm">Smartphone conectado</p>
            )}
          </div>,
          { duration: 8000 }
        );

        if (onRecarregar) await onRecarregar();
      } else {
        toast.error(
          <div>
            <p className="font-bold">{provider.nome} - Falha</p>
            <p className="text-sm mt-1">{response.data.error || 'Erro desconhecido'}</p>
          </div>,
          { duration: 10000 }
        );
      }
    } catch (error) {
      console.error('[TESTE] Erro ao testar conexão:', error);
      toast.error(`Erro ao testar: ${error.message}`);
    } finally {
      setTestando(null);
    }
  };

  // Gerar QR Code / Pairing Code para W-API
  const gerarQRCode = async (integracao, usarPairingCode = false) => {
    setGerandoQR(integracao.id);
    try {
      const provider = PROVIDERS[integracao.api_provider];
      
      if (integracao.api_provider !== 'w_api') {
        toast.info("QR Code é gerenciado diretamente no painel da Z-API");
        setGerandoQR(null);
        return;
      }

      let url;
      if (usarPairingCode) {
        const telefone = integracao.numero_telefone.replace(/\D/g, '');
        url = `https://api.w-api.app/v1/instance/pairing-code?instanceId=${integracao.instance_id_provider}&phoneNumber=${telefone}`;
      } else {
        url = `https://api.w-api.app/v1/instance/qr-code?instanceId=${integracao.instance_id_provider}&image=enable`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${integracao.api_key_provider}`
        }
      });

      const data = await response.json();
      
      if (usarPairingCode) {
        setQrCodeData(prev => ({
          ...prev,
          [integracao.id]: { pairingCode: data.pairingCode || data.code, qrCodeUrl: null }
        }));
        toast.success("Código de pareamento gerado!");
      } else {
        setQrCodeData(prev => ({
          ...prev,
          [integracao.id]: { qrCodeUrl: data.qrcode || data.base64 || data.image, pairingCode: null }
        }));
        toast.success("QR Code gerado!");
      }

      await base44.entities.WhatsAppIntegration.update(integracao.id, {
        status: "pendente_qrcode"
      });
      if (onRecarregar) await onRecarregar();

    } catch (error) {
      console.error('[QR] Erro:', error);
      toast.error(`Erro ao gerar código: ${error.message}`);
    } finally {
      setGerandoQR(null);
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

  // Helper para obter badge de tipo de canal
  const getChannelBadge = (provider) => {
    const config = PROVIDERS[provider] || PROVIDERS.z_api;
    const colors = {
      whatsapp: "bg-green-100 text-green-700 border-green-300",
      instagram: "bg-pink-100 text-pink-700 border-pink-300",
      facebook: "bg-blue-100 text-blue-700 border-blue-300",
      phone: "bg-yellow-100 text-yellow-700 border-yellow-300"
    };
    
    const Logo = config.icon;
    
    return (
      <Badge className={`${colors[config.tipo]} text-[10px] px-2 py-0.5 flex items-center gap-1`}>
        <Logo />
        {config.nome}
      </Badge>
    );
  };

  return (
    <div className="space-y-8">
      {/* Instagram */}
      <InstagramConnectionSetup 
        integracoes={[]} 
        onRecarregar={onRecarregar}
      />

      {/* Facebook */}
      <FacebookConnectionSetup 
        integracoes={[]} 
        onRecarregar={onRecarregar}
      />

      {/* GoTo */}
      <GoToConnectionSetup 
        integracoes={[]} 
        onRecarregar={onRecarregar}
      />

      {/* WhatsApp */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-green-900">Canais de Comunicação</h2>
                <p className="text-green-700 mt-1">
                  WhatsApp, Instagram e Facebook - Configure suas conexões
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
                Nova Conexão
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Layout 2 Colunas: Lista Compacta | Edição + Diagnóstico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA 1: Lista Compacta de Conexões com Etiquetas */}
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
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getChannelBadge(integracao.api_provider)}
                      {integracao.status === 'conectado' ? (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="font-semibold text-sm text-slate-800 truncate">{integracao.nome_instancia}</p>
                    <p className="text-xs text-slate-500 truncate">{integracao.numero_telefone || integracao.phone_number}</p>
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
                      {modoEdicao ? (integracaoSelecionada ? 'Editar Conexão' : 'Nova Conexão') : 'Configurações'}
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
                      {/* Seletor de Provedor */}
                      <div>
                        <Label className="text-xs font-bold">Provedor da API *</Label>
                        <Select
                          value={novaIntegracao.api_provider}
                          onValueChange={(v) => setNovaIntegracao({...novaIntegracao, api_provider: v, client_token_conta: ""})}
                        >
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="z_api">
                              <span className="flex items-center gap-2">
                                <div className="w-4 h-4 text-green-600"><WhatsAppLogo /></div>
                                <Badge className="bg-blue-100 text-blue-700 text-[10px]">Z-API</Badge>
                                <span className="text-xs text-slate-600">API estável e robusta</span>
                              </span>
                            </SelectItem>
                            <SelectItem value="w_api">
                              <span className="flex items-center gap-2">
                                <div className="w-4 h-4 text-green-600"><WhatsAppLogo /></div>
                                <Badge className="bg-purple-100 text-purple-700 text-[10px]">W-API</Badge>
                                <span className="text-xs text-slate-600">QR Code e Pairing</span>
                              </span>
                            </SelectItem>
                            <SelectItem value="instagram_api">
                              <span className="flex items-center gap-2">
                                <div className="w-4 h-4 text-pink-600"><InstagramLogo /></div>
                                <Badge className="bg-slate-100 text-slate-700 text-[10px]">Meta API</Badge>
                                <span className="text-xs text-slate-600">Direct Messages</span>
                              </span>
                            </SelectItem>
                            <SelectItem value="facebook_graph_api">
                              <span className="flex items-center gap-2">
                                <div className="w-4 h-4 text-blue-600"><FacebookLogo /></div>
                                <Badge className="bg-slate-100 text-slate-700 text-[10px]">Graph API</Badge>
                                <span className="text-xs text-slate-600">Messenger</span>
                              </span>
                            </SelectItem>
                            <SelectItem value="goto_phone">
                              <span className="flex items-center gap-2">
                                <div className="w-5 h-4"><GoToLogo /></div>
                                <Badge className="bg-slate-100 text-slate-700 text-[10px]">Connect</Badge>
                                <span className="text-xs text-slate-600">SMS + Chamadas</span>
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

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
                          value={novaIntegracao.instance_id}
                          onChange={(e) => setNovaIntegracao({...novaIntegracao, instance_id: e.target.value.trim()})}
                          placeholder={novaIntegracao.api_provider === 'w_api' ? "T34398-VYR3QD..." : "3E5D2BD1BF421127B24ECEF0269361A3"}
                          className="mt-1 h-9 font-mono text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Key className="w-3 h-3 text-blue-600" />
                            {novaIntegracao.api_provider === 'w_api' ? 'Token (Bearer) *' : 'Token da Instância *'}
                          </Label>
                          <div className="relative mt-1">
                            <Input
                              type={showTokenInstancia ? "text" : "password"}
                              value={novaIntegracao.token_instancia}
                              onChange={(e) => setNovaIntegracao({...novaIntegracao, token_instancia: e.target.value.trim()})}
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
                        
                        {/* Client-Token apenas para Z-API */}
                        {novaIntegracao.api_provider === 'z_api' && (
                          <div>
                            <Label className="text-xs flex items-center gap-1">
                              <Shield className="w-3 h-3 text-purple-600" />
                              Client-Token Segurança *
                            </Label>
                            <div className="relative mt-1">
                              <Input
                                type={showTokenConta ? "text" : "password"}
                                value={novaIntegracao.client_token_conta}
                                onChange={(e) => setNovaIntegracao({...novaIntegracao, client_token_conta: e.target.value.trim()})}
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
                        )}
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
                          <span className="text-slate-500">Canal:</span>
                          <div className="mt-1">
                            {getChannelBadge(integracaoSelecionada?.api_provider)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Botões de QR Code / Pairing Code para W-API */}
                      {integracaoSelecionada?.api_provider === 'w_api' && integracaoSelecionada?.status !== 'conectado' && (
                        <div className="border-t pt-3">
                          <p className="text-xs text-slate-500 mb-2">Conectar WhatsApp:</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => gerarQRCode(integracaoSelecionada, false)}
                              disabled={gerandoQR === integracaoSelecionada.id}
                            >
                              {gerandoQR === integracaoSelecionada.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <QrCode className="w-3 h-3 mr-1" />}
                              QR Code
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => gerarQRCode(integracaoSelecionada, true)}
                              disabled={gerandoQR === integracaoSelecionada.id}
                            >
                              <Smartphone className="w-3 h-3 mr-1" />
                              Código Pareamento
                            </Button>
                          </div>
                          
                          {/* Mostrar QR Code ou Pairing Code */}
                          {qrCodeData[integracaoSelecionada.id] && (
                            <div className="mt-3 p-3 bg-white rounded-lg border-2 border-green-200">
                              {qrCodeData[integracaoSelecionada.id].pairingCode && (
                                <div className="text-center">
                                  <p className="text-xs text-slate-500 mb-2">Digite no celular:</p>
                                  <p className="text-2xl font-mono font-bold tracking-widest">
                                    {qrCodeData[integracaoSelecionada.id].pairingCode}
                                  </p>
                                </div>
                              )}
                              {qrCodeData[integracaoSelecionada.id].qrCodeUrl && (
                                <div className="flex justify-center">
                                  <img 
                                    src={qrCodeData[integracaoSelecionada.id].qrCodeUrl} 
                                    alt="QR Code" 
                                    className="w-40 h-40 border-2 border-green-500 rounded"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
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