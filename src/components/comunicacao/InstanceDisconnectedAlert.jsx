import React from "react";
import { AlertTriangle } from "lucide-react";

export default function InstanceDisconnectedAlert({ integracao }) {
  if (!integracao) return null;

  return (
    <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-red-900">
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
        <div className="min-w-0">
          <div className="font-semibold">Instância WhatsApp desconectada</div>
          <div className="text-xs text-red-800">
            {integracao.nome_instancia || "Instância"} {integracao.numero_telefone ? `(${integracao.numero_telefone})` : ""} está desconectada na W-API. As mensagens podem não chegar ou não sair por este canal.
          </div>
        </div>
      </div>
    </div>
  );
}