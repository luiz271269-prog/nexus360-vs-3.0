import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QrCode, Smartphone, Loader2, RefreshCw, PowerOff, CheckCircle, WifiOff } from "lucide-react";

const VALIDADE_CODIGO_SEG = 90;

export default function ConexaoWhatsAppPanel({ integracao, onRecarregar, podeGerenciar = true }) {
  const [status, setStatus] = useState({ checking: true, connected: integracao?.status === 'conectado', phone: integracao?.numero_telefone });
  const [codigo, setCodigo] = useState(null); // { tipo: 'qr'|'pairing', valor, geradoEm }
  const [restante, setRestante] = useState(0);
  const [gerando, setGerando] = useState(null);
  const [desconectando, setDesconectando] = useState(false);

  const verificarStatus = useCallback(async (silencioso = true) => {
    try {
      const resp = await base44.functions.invoke('wapiIntegratorManager', {
        action: 'getStatus',
        integration_id: integracao.id
      });
      if (resp?.data?.success) {
        const connected = !!resp.data.connected;
        setStatus({ checking: false, connected, phone: resp.data.phone || integracao.numero_telefone });
        if (connected) setCodigo(null);
        if (!silencioso) toast[connected ? 'success' : 'info'](connected ? '✅ WhatsApp conectado!' : '📴 Aparelho desconectado');
        return connected;
      }
    } catch (e) {
      console.error('[CONEXAO-WA] Erro ao verificar status:', e.message);
    }
    setStatus((s) => ({ ...s, checking: false }));
    return false;
  }, [integracao.id, integracao.numero_telefone]);

  // ✅ Auto-teste ao abrir / trocar de instância
  useEffect(() => {
    setStatus({ checking: true, connected: integracao?.status === 'conectado', phone: integracao?.numero_telefone });
    setCodigo(null);
    verificarStatus(true);
  }, [integracao.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Enquanto há código na tela: contador regressivo + polling de conexão a cada 5s
  useEffect(() => {
    if (!codigo) return;
    const tick = setInterval(() => {
      setRestante(Math.max(0, VALIDADE_CODIGO_SEG - Math.floor((Date.now() - codigo.geradoEm) / 1000)));
    }, 1000);
    const poll = setInterval(async () => {
      const conectou = await verificarStatus(true);
      if (conectou) {
        toast.success('✅ WhatsApp conectado com sucesso!');
        if (onRecarregar) onRecarregar();
      }
    }, 5000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [codigo, verificarStatus, onRecarregar]);

  const gerarCodigo = async (tipo) => {
    setGerando(tipo);
    try {
      const resp = await base44.functions.invoke('wapiIntegratorManager', {
        action: tipo === 'qr' ? 'getQrCode' : 'getPairingCode',
        integration_id: integracao.id
      });
      if (!resp?.data?.success) throw new Error(resp?.data?.error || 'Falha ao gerar código');
      setCodigo({
        tipo,
        valor: tipo === 'qr' ? resp.data.qrcode : resp.data.pairingCode,
        geradoEm: Date.now()
      });
      setRestante(VALIDADE_CODIGO_SEG);
      toast.success(tipo === 'qr' ? 'QR Code gerado! Escaneie no celular.' : 'Código gerado! Digite no celular.');
    } catch (e) {
      toast.error('Erro ao gerar código: ' + e.message);
    } finally {
      setGerando(null);
    }
  };

  const desconectar = async () => {
    if (!confirm(`Desconectar o aparelho da instância "${integracao.nome_instancia}"?`)) return;
    setDesconectando(true);
    try {
      const resp = await base44.functions.invoke('wapiIntegratorManager', {
        action: 'disconnect',
        integration_id: integracao.id
      });
      if (!resp?.data?.success) throw new Error(resp?.data?.error || 'Falha ao desconectar');
      toast.success('📴 Aparelho desconectado');
      setStatus({ checking: false, connected: false, phone: integracao.numero_telefone });
      if (onRecarregar) onRecarregar();
    } catch (e) {
      toast.error('Erro ao desconectar: ' + e.message);
    } finally {
      setDesconectando(false);
    }
  };

  const expirado = codigo && restante === 0;

  return (
    <div className="space-y-2.5">
      {/* Banner de status dinâmico */}
      <div className={`flex items-center justify-between p-2.5 rounded-lg border-2 ${
        status.checking ? 'bg-slate-50 border-slate-200' :
        status.connected ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'
      }`}>
        <div className="flex items-center gap-2">
          {status.checking ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          ) : status.connected ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-orange-500" />
          )}
          <div>
            <p className="text-xs font-semibold text-slate-800">
              {status.checking ? 'Verificando conexão...' : status.connected ? 'Aparelho Conectado' : 'Aparelho Desconectado'}
            </p>
            {!status.checking && status.connected && status.phone && (
              <p className="text-[10px] text-slate-500">{status.phone}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => verificarStatus(false)} disabled={status.checking} className="h-6 text-[10px]">
            <RefreshCw className={`w-3 h-3 mr-1 ${status.checking ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
          {status.connected && podeGerenciar && (
            <Button size="sm" variant="outline" onClick={desconectar} disabled={desconectando}
              className="h-6 text-[10px] text-red-600 border-red-300 hover:bg-red-50">
              {desconectando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PowerOff className="w-3 h-3 mr-1" />}
              Desconectar
            </Button>
          )}
        </div>
      </div>

      {/* Botões de conexão — apenas quando desconectado */}
      {!status.checking && !status.connected && podeGerenciar && (
        <div>
          <p className="text-[10px] text-slate-500 mb-1.5">Conectar WhatsApp:</p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => gerarCodigo('qr')} disabled={!!gerando} className="h-7 text-xs">
              {gerando === 'qr' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <QrCode className="w-3 h-3 mr-1" />}
              QR Code
            </Button>
            <Button size="sm" variant="outline" onClick={() => gerarCodigo('pairing')} disabled={!!gerando} className="h-7 text-xs">
              {gerando === 'pairing' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Smartphone className="w-3 h-3 mr-1" />}
              Pareamento
            </Button>
          </div>

          {/* Exibição do código com validade + auto-detecção */}
          {codigo && (
            <div className={`mt-3 p-3 bg-white rounded-lg border-2 ${expirado ? 'border-red-300' : 'border-green-200'}`}>
              {expirado ? (
                <div className="text-center space-y-2">
                  <p className="text-xs text-red-600 font-semibold">⏰ Código expirado</p>
                  <Button size="sm" onClick={() => gerarCodigo(codigo.tipo)} disabled={!!gerando} className="h-7 text-xs bg-green-600 hover:bg-green-700">
                    {gerando ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                    Gerar Novo
                  </Button>
                </div>
              ) : (
                <>
                  {codigo.tipo === 'pairing' ? (
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-2">Digite no celular (WhatsApp → Aparelhos conectados → Conectar com número):</p>
                      <p className="text-2xl font-mono font-bold tracking-widest">{codigo.valor}</p>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <img src={codigo.valor} alt="QR Code" className="w-40 h-40 border-2 border-green-500 rounded" />
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      Expira em {restante}s
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                      <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                      Aguardando conexão...
                    </Badge>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}