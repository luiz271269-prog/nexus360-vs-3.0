import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import { X, Smartphone, Zap, CheckCircle, AlertCircle, QrCode, Loader2, RefreshCw, WifiOff, Power, Settings, Trash2, Copy, ExternalLink, Wifi, Database, Cloud } from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// CONFIGURAÇÃO WHATSAPP UNIFICADO - Suporta Z-API e W-API
// ============================================================================

const PROVIDERS = {
  z_api: {
    nome: "Z-API",
    cor: "blue",
    baseUrl: "https://api.z-api.io",
    campos: ["instance_id_provider", "api_key_provider", "security_client_token_header"],
    descricao: "API estável e robusta para WhatsApp Business",
    modo: "manual"
  },
  w_api: {
    nome: "W-API",
    cor: "purple",
    baseUrl: "https://api.w-api.app/v1",
    campos: ["instance_id_provider", "api_key_provider"],
    descricao: "API moderna com suporte a QR Code e Pairing Code",
    modo: "manual"
  },
  w_api_integrator: {
    nome: "W-API Integrador",
    cor: "indigo",
    baseUrl: "https://api.w-api.app/v1",
    campos: ["nome_instancia"],
    descricao: "Cria instâncias automaticamente via API (plano customizado)",
    modo: "integrator"
  }
};

