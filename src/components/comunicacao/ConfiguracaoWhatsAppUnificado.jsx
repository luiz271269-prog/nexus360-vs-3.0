import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { X, Smartphone, Zap, CheckCircle, AlertCircle, QrCode, Loader2, RefreshCw, WifiOff, Power, Settings, Trash2, Copy, ExternalLink } from "lucide-react";
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
    descricao: "API estável e robusta para WhatsApp Business"
  },
  w_api: {
    nome: "W-API",
    cor: "purple",
    baseUrl: "https://api.w-api.app/v1",
    campos: ["instance_id_provider", "api_key_provider"],
    descricao: "API moderna com suporte a QR Code e Pairing Code"
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
    security_client_token_header: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrCodeData, setQrCodeData] = useState({});
  const [conectando, setConectando] = useState({});
  const [verificandoStatus, setVerificandoStatus] = useState({});

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

  const salvarIntegracao = async () => {
    const { nome_instancia, numero_telefone, api_provider, instance_id_provider, api_key_provider, security_client_token_header } = novaIntegracao;
    
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
        api_provider,
        instance_id_provider,
        api_key_provider,
        security_client_token_header: api_provider === 'z_api' ? security_client_token_header : null,
        base_url_provider: provider.baseUrl,
        status: "desconectado",
        tipo_conexao: "webhook"
      });
      
      toast.success("Integração criada com sucesso!");
      
      setNovaIntegracao({
        nome_instancia: "",
        numero_telefone: "",
        api_provider: "z_api",
        instance_id_provider: "",
        api_key_provider: "",
        security_client_token_header: ""
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
    if (!confirm("Tem certeza que deseja DELETAR esta integração?")) return;
    
    try {
      await base44.entities.WhatsAppIntegration.delete(integracaoId);
      setQrCodeData(prev => { const n = {...prev}; delete n[integracaoId]; return n; });
      await carregarIntegracoes();
      toast.success("Integração deletada!");
    } catch (error) {
      toast.error("Erro ao deletar integração");
    }
  };

  const copiarWebhookUrl = (integracao) => {
    let url;
    
    if (integracao.api_provider === 'w_api') {
      // W-API: Usa a URL pública do Base44
      url = `https://app.base44.com/api/functions/webhookWapi`;
    } else {
      // Z-API: Usa a URL dinâmica do ambiente
      const baseUrl = window.location.origin.replace('preview.', '').replace(':3000', '');
      url = `${baseUrl}/api/functions/webhookWatsZapi`;
    }
    
    navigator.clipboard.writeText(url);
    toast.success("URL do webhook copiada!");
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

        {/* Lista de Conexões */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Conexões Ativas</h3>
            <Badge className="bg-slate-100 text-slate-700">{integracoes.length} conexões</Badge>
          </div>
          
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
                    <Button
                      onClick={() => deletarIntegracao(integracao.id)}
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
                  
                  {/* URL do Webhook - Apenas para W-API */}
                  {integracao.api_provider === 'w_api' && (
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-purple-700 mb-1">🔗 URL do Webhook (configure na W-API)</p>
                          <code className="text-xs bg-white px-2 py-1 rounded border border-purple-200 block truncate">
                            https://app.base44.com/api/functions/webhookWapi
                          </code>
                        </div>
                        <Button
                          onClick={() => copiarWebhookUrl(integracao)}
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0 border-purple-300 text-purple-700 hover:bg-purple-100"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulário Nova Conexão */}
        <div className="border-t pt-6">
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
                onValueChange={(v) => setNovaIntegracao({...novaIntegracao, api_provider: v, security_client_token_header: ""})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="z_api">Z-API</SelectItem>
                  <SelectItem value="w_api">W-API</SelectItem>
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
            
            {/* Telefone */}
            <div>
              <Label>Número de WhatsApp</Label>
              <Input
                placeholder="5548999999999"
                value={novaIntegracao.numero_telefone}
                onChange={(e) => setNovaIntegracao({...novaIntegracao, numero_telefone: e.target.value.replace(/\D/g, '')})}
                className="mt-1"
              />
            </div>
            
            {/* Instance ID */}
            <div>
              <Label>Instance ID</Label>
              <Input
                placeholder={novaIntegracao.api_provider === 'w_api' ? "Ex: T34398-VYR3QD..." : "Ex: 3E5D2BD1BF421127B24ECEF0269361A3"}
                value={novaIntegracao.instance_id_provider}
                onChange={(e) => setNovaIntegracao({...novaIntegracao, instance_id_provider: e.target.value})}
                className="mt-1"
              />
            </div>
            
            {/* Token */}
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

          <div className="flex justify-end gap-3">
            <Button onClick={onClose} variant="outline">Fechar</Button>
            <Button 
              onClick={salvarIntegracao} 
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Zap className="w-4 h-4 mr-2" />}
              {saving ? "Salvando..." : "Adicionar Conexão"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}