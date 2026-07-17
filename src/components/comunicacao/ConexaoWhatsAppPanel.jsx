import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Smartphone, Loader2, RefreshCw, PowerOff, CheckCircle, WifiOff, QrCode } from "lucide-react";

const VALIDADE_CODIGO_SEG = 60;
const MAX_RENOVACOES_AUTO = 3;

const PASSOS_QR = [
  "Abra o WhatsApp no celular",
  "Toque em Menu (⋮) ou Configurações",
  "Toque em Aparelhos conectados → Conectar aparelho",
  "Aponte a câmera para o QR Code ao lado"
];

const PASSOS_PAIRING = [
  "Abra o WhatsApp no celular",
  "Toque em Aparelhos conectados → Conectar aparelho",
  "Toque em Conectar com número de telefone",
  "Digite o código abaixo"
];

export default function ConexaoWhatsAppPanel({ integracao, onRecarregar, podeGerenciar = true }) {
  const [status, setStatus] = useState({ checking: true, connected: integracao?.status === 'conectado', phone: integracao?.numero_telefone });
  const [codigo, setCodigo] = useState(null); // { tipo: 'qr'|'pairing', valor, geradoEm }
  const [restante, setRestante] = useState(0);
  const [gerando, setGerando] = useState(null);
  const [desconectando, setDesconectando] = useState(false);
  const autoQrRef = useRef(false);       // já gerou QR automaticamente para esta instância?
  const renovacoesRef = useRef(0);       // renovações automáticas consecutivas

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

  const gerarCodigo = useCallback(async (tipo, automatico = false) => {
    if (!automatico) renovacoesRef.current = 0;
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
      if (!automatico) {
        toast.success(tipo === 'qr' ? 'QR Code gerado! Escaneie no celular.' : 'Código gerado! Digite no celular.');
      }
    } catch (e) {
      setCodigo(null);
      if (!automatico) toast.error('Erro ao gerar código: ' + e.message);
      else console.warn('[CONEXAO-WA] Auto-geração falhou:', e.message);
    } finally {
      setGerando(null);
    }
  }, [integracao.id]);

  // ✅ Auto-teste ao abrir / trocar de instância
  useEffect(() => {
    autoQrRef.current = false;
    renovacoesRef.current = 0;
    setStatus({ checking: true, connected: integracao?.status === 'conectado', phone: integracao?.numero_telefone });
    setCodigo(null);
    verificarStatus(true);
  }, [integracao.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ PADRÃO WHATSAPP: QR aparece automaticamente quando desconectado
  useEffect(() => {
    if (status.checking || status.connected || !podeGerenciar || codigo || gerando || autoQrRef.current) return;
    autoQrRef.current = true;
    gerarCodigo('qr', true);
  }, [status, codigo, gerando, podeGerenciar, gerarCodigo]);

  // ✅ Contador regressivo + renovação automática + polling de conexão (5s)
  useEffect(() => {
    if (!codigo) return;
    const tick = setInterval(() => {
      const sobra = Math.max(0, VALIDADE_CODIGO_SEG - Math.floor((Date.now() - codigo.geradoEm) / 1000));
      setRestante(sobra);
      // PADRÃO WHATSAPP: renova o código sozinho ao expirar (até o limite)
      if (sobra === 0 && renovacoesRef.current < MAX_RENOVACOES_AUTO) {
        renovacoesRef.current += 1;
        clearInterval(tick);
        gerarCodigo(codigo.tipo, true);
      }
    }, 1000);
    const poll = setInterval(async () => {
      const conectou = await verificarStatus(true);
      if (conectou) {
        toast.success('✅ WhatsApp conectado com sucesso!');
        if (onRecarregar) onRecarregar();
      }
    }, 5000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [codigo, verificarStatus, onRecarregar, gerarCodigo]);

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
      autoQrRef.current = false; // permite novo QR automático
      setStatus({ checking: false, connected: false, phone: integracao.numero_telefone });
      if (onRecarregar) onRecarregar();
    } catch (e) {
      toast.error('Erro ao desconectar: ' + e.message);
    } finally {
      setDesconectando(false);
    }
  };

  const expirado = codigo && restante === 0 && renovacoesRef.current >= MAX_RENOVACOES_AUTO;
  const passos = codigo?.tipo === 'pairing' ? PASSOS_PAIRING : PASSOS_QR;

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

      {/* Área de conexão — padrão WhatsApp Web */}
      {!status.checking && !status.connected && podeGerenciar && (
        <div className="p-3 bg-white rounded-lg border-2 border-green-200">
          {gerando && !codigo ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-green-600" />
              <p className="text-xs text-slate-500">Gerando {gerando === 'qr' ? 'QR Code' : 'código de pareamento'}...</p>
            </div>
          ) : expirado ? (
            <div className="text-center space-y-2 py-6">
              <p className="text-xs text-red-600 font-semibold">⏰ Código expirado</p>
              <Button size="sm" onClick={() => gerarCodigo(codigo.tipo)} disabled={!!gerando} className="h-7 text-xs bg-green-600 hover:bg-green-700">
                {gerando ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Recarregar código
              </Button>
            </div>
          ) : codigo ? (
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Código (QR ou pareamento) */}
              <div className="flex-shrink-0 text-center">
                {codigo.tipo === 'qr' ? (
                  <img src={codigo.valor} alt="QR Code" className="w-44 h-44 border-2 border-green-500 rounded-lg" />
                ) : (
                  <div className="w-44 py-8 border-2 border-green-500 rounded-lg bg-green-50">
                    <p className="text-2xl font-mono font-bold tracking-widest">{codigo.valor}</p>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">Renova em {restante}s</Badge>
                  <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                    <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                    Aguardando...
                  </Badge>
                </div>
              </div>

              {/* Instruções passo a passo (padrão WhatsApp) */}
              <div className="flex-1 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Como conectar:</p>
                <ol className="space-y-1.5">
                  {passos.map((passo, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-100 text-green-700 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                      {passo}
                    </li>
                  ))}
                </ol>
                {/* Alternância QR ↔ número (padrão WhatsApp) */}
                <button
                  onClick={() => gerarCodigo(codigo.tipo === 'qr' ? 'pairing' : 'qr')}
                  disabled={!!gerando}
                  className="text-[11px] text-green-700 font-medium underline hover:text-green-800 flex items-center gap-1 mt-2"
                >
                  {codigo.tipo === 'qr' ? (
                    <><Smartphone className="w-3 h-3" /> Conectar com número de telefone</>
                  ) : (
                    <><QrCode className="w-3 h-3" /> Conectar com QR Code</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Button size="sm" onClick={() => gerarCodigo('qr')} disabled={!!gerando} className="h-7 text-xs bg-green-600 hover:bg-green-700">
                <QrCode className="w-3 h-3 mr-1" />
                Gerar QR Code
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}