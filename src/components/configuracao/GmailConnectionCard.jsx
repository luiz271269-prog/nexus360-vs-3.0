import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle2, AlertCircle, Loader2, LinkIcon, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { gmailGetConnectionStatus } from '@/functions/gmailGetConnectionStatus';

const GMAIL_CONNECTOR_ID = '6a14551f7aeb48cd7e7db807';

export default function GmailConnectionCard() {
  const [status, setStatus] = useState({ connected: false, email: null });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await gmailGetConnectionStatus({});
      setStatus(res.data || { connected: false });
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await base44.connectors.connectAppUser(GMAIL_CONNECTOR_ID);
      const popup = window.open(url, '_blank', 'width=600,height=700');
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          fetchStatus();
          toast.success('Verificando conexão com o Gmail...');
        }
      }, 500);
    } catch (e) {
      setConnecting(false);
      toast.error('Erro ao iniciar conexão: ' + e.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await base44.connectors.disconnectAppUser(GMAIL_CONNECTOR_ID);
      setStatus({ connected: false, email: null });
      toast.success('Gmail desconectado');
    } catch (e) {
      toast.error('Erro ao desconectar: ' + e.message);
    }
  };

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardHeader className="pb-3 border-b border-gray-100">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Mail className="h-5 w-5 text-red-500" />
          📧 Gmail — Tickets automáticos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-xs text-gray-500">
          Conecte sua conta do Gmail para que novos e-mails recebidos na caixa de entrada
          (excluindo spam e promoções) sejam transformados automaticamente em conversas
          na Central de Comunicação no canal email.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando conexão...
          </div>
        ) : status.connected ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm font-medium text-green-800">Conectado</div>
                {status.email && <div className="text-xs text-green-700">{status.email}</div>}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              <Unlink className="h-4 w-4 mr-1" /> Desconectar
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="text-sm text-amber-800">Sua conta do Gmail não está conectada</span>
            </div>
            <Button onClick={handleConnect} disabled={connecting} size="sm" className="bg-red-600 hover:bg-red-700 text-white">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LinkIcon className="h-4 w-4 mr-1" />}
              Conectar Gmail
            </Button>
          </div>
        )}

        <Badge variant="outline" className="text-xs text-gray-500">
          Conector individual por usuário — cada atendente conecta sua própria conta
        </Badge>
      </CardContent>
    </Card>
  );
}