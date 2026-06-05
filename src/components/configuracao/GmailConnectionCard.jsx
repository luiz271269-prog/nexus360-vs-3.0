import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle2, AlertCircle, Loader2, LinkIcon, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { gmailGetConnectionStatus } from '@/functions/gmailGetConnectionStatus';

const GMAIL_CONNECTOR_ID = '6a14df6da76515d039e6833c';

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
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-red-500" />
        <span className="font-semibold text-slate-800 text-sm">Gmail — Tickets automáticos</span>
      </div>

      <p className="text-xs text-slate-500">
        Conecte sua conta do Gmail para que novos e-mails recebidos na caixa de entrada
        (excluindo spam e promoções) sejam transformados automaticamente em conversas
        na Central de Comunicação no canal email.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando conexão...
        </div>
      ) : status.connected ? (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-xs font-medium text-green-800">Conectado</div>
              {status.email && <div className="text-[11px] text-green-700">{status.email}</div>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleDisconnect}>
            <Unlink className="h-3.5 w-3.5 mr-1" /> Desconectar
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-amber-800">Sua conta do Gmail não está conectada</span>
          </div>
          <Button onClick={handleConnect} disabled={connecting} size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white">
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <LinkIcon className="h-3.5 w-3.5 mr-1" />}
            Conectar Gmail
          </Button>
        </div>
      )}

      <Badge variant="outline" className="text-[11px] text-slate-500">
        Conector individual por usuário — cada atendente conecta sua própria conta
      </Badge>
    </div>
  );
}