export default function ConfiguracaoWhatsAppUnificado({ onClose }) {
  const [integracoes, setIntegracoes] = useState([]);
  const [novaIntegracao, setNovaIntegracao] = useState({
    nome_instancia: "",
    numero_telefone: "",
    api_provider: "z_api",
    instance_id_provider: "",
    api_key_provider: "",
    security_client_token_header: "",
    webhook_url: ""
  });
  const [integracaoEditando, setIntegracaoEditando] = useState(null);
  const [criandoInstancia, setCriandoInstancia] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrCodeData, setQrCodeData] = useState({});
  const [conectando, setConectando] = useState({});
  const [verificandoStatus, setVerificandoStatus] = useState({});
  const [editandoWebhook, setEditandoWebhook] = useState({});
  const [webhookTemporario, setWebhookTemporario] = useState({});
  const [deletandoId, setDeletandoId] = useState(null);
  const [instanciasProvedor, setInstanciasProvedor] = useState([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("conexoes");

  // Carregar integrações
  const carregarIntegracoes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.WhatsAppIntegration.list('-created_date');
      setIntegracoes(data);
    } catch (error) {
      console.error("Erro ao carregar integrações:", error);
      toast.error("Erro ao carregar configurações do WhatsApp");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarIntegracoes();
    // Inicializar webhook URL no formulário
    const defaultWebhook = getWebhookUrl({ api_provider: "z_api" });
    setNovaIntegracao(prev => ({ ...prev, webhook_url: defaultWebhook }));
  }, [carregarIntegracoes]);

  // ============================================================================
  // FUNÇÕES Z-API
  // ============================================================================
  const verificarStatusZAPI = async (integracao) => {
    const baseUrl = integracao.base_url_provider || "https://api.z-api.io";
    const url = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/status`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Client-Token': integracao.security_client_token_header
      }
    });
    
    const data = await response.json();
    return response.ok && data.connected === true && data.smartphoneConnected === true;
  };

  const gerarQRCodeZAPI = async (integracao) => {
    const baseUrl = integracao.base_url_provider || "https://api.z-api.io";
    const url = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/qr-code/image`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Client-Token': integracao.security_client_token_header
      }
    });
    
    const data = await response.json();
    return {
      qrCodeUrl: data.value?.image || data.qrcode,
      pairingCode: null
    };
  };

  // ============================================================================
  // FUNÇÕES W-API
  // ============================================================================
  const verificarStatusWAPI = async (integracao) => {
    const url = `https://api.w-api.app/v1/instance/status?instanceId=${integracao.instance_id_provider}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${integracao.api_key_provider}`
      }
    });
    
    const data = await response.json();
    return response.ok && data.connected === true;
  };

  const gerarQRCodeWAPI = async (integracao, usarPairingCode = false) => {
    let url;
    
    if (usarPairingCode) {
      // Pairing Code (código numérico)
      const telefone = integracao.numero_telefone.replace(/\D/g, '');
      url = `https://api.w-api.app/v1/instance/pairing-code?instanceId=${integracao.instance_id_provider}&phoneNumber=${telefone}`;
    } else {
      // QR Code (imagem)
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
      return {
        qrCodeUrl: null,
        pairingCode: data.pairingCode || data.code
      };
    } else {
      return {
        qrCodeUrl: data.qrcode || data.base64 || data.image,
        pairingCode: null
      };
    }
  };

  // ============================================================================
  // FUNÇÕES GENÉRICAS (roteiam para Z-API ou W-API)
  // ============================================================================
  const verificarStatus = async (integracao, silencioso = false) => {
    try {
      if (!silencioso) {
        setVerificandoStatus(prev => ({ ...prev, [integracao.id]: true }));
      }
      
      let conectado = false;
      
      if (integracao.api_provider === 'w_api') {
        conectado = await verificarStatusWAPI(integracao);
      } else {
        conectado = await verificarStatusZAPI(integracao);
      }
      
      const novoStatus = conectado ? 'conectado' : 'desconectado';
      
      if (integracao.status !== novoStatus) {
        await base44.entities.WhatsAppIntegration.update(integracao.id, {
          status: novoStatus,
          ultima_atividade: new Date().toISOString()
        });
        
        if (novoStatus === 'conectado') {
          toast.success(`✅ WhatsApp ${integracao.nome_instancia} conectado!`);
        }
        
        await carregarIntegracoes();
      }
      
      return conectado;
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      if (!silencioso) toast.error("Erro ao verificar status");
      return false;
    } finally {
      if (!silencioso) {
        setVerificandoStatus(prev => ({ ...prev, [integracao.id]: false }));
      }
    }
  };

  const gerarQRCode = async (integracao, usarPairingCode = false) => {
    setConectando(prev => ({ ...prev, [integracao.id]: true }));
    
    try {
      toast.info(usarPairingCode ? "Gerando código de pareamento..." : "Gerando QR Code...");
      
      let resultado;
      
      if (integracao.api_provider === 'w_api') {
        resultado = await gerarQRCodeWAPI(integracao, usarPairingCode);
      } else {
        resultado = await gerarQRCodeZAPI(integracao);
      }
      
      setQrCodeData(prev => ({
        ...prev,
        [integracao.id]: {
          ...resultado,
          timestamp: Date.now(),
          numeroTelefone: integracao.numero_telefone
        }
      }));
      
      await base44.entities.WhatsAppIntegration.update(integracao.id, {
        status: "pendente_qrcode",
        qr_code_url: resultado.qrCodeUrl
      });
      
      await carregarIntegracoes();
      toast.success(usarPairingCode ? "Código gerado!" : "QR Code gerado!");
      
    } catch (error) {
      console.error("Erro ao gerar código:", error);
      toast.error(error.message || "Erro ao gerar código de conexão");
    } finally {
      setConectando(prev => ({ ...prev, [integracao.id]: false }));
    }
  };

  const criarInstanciaIntegrador = async () => {
    const { nome_instancia } = novaIntegracao;
    
    if (!nome_instancia) {
      toast.error("Nome da instância é obrigatório");
      return;
    }
    
    setCriandoInstancia(true);
    try {
      toast.info("Criando instância na W-API...");
      
      const response = await base44.functions.invoke('wapiIntegratorManager', {
        action: 'createInstance',
        instanceName: nome_instancia
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Erro ao criar instância');
      }
      
      const { instanceId, token, webhookUrl } = response.data;
      
      // Salvar no banco com modo = integrator
      await base44.entities.WhatsAppIntegration.create({
        nome_instancia: nome_instancia.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        numero_telefone: "",
        api_provider: "w_api",
        modo: "integrator",
        instance_id_provider: instanceId,
        api_key_provider: token,
        base_url_provider: "https://api.w-api.app/v1",
        status: "desconectado",
        tipo_conexao: "webhook",
        webhook_url: webhookUrl
      });
      
      toast.success("✅ Instância criada com sucesso! Configure o número agora.");
      
      const defaultWebhook = getWebhookUrl({ api_provider: "z_api" });
      setNovaIntegracao({
        nome_instancia: "",
        numero_telefone: "",
        api_provider: "z_api",
        instance_id_provider: "",
        api_key_provider: "",
        security_client_token_header: "",
        webhook_url: defaultWebhook
      });
      
      await carregarIntegracoes();
      
    } catch (error) {
      console.error("Erro ao criar instância integrador:", error);
      toast.error(error.message || "Erro ao criar instância");
    } finally {
      setCriandoInstancia(false);
    }
  };

  const iniciarEdicao = (integracao) => {
    setIntegracaoEditando({
      id: integracao.id,
      nome_instancia: integracao.nome_instancia,
      numero_telefone: integracao.numero_telefone,
      api_provider: integracao.api_provider,
      instance_id_provider: integracao.instance_id_provider,
      api_key_provider: integracao.api_key_provider,
      security_client_token_header: integracao.security_client_token_header || "",
      webhook_url: integracao.webhook_url || getWebhookUrl(integracao)
    });
  };

  const cancelarEdicao = () => {
    setIntegracaoEditando(null);
  };

  const salvarEdicao = async () => {
    const { id, nome_instancia, numero_telefone, instance_id_provider, api_key_provider, security_client_token_header, api_provider, webhook_url } = integracaoEditando;
    
    if (!nome_instancia || !numero_telefone || !instance_id_provider || !api_key_provider) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    
    if (api_provider === 'z_api' && !security_client_token_header) {
      toast.error("Z-API requer o Client-Token de Segurança");
      return;
    }
    
    setSaving(true);
    try {
      await base44.entities.WhatsAppIntegration.update(id, {
        nome_instancia: nome_instancia.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        numero_telefone,
        instance_id_provider,
        api_key_provider,
        security_client_token_header: api_provider === 'z_api' ? security_client_token_header : null,
        webhook_url: webhook_url || getWebhookUrl({ api_provider })
      });
      
      toast.success("✅ Integração atualizada com sucesso!");
      setIntegracaoEditando(null);
      await carregarIntegracoes();
      
    } catch (error) {
      console.error("Erro ao atualizar integração:", error);
      toast.error(error.message || "Erro ao atualizar integração");
    } finally {
      setSaving(false);
    }
  };

  const salvarIntegracao = async () => {
    const { nome_instancia, numero_telefone, api_provider, instance_id_provider, api_key_provider, security_client_token_header } = novaIntegracao;
    
    // Se for integrador, chama função específica
    if (api_provider === 'w_api_integrator') {
      return criarInstanciaIntegrador();
    }
    
    if (!nome_instancia || !numero_telefone || !instance_id_provider || !api_key_provider) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    
    if (api_provider === 'z_api' && !security_client_token_header) {
      toast.error("Z-API requer o Client-Token de Segurança");
      return;
    }
    
    setSaving(true);
    try {
      const provider = PROVIDERS[api_provider];
      
      await base44.entities.WhatsAppIntegration.create({
        nome_instancia: nome_instancia.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        numero_telefone,
        api_provider: api_provider === 'w_api_integrator' ? 'w_api' : api_provider,
        modo: provider.modo || 'manual',
        instance_id_provider,
        api_key_provider,
        security_client_token_header: api_provider === 'z_api' ? security_client_token_header : null,
        base_url_provider: provider.baseUrl,
        status: "desconectado",
        tipo_conexao: "webhook",
        webhook_url: novaIntegracao.webhook_url || getWebhookUrl({ api_provider })
      });
      
      toast.success("Integração criada com sucesso!");
      
      const defaultWebhook = getWebhookUrl({ api_provider: "z_api" });
      setNovaIntegracao({
        nome_instancia: "",
        numero_telefone: "",
        api_provider: "z_api",
        instance_id_provider: "",
        api_key_provider: "",
        security_client_token_header: "",
        webhook_url: defaultWebhook
      });
      
      await carregarIntegracoes();
      
    } catch (error) {
      console.error("Erro ao criar integração:", error);
      toast.error(error.message || "Erro ao criar integração");
    } finally {
      setSaving(false);
    }
  };

  const deletarIntegracao = async (integracaoId) => {
    if (!confirm("⚠️ Tem certeza que deseja DELETAR esta integração?")) return;
    
    setDeletandoId(integracaoId);
    try {
      // ═══════════════════════════════════════════════════════════════════
      // 🏛️ ARQUITETURA "PORTEIRO CEGO" - DELEÇÃO DUPLA
      // ═══════════════════════════════════════════════════════════════════
      // 1. Buscar integração do banco ANTES de deletar
      // 2. SE modo="integrator": deletar do provedor W-API PRIMEIRO
      // 3. SÓ DEPOIS deletar do banco Base44
      // ═══════════════════════════════════════════════════════════════════
      
      const integracoesData = await base44.entities.WhatsAppIntegration.filter({ id: integracaoId });
      const integracao = integracoesData[0];
      
      if (!integracao) {
        toast.error("Integração não encontrada");
        return;
      }
      
      // Se for modo integrador W-API, deletar do provedor PRIMEIRO
      if (integracao.modo === 'integrator' && integracao.api_provider === 'w_api') {
        toast.info("🗑️ Removendo instância da W-API...");
        
        try {
          const response = await base44.functions.invoke('wapiIntegratorManager', {
            action: 'deleteInstance',
            instanceId: integracao.instance_id_provider
          });
          
          if (!response.data.success) {
            throw new Error(response.data.error || 'Erro ao deletar instância do provedor');
          }
          
          toast.success("✅ Instância removida da W-API");
        } catch (providerError) {
          console.error("Erro ao deletar do provedor:", providerError);
          
          // Perguntar se quer deletar do banco mesmo assim
          if (!confirm("⚠️ Não foi possível deletar da W-API. Deseja deletar do banco mesmo assim?\n\n(A instância continuará existindo na W-API)")) {
            setDeletandoId(null);
            return;
          }
          
          toast.warning("⚠️ Removendo apenas do banco local");
        }
      }
      
      // Agora deletar do banco Base44
      await base44.entities.WhatsAppIntegration.delete(integracaoId);
      setQrCodeData(prev => { const n = {...prev}; delete n[integracaoId]; return n; });
      await carregarIntegracoes();
      toast.success("✅ Integração removida do sistema!");
      
    } catch (error) {
      console.error("Erro ao deletar integração:", error);
      toast.error(error.message || "Erro ao deletar integração");
    } finally {
      setDeletandoId(null);
    }
  };

  // Gera a URL correta do webhook baseada no provedor
  const getWebhookUrl = (integracao) => {
    const baseUrl = window.location.origin;
    
    if (integracao.api_provider === 'w_api') {
      return `${baseUrl}/api/functions/webhookWapi`;
    } else {
      return `${baseUrl}/api/functions/webhookWatsZapi`;
    }
  };

  // Atualiza webhook URL automaticamente quando muda o provedor
  const handleProviderChange = (provider) => {
    const webhookUrl = getWebhookUrl({ api_provider: provider });
    setNovaIntegracao({
      ...novaIntegracao, 
      api_provider: provider, 
      security_client_token_header: "",
      webhook_url: webhookUrl
    });
  };

  const copiarWebhookUrl = (integracao) => {
    const url = integracao.webhook_url || getWebhookUrl(integracao);
    navigator.clipboard.writeText(url);
    toast.success("URL do webhook copiada!");
  };

  const salvarWebhookUrl = async (integracaoId) => {
    const novoUrl = webhookTemporario[integracaoId];
    if (!novoUrl || !novoUrl.trim()) {
      toast.error("URL do webhook não pode estar vazia");
      return;
    }

    try {
      await base44.entities.WhatsAppIntegration.update(integracaoId, {
        webhook_url: novoUrl.trim()
      });
      
      setEditandoWebhook(prev => ({ ...prev, [integracaoId]: false }));
      setWebhookTemporario(prev => { const n = {...prev}; delete n[integracaoId]; return n; });
      await carregarIntegracoes();
      toast.success("✅ URL do webhook atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar webhook:", error);
      toast.error("Erro ao salvar URL do webhook");
    }
  };

  const cancelarEdicaoWebhook = (integracaoId) => {
    setEditandoWebhook(prev => ({ ...prev, [integracaoId]: false }));
    setWebhookTemporario(prev => { const n = {...prev}; delete n[integracaoId]; return n; });
  };

  // ============================================================================
  // SINCRONIZAÇÃO COM PROVEDOR W-API
  // ============================================================================
  const sincronizarComProvedor = async () => {
    setSincronizando(true);
    try {
      toast.info("📡 Buscando instâncias da W-API...");
      
      const response = await base44.functions.invoke('wapiIntegratorManager', {
        action: 'listInstances',
        pageSize: 50,
        page: 1
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Erro ao listar instâncias');
      }
      
      setInstanciasProvedor(response.data.instances || []);
      toast.success(`✅ ${response.data.instances?.length || 0} instâncias encontradas na W-API`);
      
      // Auto-sincronizar status
      await atualizarStatusAutomatico(response.data.instances || []);
      
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      toast.error(error.message || "Erro ao sincronizar com W-API");
    } finally {
      setSincronizando(false);
    }
  };

  const atualizarStatusAutomatico = async (instanciasW) => {
    let atualizados = 0;
    
    for (const instW of instanciasW) {
      const intLocal = integracoes.find(i => 
        i.instance_id_provider === instW.instanceId && 
        i.api_provider === 'w_api'
      );
      
      if (intLocal) {
        const statusW = instW.connected ? 'conectado' : 'desconectado';
        const numeroW = instW.connectedPhone || '';
        
        // Atualizar se houver divergência
        if (intLocal.status !== statusW || 
            (numeroW && intLocal.numero_telefone !== numeroW)) {
          try {
            await base44.entities.WhatsAppIntegration.update(intLocal.id, {
              status: statusW,
              numero_telefone: numeroW || intLocal.numero_telefone,
              ultima_atividade: new Date().toISOString()
            });
            atualizados++;
          } catch (error) {
            console.error(`Erro ao atualizar ${intLocal.id}:`, error);
          }
        }
      }
    }
    
    if (atualizados > 0) {
      toast.success(`✅ ${atualizados} integração(ões) sincronizada(s)`);
      await carregarIntegracoes();
    }
  };

  const compararComProvedor = (integracao) => {
    const instW = instanciasProvedor.find(i => i.instanceId === integracao.instance_id_provider);
    
    if (!instW) {
      return { status: 'nao_encontrada', divergencias: ['Não existe na W-API'] };
    }
    
    const divergencias = [];
    const statusW = instW.connected ? 'conectado' : 'desconectado';
    
    if (integracao.status !== statusW) {
      divergencias.push(`Status: DB=${integracao.status} vs W-API=${statusW}`);
    }
    
    if (instW.connectedPhone && integracao.numero_telefone !== instW.connectedPhone) {
      divergencias.push(`Telefone: DB=${integracao.numero_telefone} vs W-API=${instW.connectedPhone}`);
    }
    
    return {
      status: divergencias.length > 0 ? 'divergente' : 'sincronizado',
      divergencias,
      instanciaWAPI: instW
    };
  };

  const iniciarEdicaoWebhook = (integracao) => {
    setEditandoWebhook(prev => ({ ...prev, [integracao.id]: true }));
    setWebhookTemporario(prev => ({ 
      ...prev, 
      [integracao.id]: integracao.webhook_url || getWebhookUrl(integracao) 
    }));
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case "conectado":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case "pendente_qrcode":
        return <Badge className="bg-yellow-100 text-yellow-700"><QrCode className="w-3 h-3 mr-1" />Aguardando QR</Badge>;
      case "erro_conexao":
        return <Badge className="bg-red-100 text-red-700"><AlertCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700"><WifiOff className="w-3 h-3 mr-1" />Desconectado</Badge>;
    }
  };

  const getProviderBadge = (provider) => {
    const p = PROVIDERS[provider] || PROVIDERS.z_api;
    return (
      <Badge className={`bg-${p.cor}-100 text-${p.cor}-700 border-${p.cor}-300`}>
        {p.nome}
      </Badge>
    );
  };

  const formatarPairingCode = (code) => {
    if (!code) return '';
    const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (clean.length === 8) {
      return `${clean.substring(0,4).split('').join(' ')} - ${clean.substring(4,8).split('').join(' ')}`;
    }
    return code;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Configuração WhatsApp</h2>
              <p className="text-sm text-slate-600">Suporta Z-API e W-API</p>
            </div>
          </div>
          <Button onClick={onClose} size="icon" variant="ghost">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="conexoes" className="gap-2">
              <Wifi className="w-4 h-4" />
              Conexões ({integracoes.length})
            </TabsTrigger>
            <TabsTrigger value="sincronizacao" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sincronização
            </TabsTrigger>
            <TabsTrigger value="nova" className="gap-2">
              <Zap className="w-4 h-4" />
              Nova Conexão
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: CONEXÕES ATIVAS */}
          <TabsContent value="conexoes" className="space-y-6">
          
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-green-600"/>
              <p className="text-slate-600 mt-2">Carregando...</p>
            </div>
          ) : integracoes.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed">
              <Smartphone className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Nenhuma conexão configurada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {integracoes.map((integracao) => (
                <div key={integracao.id} className="border rounded-xl p-5 bg-gradient-to-br from-white to-slate-50 hover:shadow-md transition-shadow">
                  {/* Info da Conexão */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-slate-900">{integracao.nome_instancia}</h4>
                        {getProviderBadge(integracao.api_provider)}
                      </div>
                      <p className="text-sm text-slate-600 mb-2">📱 {integracao.numero_telefone}</p>
                      {getStatusBadge(integracao.status)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => iniciarEdicao(integracao)}
                        size="icon"
                        variant="ghost"
                        className="text-blue-600 hover:bg-blue-50"
                        title="Editar"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => deletarIntegracao(integracao.id)}
                        size="icon"
                        variant="ghost"
                        className="text-red-500 hover:bg-red-50"
                        title="Deletar"
                        disabled={deletandoId === integracao.id}
                      >
                        {deletandoId === integracao.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* QR Code / Pairing Code */}
                  {qrCodeData[integracao.id] && integracao.status === "pendente_qrcode" && (
                    <div className="bg-white rounded-lg p-4 mb-4 border-2 border-green-200">
                      {qrCodeData[integracao.id].pairingCode && (
                        <div className="mb-4">
                          <h5 className="font-semibold text-center mb-2">Código de Pareamento</h5>
                          <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-300">
                            <p className="text-3xl font-mono font-bold text-center tracking-widest">
                              {formatarPairingCode(qrCodeData[integracao.id].pairingCode)}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {qrCodeData[integracao.id].qrCodeUrl && (
                        <div className="flex justify-center">
                          <img 
                            src={qrCodeData[integracao.id].qrCodeUrl} 
                            alt="QR Code" 
                            className="w-48 h-48 border-4 border-green-500 rounded-lg"
                          />
                        </div>
                      )}
                      
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Aguardando conexão...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* URL do Webhook - Editável */}
                  <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-purple-700 font-semibold">🔗 URL do Webhook</Label>
                      {!editandoWebhook[integracao.id] && (
                        <Button
                          onClick={() => iniciarEdicaoWebhook(integracao)}
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-purple-600 hover:text-purple-700"
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Editar
                        </Button>
                      )}
                    </div>
                    
                    {editandoWebhook[integracao.id] ? (
                      <div className="space-y-2">
                        <Input 
                          value={webhookTemporario[integracao.id] || ''}
                          onChange={(e) => setWebhookTemporario(prev => ({ ...prev, [integracao.id]: e.target.value }))}
                          className="text-xs bg-white font-mono"
                          placeholder="https://seu-app.base44.app/api/functions/webhookWapi"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => salvarWebhookUrl(integracao.id)}
                            size="sm"
                            className="flex-1 bg-purple-600 hover:bg-purple-700 h-7 text-xs"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Salvar
                          </Button>
                          <Button
                            onClick={() => cancelarEdicaoWebhook(integracao.id)}
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input 
                          value={integracao.webhook_url || getWebhookUrl(integracao)}
                          readOnly
                          className="text-xs bg-white font-mono"
                        />
                        <Button
                          onClick={() => copiarWebhookUrl(integracao)}
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    
                    <p className="text-[10px] text-purple-600 mt-1">
                      {integracao.api_provider === 'w_api' 
                        ? "Configure esta URL nos campos 'Ao receber mensagem', 'Ao enviar mensagem' e 'Ao desconectar' na W-API"
                        : "Configure esta URL no painel do provedor para receber webhooks"}
                    </p>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex flex-wrap gap-2">
                    {integracao.status === "desconectado" && (
                      <>
                        <Button
                          onClick={() => gerarQRCode(integracao, false)}
                          disabled={conectando[integracao.id]}
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {conectando[integracao.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4 mr-1" />}
                          QR Code
                        </Button>
                        {integracao.api_provider === 'w_api' && (
                          <Button
                            onClick={() => gerarQRCode(integracao, true)}
                            disabled={conectando[integracao.id]}
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            <Smartphone className="w-4 h-4 mr-1" />
                            Código
                          </Button>
                        )}
                      </>
                    )}
                    
                    {integracao.status === "conectado" && (
                      <Button
                        onClick={() => verificarStatus(integracao)}
                        size="sm"
                        variant="outline"
                        disabled={verificandoStatus[integracao.id]}
                      >
                        {verificandoStatus[integracao.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                        Verificar
                      </Button>
                    )}
                    
                    {integracao.status === "pendente_qrcode" && (
                      <Button
                        onClick={() => gerarQRCode(integracao, false)}
                        size="sm"
                        variant="outline"
                        disabled={conectando[integracao.id]}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Novo Código
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => copiarWebhookUrl(integracao)}
                      size="sm"
                      variant="ghost"
                      title="Copiar URL do Webhook"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Edição */}
        {integracaoEditando && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="w-6 h-6 text-blue-600" />
                  Editar Conexão
                </h3>
                <Button onClick={cancelarEdicao} size="icon" variant="ghost">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Provedor da API</Label>
                    <Input value={PROVIDERS[integracaoEditando.api_provider]?.nome || integracaoEditando.api_provider} disabled className="mt-1 bg-slate-100" />
                    <p className="text-xs text-slate-500 mt-1">Provedor não pode ser alterado</p>
                  </div>

                  <div>
                    <Label>Nome da Instância</Label>
                    <Input
                      value={integracaoEditando.nome_instancia}
                      onChange={(e) => setIntegracaoEditando({...integracaoEditando, nome_instancia: e.target.value})}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Número de WhatsApp</Label>
                    <Input
                      value={integracaoEditando.numero_telefone}
                      onChange={(e) => setIntegracaoEditando({...integracaoEditando, numero_telefone: e.target.value.replace(/\D/g, '')})}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Instance ID</Label>
                    <Input
                      value={integracaoEditando.instance_id_provider}
                      onChange={(e) => setIntegracaoEditando({...integracaoEditando, instance_id_provider: e.target.value})}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Token</Label>
                    <Input
                      value={integracaoEditando.api_key_provider}
                      onChange={(e) => setIntegracaoEditando({...integracaoEditando, api_key_provider: e.target.value})}
                      className="mt-1"
                      type="password"
                    />
                  </div>

                  {integracaoEditando.api_provider === 'z_api' && (
                    <div>
                      <Label>Client-Token de Segurança</Label>
                      <Input
                        value={integracaoEditando.security_client_token_header}
                        onChange={(e) => setIntegracaoEditando({...integracaoEditando, security_client_token_header: e.target.value})}
                        className="mt-1"
                        type="password"
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                  <Label className="text-sm text-purple-700 font-semibold mb-2 block flex items-center justify-between">
                    <span>🔗 URL do Webhook</span>
                    <Badge className="bg-purple-600 text-white text-xs">Obrigatório</Badge>
                  </Label>
                  <Input
                    value={integracaoEditando.webhook_url}
                    onChange={(e) => setIntegracaoEditando({...integracaoEditando, webhook_url: e.target.value})}
                    placeholder="https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi"
                    className="font-mono text-xs bg-white"
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-purple-700 font-medium">
                      💡 {integracaoEditando.api_provider === 'w_api' || integracaoEditando.modo === 'integrator'
                        ? "Configure esta URL nos campos 'Ao receber mensagem', 'Ao enviar mensagem' e 'Ao desconectar' na W-API"
                        : "Configure esta URL no painel da Z-API para receber webhooks"}
                    </p>
                    <p className="text-xs text-purple-600">
                      ✅ Cole exatamente esta URL no painel do provedor para receber mensagens corretamente
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button onClick={cancelarEdicao} variant="outline">
                  Cancelar
                </Button>
                <Button 
                  onClick={salvarEdicao} 
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </div>
        )}

        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-green-600" />
          Adicionar Nova Conexão
        </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Provedor */}
            <div>
              <Label>Provedor da API</Label>
              <Select
                value={novaIntegracao.api_provider}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="z_api">Z-API</SelectItem>
                  <SelectItem value="w_api">W-API (QR Code e Pairing)</SelectItem>
                  <SelectItem value="w_api_integrator">W-API Integrador (Custom)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">{PROVIDERS[novaIntegracao.api_provider]?.descricao}</p>
            </div>
            
            {/* Nome */}
            <div>
              <Label>Nome da Instância</Label>
              <Input
                placeholder="Ex: vendas-principal"
                value={novaIntegracao.nome_instancia}
                onChange={(e) => setNovaIntegracao({...novaIntegracao, nome_instancia: e.target.value})}
                className="mt-1"
              />
            </div>
            
            {/* Telefone - ocultar para integrador */}
            {novaIntegracao.api_provider !== 'w_api_integrator' && (
              <div>
                <Label>Número de WhatsApp</Label>
                <Input
                  placeholder="5548999999999"
                  value={novaIntegracao.numero_telefone}
                  onChange={(e) => setNovaIntegracao({...novaIntegracao, numero_telefone: e.target.value.replace(/\D/g, '')})}
                  className="mt-1"
                />
              </div>
            )}
            
            {/* Instance ID - ocultar para integrador */}
            {novaIntegracao.api_provider !== 'w_api_integrator' && (
              <div>
                <Label>Instance ID</Label>
                <Input
                  placeholder={novaIntegracao.api_provider === 'w_api' ? "Ex: T34398-VYR3QD..." : "Ex: 3E5D2BD1BF421127B24ECEF0269361A3"}
                  value={novaIntegracao.instance_id_provider}
                  onChange={(e) => setNovaIntegracao({...novaIntegracao, instance_id_provider: e.target.value})}
                  className="mt-1"
                />
              </div>
            )}
            
            {/* Token - ocultar para integrador */}
            {novaIntegracao.api_provider !== 'w_api_integrator' && (
              <div>
                <Label>{novaIntegracao.api_provider === 'w_api' ? "Token (Bearer)" : "Token da Instância"}</Label>
                <Input
                  placeholder="Cole o token aqui"
                  value={novaIntegracao.api_key_provider}
                  onChange={(e) => setNovaIntegracao({...novaIntegracao, api_key_provider: e.target.value})}
                  className="mt-1"
                  type="password"
                />
              </div>
            )}
            
            {/* Client-Token (apenas Z-API) */}
            {novaIntegracao.api_provider === 'z_api' && (
              <div>
                <Label>Client-Token de Segurança</Label>
                <Input
                  placeholder="Token de segurança da conta Z-API"
                  value={novaIntegracao.security_client_token_header}
                  onChange={(e) => setNovaIntegracao({...novaIntegracao, security_client_token_header: e.target.value})}
                  className="mt-1"
                  type="password"
                />
              </div>
            )}
          </div>

          {/* URL do Webhook - Editável para todos os provedores */}
          <div className="mb-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
            <Label className="text-sm text-purple-700 font-semibold mb-2 block flex items-center gap-2">
              🔗 URL do Webhook
              <Badge className="bg-purple-600 text-white text-xs">Configure no provedor</Badge>
            </Label>
            <Input
              value={novaIntegracao.webhook_url}
              onChange={(e) => setNovaIntegracao({...novaIntegracao, webhook_url: e.target.value})}
              placeholder="https://seu-app.base44.app/api/functions/webhookWapi"
              className="font-mono text-xs bg-white"
            />
            <div className="mt-2 space-y-1">
              <p className="text-xs text-purple-600">
                ✅ URL sugerida automaticamente baseada no provedor selecionado
              </p>
              <p className="text-xs text-purple-600">
                📝 Configure esta URL no painel {novaIntegracao.api_provider === 'w_api' ? 'da W-API' : 'da Z-API'} para receber mensagens
              </p>
              {novaIntegracao.api_provider === 'w_api' && (
                <p className="text-xs text-purple-700 font-medium">
                  💡 W-API: Cole esta URL nos campos "Ao receber mensagem", "Ao enviar mensagem" e "Ao desconectar"
                </p>
              )}
            </div>
          </div>

          {/* Alerta Integrador */}
          {novaIntegracao.api_provider === 'w_api_integrator' && (
            <div className="mb-4 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-indigo-900 mb-1">🏛️ Modo Integrador - Arquitetura "Porteiro Cego"</h4>
                  <ul className="text-sm text-indigo-700 space-y-1 list-disc ml-5">
                    <li>Instância criada automaticamente com webhooks já configurados</li>
                    <li>Você receberá <strong>Instance ID</strong> e <strong>Token</strong> automaticamente</li>
                    <li>Conecte depois usando QR Code ou Pairing Code</li>
                    <li>O número será salvo automaticamente após conexão</li>
                    <li><strong>Deleção Dupla:</strong> Remove da W-API E do banco local</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button onClick={onClose} variant="outline">Fechar</Button>
            <Button 
              onClick={salvarIntegracao} 
              disabled={saving || criandoInstancia}
              className="bg-green-600 hover:bg-green-700"
            >
              {(saving || criandoInstancia) ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Zap className="w-4 h-4 mr-2" />}
              {criandoInstancia ? "Criando Instância..." : saving ? "Salvando..." : novaIntegracao.api_provider === 'w_api_integrator' ? "Criar Instância W-API" : "Adicionar Conexão"}
            </Button>
            </div>
            </TabsContent>
            </Tabs>
            </div>
            </div>
            );
}