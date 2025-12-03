import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { WhatsAppIntegration } from "@/entities/WhatsAppIntegration";
import { X, Smartphone, Zap, CheckCircle, AlertCircle, QrCode, Loader2, RefreshCw, Wifi, WifiOff, Power, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ConfiguracaoWhatsApp({ onClose }) {
  const [integracoes, setIntegracoes] = useState([]);
  const [novaIntegracao, setNovaIntegracao] = useState({
    nome_instancia: "",
    numero_telefone: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrCodeData, setQrCodeData] = useState({});
  const [conectando, setConectando] = useState({});
  const [verificandoStatus, setVerificandoStatus] = useState({});
  const [pollingAtivo, setPollingAtivo] = useState({});

  const carregarIntegracoes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await WhatsAppIntegration.list('-created_date');
      setIntegracoes(data);
    } catch (error) {
      console.error("Erro ao carregar integrações:", error);
      toast.error("Erro ao carregar configurações do WhatsApp");
    }
    setLoading(false);
  }, []);

  const verificarStatusIntegracao = useCallback(async (integracao, silencioso = false) => {
    try {
      if (!silencioso) {
        setVerificandoStatus(prev => ({ ...prev, [integracao.id]: true }));
      }
      
      const { evolutionAPI } = await import("@/functions/evolutionAPI");
      const resultado = await evolutionAPI({
        action: 'getInstanceStatus',
        data: { instanceName: integracao.nome_instancia }
      });
      
      if (resultado.data.success) {
        const novoStatus = resultado.data.status;
        
        // Atualizar apenas se status mudou
        if (integracao.status !== novoStatus) {
          await WhatsAppIntegration.update(integracao.id, {
            status: novoStatus,
            ultima_atividade: new Date().toISOString()
          });
          
          // Se conectou com sucesso, parar polling e mostrar sucesso
          if (novoStatus === 'conectado') {
            setPollingAtivo(prev => ({ ...prev, [integracao.id]: false }));
            toast.success(`✅ WhatsApp ${integracao.nome_instancia} conectado com sucesso!`);
          }
          
          await carregarIntegracoes();
        }
      }
    } catch (error) {
      console.error(`Erro ao verificar status da instância ${integracao.nome_instancia}:`, error);
    } finally {
      if (!silencioso) {
        setVerificandoStatus(prev => ({ ...prev, [integracao.id]: false }));
      }
    }
  }, [carregarIntegracoes]);

  const verificarStatusConexoes = useCallback(async () => {
    for (const integracao of integracoes) {
      if (integracao.status !== 'desconectado') {
        await verificarStatusIntegracao(integracao, true);
      }
    }
  }, [integracoes, verificarStatusIntegracao]);

  useEffect(() => {
    carregarIntegracoes();
    
    const interval = setInterval(verificarStatusConexoes, 10000);
    return () => clearInterval(interval);
  }, [carregarIntegracoes, verificarStatusConexoes]);

  // Polling para instâncias aguardando conexão
  useEffect(() => {
    const intervals = {};
    
    integracoes.forEach(integracao => {
      if (pollingAtivo[integracao.id] && integracao.status === 'pendente_qrcode') {
        intervals[integracao.id] = setInterval(() => {
          verificarStatusIntegracao(integracao, true);
        }, 3000); // Verificar a cada 3 segundos
      }
    });
    
    return () => {
      Object.values(intervals).forEach(interval => clearInterval(interval));
    };
  }, [integracoes, pollingAtivo, verificarStatusIntegracao]);

  const handleSalvar = async () => {
    if (!novaIntegracao.nome_instancia || !novaIntegracao.numero_telefone) {
      toast.error("Por favor, preencha o nome da instância e o número de telefone.");
      return;
    }
    
    const nomeInstancia = novaIntegracao.nome_instancia.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    setSaving(true);
    try {
      toast.info("Criando instância no WhatsApp Business API...");
      
      const baseUrl = window.location.origin;
      const webhookUrl = `${baseUrl}/api/functions/whatsappWebhook`;
      
      const { evolutionAPI } = await import("@/functions/evolutionAPI");
      const resultado = await evolutionAPI({
        action: 'createInstance',
        data: {
          instanceName: nomeInstancia,
          numeroTelefone: novaIntegracao.numero_telefone,
          webhookUrl: webhookUrl
        }
      });
      
      if (!resultado.data.success) {
        throw new Error(resultado.data.error || "Falha ao criar instância na Evolution API");
      }
      
      const novaInstancia = await WhatsAppIntegration.create({
        nome_instancia: nomeInstancia,
        numero_telefone: novaIntegracao.numero_telefone,
        status: resultado.data.qrcode ? "pendente_qrcode" : "desconectado",
        tipo_conexao: "qrcode",
        session_id: resultado.data.hash || nomeInstancia,
        qr_code_url: resultado.data.qrcode || null
      });
      
      toast.success("Integração WhatsApp criada com sucesso!");
      
      if (resultado.data.qrcode) {
        setQrCodeData(prev => ({
          ...prev,
          [novaInstancia.id]: {
            url: resultado.data.qrcode,
            pairingCode: resultado.data.pairingCode,
            timestamp: Date.now(),
            numeroTelefone: novaIntegracao.numero_telefone
          }
        }));
        
        // Iniciar polling para esta instância
        setPollingAtivo(prev => ({ ...prev, [novaInstancia.id]: true }));
      }
      
      setNovaIntegracao({
        nome_instancia: "",
        numero_telefone: ""
      });
      
      await carregarIntegracoes();
      
    } catch (error) {
      console.error("Erro ao criar integração:", error);
      toast.error(error.message || "Erro ao criar integração WhatsApp");
    } finally {
      setSaving(false);
    }
  };

  const gerarQRCode = async (integracaoId, nomeInstancia, numeroTelefone) => {
    setConectando(prev => ({ ...prev, [integracaoId]: true }));
    
    try {
      toast.info("Gerando QR Code do WhatsApp...");
      
      const { evolutionAPI } = await import("@/functions/evolutionAPI");
      const resultado = await evolutionAPI({
        action: 'getQRCode',
        data: { instanceName: nomeInstancia }
      });
      
      if (!resultado.data.success) {
        throw new Error(resultado.data.error || "Falha ao obter QR Code");
      }
      
      setQrCodeData(prev => ({
        ...prev,
        [integracaoId]: {
          url: resultado.data.qrcode,
          pairingCode: resultado.data.pairingCode,
          timestamp: Date.now(),
          numeroTelefone: numeroTelefone
        }
      }));
      
      await WhatsAppIntegration.update(integracaoId, {
        status: "pendente_qrcode",
        qr_code_url: resultado.data.qrcode
      });
      
      // Iniciar polling
      setPollingAtivo(prev => ({ ...prev, [integracaoId]: true }));
      
      await carregarIntegracoes();
      toast.success("QR Code gerado! Escaneie com seu celular ou use o código de pareamento.");
      
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
      toast.error(error.message || "Erro ao gerar QR Code do WhatsApp");
    } finally {
      setConectando(prev => ({ ...prev, [integracaoId]: false }));
    }
  };

  const desconectar = async (integracaoId, nomeInstancia) => {
    if (!confirm("Tem certeza que deseja desconectar este WhatsApp?")) {
      return;
    }
    
    try {
      toast.info("Desconectando WhatsApp...");
      
      const { evolutionAPI } = await import("@/functions/evolutionAPI");
      await evolutionAPI({
        action: 'disconnectInstance',
        data: { instanceName: nomeInstancia }
      });
      
      await WhatsAppIntegration.update(integracaoId, {
        status: "desconectado",
        session_id: null,
        qr_code_url: null
      });
      
      setQrCodeData(prev => {
        const newData = { ...prev };
        delete newData[integracaoId];
        return newData;
      });
      
      setPollingAtivo(prev => ({ ...prev, [integracaoId]: false }));
      
      await carregarIntegracoes();
      toast.success("WhatsApp desconectado com sucesso!");
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      toast.error("Erro ao desconectar WhatsApp");
    }
  };

  const deletarIntegracao = async (integracaoId, nomeInstancia) => {
    if (!confirm("Tem certeza que deseja DELETAR esta integração? Esta ação não pode ser desfeita.")) {
      return;
    }
    
    try {
      toast.info("Deletando integração...");
      
      const { evolutionAPI } = await import("@/functions/evolutionAPI");
      await evolutionAPI({
        action: 'deleteInstance',
        data: { instanceName: nomeInstancia }
      });
      
      await WhatsAppIntegration.delete(integracaoId);
      
      setQrCodeData(prev => {
        const newData = { ...prev };
        delete newData[integracaoId];
        return newData;
      });
      
      setPollingAtivo(prev => ({ ...prev, [integracaoId]: false }));
      
      await carregarIntegracoes();
      toast.success("Integração deletada com sucesso!");
    } catch (error) {
      console.error("Erro ao deletar integração:", error);
      toast.error("Erro ao deletar integração");
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case "conectado":
        return <Badge className="bg-green-100 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case "pendente_qrcode":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300"><QrCode className="w-3 h-3 mr-1" />Aguardando QR</Badge>;
      case "erro_conexao":
        return <Badge className="bg-red-100 text-red-700 border-red-300"><AlertCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 border-gray-300"><WifiOff className="w-3 h-3 mr-1" />Desconectado</Badge>;
    }
  };

  const formatarNumeroTelefone = (numero) => {
    if (numero.startsWith('+')) return numero;
    if (numero.length === 11) {
      return `+55 ${numero.substring(0,2)} ${numero.substring(2,7)}-${numero.substring(7)}`;
    }
    if (numero.length === 13 && numero.startsWith('55')) {
      return `+${numero.substring(0,2)} ${numero.substring(2,4)} ${numero.substring(4,9)}-${numero.substring(9)}`;
    }
    return numero;
  };

  const formatarPairingCode = (code) => {
    if (!code) return '';
    // Formatar como R L K F - 5 3 V C
    const clean = code.replace(/[^A-Z0-9]/g, '');
    if (clean.length === 8) {
      return `${clean.substring(0,4).split('').join(' ')} - ${clean.substring(4,8).split('').join(' ')}`;
    }
    return code;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">WhatsApp Business API</h2>
              <p className="text-sm text-slate-600">Configuração via Evolution API</p>
            </div>
          </div>
          <Button onClick={onClose} size="icon" variant="ghost">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Aviso Importante */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900">💡 Como funciona</h4>
              <p className="text-sm text-blue-700 mt-1">
                1. Crie uma nova integração abaixo<br/>
                2. Um QR Code será gerado automaticamente<br/>
                3. Abra o WhatsApp no celular → Dispositivos Conectados → Conectar dispositivo<br/>
                4. Escaneie o QR Code que aparece <strong>nesta tela</strong><br/>
                5. Pronto! Suas mensagens serão sincronizadas automaticamente
              </p>
            </div>
          </div>
        </div>

        {/* Lista de Conexões Ativas */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Instâncias Conectadas</h3>
            <Badge className="bg-slate-100 text-slate-700">
              {integracoes.length} {integracoes.length === 1 ? 'instância' : 'instâncias'}
            </Badge>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-green-600"/>
              <p className="text-slate-600 mt-2">Carregando integrações...</p>
            </div>
          ) : integracoes.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
              <Smartphone className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Nenhuma instância configurada</p>
              <p className="text-slate-500 text-sm mt-1">Configure sua primeira integração abaixo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {integracoes.map((integracao) => (
                <div key={integracao.id} className="border border-slate-200 rounded-xl p-6 shadow-sm bg-gradient-to-br from-white to-slate-50 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-slate-900 text-lg">{integracao.nome_instancia}</h4>
                        {verificandoStatus[integracao.id] && (
                          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                        )}
                        {pollingAtivo[integracao.id] && (
                          <div className="flex items-center gap-1">
                            <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-[10px] text-yellow-600">Aguardando...</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-2">
                        📱 {formatarNumeroTelefone(integracao.numero_telefone)}
                      </p>
                      {getStatusBadge(integracao.status)}
                      {integracao.ultima_atividade && (
                        <p className="text-xs text-slate-500 mt-2">
                          Última atividade: {new Date(integracao.ultima_atividade).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* QR Code Interface */}
                  {qrCodeData[integracao.id] && integracao.status === "pendente_qrcode" && (
                    <div className="bg-white rounded-lg p-6 mb-4 border-2 border-green-200">
                      
                      {/* Pairing Code em destaque */}
                      {qrCodeData[integracao.id].pairingCode && (
                        <div className="mb-6">
                          <h5 className="font-semibold text-slate-800 mb-3 text-center text-lg">
                            Insira o código no seu celular
                          </h5>
                          <p className="text-sm text-slate-600 text-center mb-3">
                            Conectando a conta do WhatsApp {formatarNumeroTelefone(qrCodeData[integracao.id].numeroTelefone)}
                          </p>
                          <div className="bg-slate-50 rounded-lg p-6 border-2 border-slate-300">
                            <p className="text-4xl font-mono font-bold text-slate-900 text-center tracking-widest">
                              {formatarPairingCode(qrCodeData[integracao.id].pairingCode)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* QR Code alternativo */}
                      {qrCodeData[integracao.id].url && (
                        <details className="mb-4">
                          <summary className="cursor-pointer text-sm text-green-700 font-medium hover:text-green-800 flex items-center gap-2">
                            <QrCode className="w-4 h-4" />
                            Conectar com o QR code
                          </summary>
                          <div className="flex justify-center mt-4">
                            <img 
                              src={qrCodeData[integracao.id].url} 
                              alt="QR Code WhatsApp" 
                              className="w-64 h-64 border-4 border-green-500 rounded-lg shadow-lg"
                            />
                          </div>
                        </details>
                      )}

                      {/* Instruções Corretas para Pairing Code */}
                      <div className="text-left space-y-2 text-sm text-slate-700 bg-slate-50 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                          <p>Abra o <strong>WhatsApp</strong> <Smartphone className="w-4 h-4 inline text-green-600" /> no seu celular</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                          <p>Toque em <strong>Mais opções (⋮)</strong> no Android ou em <strong>Configurações (⚙️)</strong> no iPhone</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                          <p>Toque em <strong>Dispositivos conectados</strong> e, em seguida, em <strong>Conectar dispositivo</strong></p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                          <p>Toque em <strong>Conectar com número de telefone</strong> e insira o código exibido no seu celular</p>
                        </div>
                      </div>

                      {/* Status de Aguardando com animação */}
                      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                        <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full animation-delay-200"></div>
                        <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full animation-delay-400"></div>
                        <span className="ml-2">Aguardando conexão do celular...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Botões de Ação */}
                  <div className="flex gap-2">
                    {integracao.status === "desconectado" && (
                      <Button
                        onClick={() => gerarQRCode(integracao.id, integracao.nome_instancia, integracao.numero_telefone)}
                        disabled={conectando[integracao.id]}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {conectando[integracao.id] ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Smartphone className="w-4 h-4 mr-2" />
                        )}
                        {conectando[integracao.id] ? "Gerando..." : "Conectar"}
                      </Button>
                    )}
                    
                    {integracao.status === "conectado" && (
                      <>
                        <Button
                          onClick={() => verificarStatusIntegracao(integracao)}
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={verificandoStatus[integracao.id]}
                        >
                          {verificandoStatus[integracao.id] ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Verificar
                        </Button>
                        <Button
                          onClick={() => desconectar(integracao.id, integracao.nome_instancia)}
                          size="sm"
                          variant="outline"
                          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Power className="w-4 h-4 mr-2" />
                          Desconectar
                        </Button>
                      </>
                    )}
                    
                    {integracao.status === "pendente_qrcode" && (
                      <Button
                        onClick={() => gerarQRCode(integracao.id, integracao.nome_instancia, integracao.numero_telefone)}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={conectando[integracao.id]}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Novo Código
                      </Button>
                    )}
                    
                    {integracao.status === "erro_conexao" && (
                      <Button
                        onClick={() => gerarQRCode(integracao.id, integracao.nome_instancia, integracao.numero_telefone)}
                        size="sm"
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                        disabled={conectando[integracao.id]}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Reconectar
                      </Button>
                    )}
                    
                    {/* Botão Deletar sempre disponível */}
                    <Button
                      onClick={() => deletarIntegracao(integracao.id, integracao.nome_instancia)}
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulário de Nova Conexão */}
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-green-600" />
            Criar Nova Instância WhatsApp
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-slate-700 font-medium">Nome da Instância</Label>
              <Input
                placeholder="Ex: vendas, suporte, comercial"
                value={novaIntegracao.nome_instancia}
                onChange={(e) => setNovaIntegracao({...novaIntegracao, nome_instancia: e.target.value})}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">Use apenas letras minúsculas, números e hífens</p>
            </div>
            <div>
              <Label className="text-slate-700 font-medium">Seu Número de WhatsApp</Label>
              <Input
                placeholder="Ex: 5548999322400 (sem + ou espaços)"
                value={novaIntegracao.numero_telefone}
                onChange={(e) => setNovaIntegracao({...novaIntegracao, numero_telefone: e.target.value.replace(/\D/g, '')})}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">Digite o código do país + DDD + número</p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button onClick={onClose} variant="outline">Fechar</Button>
            <Button 
              onClick={handleSalvar} 
              disabled={saving || !novaIntegracao.nome_instancia || !novaIntegracao.numero_telefone}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                  Criando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Criar Instância
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}