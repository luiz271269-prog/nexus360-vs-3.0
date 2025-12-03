import React, { useState, useEffect } from "react";
import { WhatsAppIntegration } from "@/entities/WhatsAppIntegration";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Loader2,
  ExternalLink,
  Wifi,
  WifiOff,
  Power,
  Settings,
  Info
} from "lucide-react";
import { toast } from "sonner";

export default function WhatsAppWebIntegrated() {
  const [integracoes, setIntegracoes] = useState([]);
  const [integracaoAtiva, setIntegracaoAtiva] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarIntegracoes();
    const interval = setInterval(carregarIntegracoes, 30000);
    return () => clearInterval(interval);
  }, []);

  const carregarIntegracoes = async () => {
    setLoading(true);
    try {
      const data = await WhatsAppIntegration.list('-created_date');
      setIntegracoes(data);
      
      // Selecionar primeira conectada
      const conectada = data.find(i => i.status === "conectado");
      if (conectada) {
        setIntegracaoAtiva(conectada);
      } else if (data.length > 0) {
        setIntegracaoAtiva(data[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar integrações:", error);
      toast.error("Erro ao carregar status do WhatsApp");
    }
    setLoading(false);
  };

  const abrirWhatsAppWeb = () => {
    window.open('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer');
    toast.info("WhatsApp Web aberto em nova aba");
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case "conectado":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case "pendente_qrcode":
        return <Badge className="bg-yellow-100 text-yellow-700"><QrCode className="w-3 h-3 mr-1" />Conectando...</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-700"><AlertCircle className="w-3 h-3 mr-1" />Desconectado</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (integracoes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <Smartphone className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-800 mb-2">
            Nenhuma integração configurada
          </h3>
          <p className="text-slate-600 mb-4">
            Configure uma conexão WhatsApp para usar esta funcionalidade
          </p>
          <Button 
            onClick={() => window.location.href = '/comunicacao'}
            className="bg-green-600 hover:bg-green-700"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar WhatsApp
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header de Controle */}
      <div className="p-4 border-b border-slate-200 bg-green-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-slate-800">
                {integracaoAtiva?.nome_instancia || "WhatsApp Web"}
              </h3>
              <p className="text-sm text-slate-600">
                {integracaoAtiva?.numero_telefone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(integracaoAtiva?.status)}
            <Button 
              onClick={carregarIntegracoes}
              variant="outline" 
              size="sm"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Área Principal */}
      <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-10 h-10 text-green-600" />
          </div>
          
          <h3 className="text-2xl font-bold text-slate-800 mb-3">
            WhatsApp Web Oficial
          </h3>
          
          <p className="text-slate-600 mb-6">
            Para usar o WhatsApp Web oficial com todas as funcionalidades, clique no botão abaixo. 
            Ele abrirá em uma nova aba do navegador.
          </p>

          {integracaoAtiva?.status === "conectado" ? (
            <div className="space-y-4">
              <Button 
                onClick={abrirWhatsAppWeb}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Abrir WhatsApp Web
              </Button>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <strong>Dica:</strong> As mensagens que você enviar/receber no WhatsApp Web oficial 
                    serão automaticamente sincronizadas com o VendaPro através da nossa integração.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-3" />
              <p className="text-yellow-800 font-medium mb-3">
                WhatsApp não conectado
              </p>
              <p className="text-yellow-700 text-sm mb-4">
                Conecte sua instância do WhatsApp nas configurações para usar esta funcionalidade.
              </p>
              <Button 
                onClick={() => window.location.href = '/comunicacao'}
                variant="outline"
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
              >
                <Settings className="w-4 h-4 mr-2" />
                Ir para Configurações
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}