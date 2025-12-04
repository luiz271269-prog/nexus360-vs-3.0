import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function WebhookInstructions({ isOpen, onClose }) {
  if (!isOpen) return null;

  const copiarWebhookUrl = () => {
    const appUrl = window.location.origin;
    const webhookUrl = `${appUrl}/api/functions/inboundWebhook?provider=z_api&instance=SEU_INSTANCE_ID_COMPLETO`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            Configurar Webhook
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <h3 className="font-bold text-blue-900 mb-3">Copiar URL</h3>
            <div className="bg-white p-3 rounded-lg border border-blue-200 flex items-center justify-between gap-2">
              <code className="text-sm text-blue-800 break-all flex-1">
                {window.location.origin}/api/functions/inboundWebhook?provider=z_api&instance=SEU_INSTANCE_ID_COMPLETO
              </code>
              <Button size="sm" onClick={copiarWebhookUrl} className="bg-blue-500">
                <Copy className="w-4 h-4 mr-1" />
                Copiar
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose} className="bg-green-500">
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}