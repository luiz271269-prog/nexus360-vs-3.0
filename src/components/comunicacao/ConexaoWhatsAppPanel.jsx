import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Loader2, RefreshCw, PowerOff, CheckCircle, WifiOff, QrCode, ShieldCheck } from "lucide-react";

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

// Normaliza o QR: W-API pode devolver base64 cru, com prefixo data: ou URL
const normalizarQr = (v) => {
  if (!v) return v;
  return (v.startsWith('data:') || v.startsWith('http')) ? v : `data:image/png;base64,${v}`;
};

export default function ConexaoWhatsAppPanel({ integracao, onRecarregar, podeGerenciar = true }) {
  const [status, setStatus] = useState({ checking: true, connected: integracao?.status === 'conectado', phone: integracao?.numero_telefone });
  const [codigo, setCodigo] = useState(null); // { tipo: 'qr'|'pairing', valor, geradoEm }
  const [restante, setRestante] = useState(0);
  const [gerando, setGerando] = useState(null);
  const [desconectando, setDesconectando] = useState(false);
  const idRef = useRef(integracao.id);       // guarda contra respostas de instância anterior (race)
  const autoQrRef = useRef(false);           // já gerou QR automaticamente para esta instância?
  const renovacoesRef = useRef(0);           // renovações automáticas consecutivas

  const verificarStatus = useCallback(async (silencioso = true) => {
    const idAlvo = integracao.id;
    try {
      const resp = await base44.functions.invoke('wapiIntegratorManager', {
        action: 'getStatus',
        integration_id: idAlvo
      });
      // ✅ ANTI-RACE: descarta resposta se o usuário já trocou de instância
      if (idRef.current !== idAlvo) return false;
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
    if (idRef.current === idAlvo) setStatus((s) => ({ ...s, checking: false }));
    return false;
  }, [integracao.id, integracao.numero_telefone]);

  const gerarCodigo = useCallback(async (tipo, automatico = false) => {
    const idAlvo = integracao.id;
    if (!automatico) renovacoesRef.current = 0;
    setGerando(tipo);
    try {
      const resp = await base44.functions.invoke('wapiIntegratorManager', {
        action: tipo === 'qr' ? 'getQrCode' : 'getPairingCode',
        integration_id: idAlvo
      });
      if (idRef.current !== idAlvo) return; // anti-race
      if (!resp?.data?.success) throw new Error(resp?.data?.error || 'Falha ao gerar código');
      setCodigo({
        tipo,
        valor: tipo === 'qr' ? normalizarQr(resp.data.qrcode) : resp.data.pairingCode,
        geradoEm: Date.now()
      });
      setRestante(VALIDADE_CODIGO_SEG);
      if (!automatico) {
        toast.success(tipo === 'qr' ? 'QR Code gerado! Escaneie no celular.' : 'Código gerado! Digite no celular.');
      }
    } catch (e) {
      if (idRef.current !== idAlvo) return;
      setCodigo(null);
      if (!automatico) toast.error('Erro ao gerar código: ' + e.message);
      else console.warn('[CONEXAO-WA] Auto-geração falhou:', e.message);
    } finally {
      if (idRef.current === idAlvo) setGerando(null);
    }
  }, [integracao.id]);

  // ✅ Auto-teste ao abrir / trocar de instância
  useEffect(() => {
    idRef.current = integracao.id;
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
      // ✅ Pausa o polling se a aba está oculta (evita pressão 429 — padrão do app)
      if (typeof document !== 'undefined' && document.hidden) return;
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
  const pctValidade = (restante / VALIDADE_CODIGO_SEG) * 100;

  return (
    <div className="space-y-2.5">
      {/* Banner de status dinâmico */}
      <div className={`flex items-center justify-between p-3 rounded-xl border ${
        status.checking ? 'bg-slate-50 border-slate-200' :
        status.connected
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
          : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300'
      }`}>
        <div className="flex items-center gap-2.5">
          {status.checking ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          ) : status.connected ? (
            <div className="relative">
              <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
            </div>
          ) : (
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-orange-500" />
            </div>
          )}
          <div>
            <p className="text-xs font-bold text-slate-800">
              {status.checking ? 'Verificando conexão...' : status.connected ? 'Aparelho Conectado' : 'Aparelho Desconectado'}
            </p>
            <p className="text-[10px] text-slate-500">
              {status.checking ? 'Consultando o provedor em tempo real'
                : status.connected ? (status.phone ? `+${String(status.phone).replace(/^\+/, '')} · verificado agora` : 'Sessão ativa')
                : 'Conecte escaneando o QR Code abaixo'}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => verificarStatus(false)} disabled={status.checking} className="h-7 text-[10px]">
            <RefreshCw className={`w-3 h-3 mr-1 ${status.checking ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
          {status.connected && podeGerenciar && (
            <Button size="sm" variant="outline" onClick={desconectar} disabled={desconectando}
              className="h-7 text-[10px] text-red-600 border-red-300 hover:bg-red-50">
              {desconectando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PowerOff className="w-3 h-3 mr-1" />}
              Desconectar
            </Button>
          )}
        </div>
      </div>

      {/* Área de conexão — padrão WhatsApp Web */}
      <AnimatePresence>
        {!status.checking && !status.connected && podeGerenciar && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 bg-white rounded-xl border border-green-200 shadow-sm"
          >
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
              <div className="flex flex-col sm:flex-row gap-5 items-center">
                {/* Código (QR ou pareamento) */}
                <div className="flex-shrink-0 text-center w-48">
                  {codigo.tipo === 'qr' ? (
                    <img src={codigo.valor} alt="QR Code" className="w-48 h-48 border-2 border-green-500 rounded-xl shadow-sm" />
                  ) : (
                    <div className="w-48 py-9 border-2 border-green-500 rounded-xl bg-green-50">
                      <p className="text-2xl font-mono font-bold tracking-widest">{codigo.valor}</p>
                    </div>
                  )}
                  {/* Barra de validade animada */}
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-linear ${pctValidade > 30 ? 'bg-green-500' : 'bg-orange-500'}`}
                      style={{ width: `${pctValidade}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-center gap-1.5">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}