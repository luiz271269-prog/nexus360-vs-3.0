import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, ArrowRight } from "lucide-react";

export default function GuiaConfiguracao({ etapaAtual = 1 }) {
  const etapas = [
    {
      numero: 1,
      titulo: "Copiar URL do Webhook",
      descricao: "Copie a URL gerada abaixo",
      status: etapaAtual >= 1 ? "concluido" : "pendente"
    },
    {
      numero: 2,
      titulo: "Configurar na Z-API",
      descricao: "Cole a URL nos campos 'Receive' e 'Message Status'",
      status: etapaAtual >= 2 ? "concluido" : "pendente"
    },
    {
      numero: 3,
      titulo: "Testar Recebimento",
      descricao: "Envie uma mensagem de teste ou real",
      status: etapaAtual >= 3 ? "concluido" : "pendente"
    },
    {
      numero: 4,
      titulo: "Verificar Logs",
      descricao: "Confira se a mensagem foi recebida abaixo",
      status: etapaAtual >= 4 ? "concluido" : "pendente"
    }
  ];

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="pt-6">
        <h3 className="text-lg font-bold text-blue-900 mb-4">
          📋 Guia Rápido de Configuração
        </h3>
        
        <div className="flex items-center justify-between">
          {etapas.map((etapa, index) => (
            <React.Fragment key={etapa.numero}>
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                  etapa.status === "concluido" 
                    ? "bg-green-500 text-white" 
                    : "bg-white border-2 border-blue-300 text-blue-600"
                }`}>
                  {etapa.status === "concluido" ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                
                <div className="text-center">
                  <p className="text-xs font-semibold text-blue-900">
                    {etapa.titulo}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {etapa.descricao}
                  </p>
                </div>
              </div>
              
              {index < etapas.length - 1 && (
                <ArrowRight className="w-5 h-5 text-blue-400 mx-2 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}