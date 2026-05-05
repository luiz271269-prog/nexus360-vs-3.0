import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Zap, CheckCircle2, XCircle, AlertTriangle, Phone, User, Radio, Users } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 🎯 DIAGNÓSTICO UNIFICADO — UI única para 4 fases
 * Substitui: DiagnosticoVisibilidadeContato + DiagnosticoCirurgicoEmbed + DiagnosticoMensagensInternas
 */
export default function DiagnosticoUnificadoPanel() {
  const [telefone, setTelefone] = useState('');
  const [emailUsuario, setEmailUsuario] = useState('');
  const [integrationId, setIntegrationId] = useState('');
  const [modo, setModo] = useState('diagnostico');
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [integracoes, setIntegracoes] = useState([]);

  useEffect(() => {
    base44.entities.WhatsAppIntegration.list().then(setIntegracoes).catch(() => {});
  }, []);

  const executar = async () => {
    if (!telefone && !emailUsuario && !integrationId) {
      toast.error('Preencha pelo menos um campo (telefone, email ou integração)');
      return;
    }
    setExecutando(true);
    setResultado(null);
    try {
      const r = await base44.functions.invoke('skillDiagnosticoUnificado', {
        telefone: telefone.trim() || undefined,
        email_usuario: emailUsuario.trim() || undefined,
        integration_id: integrationId || undefined,
        modo
      });
      const data = r?.data || r;
      setResultado(data);
      if (data?.success) toast.success('Diagnóstico concluído');
      else toast.error('Diagnóstico com erros');
    } catch (e) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setExecutando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <Zap className="w-5 h-5" />
            🎯 Diagnóstico Unificado — 4 fases em 1 clique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                Telefone (FASE A + B)
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="48999322400"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                <User className="w-3.5 h-3.5 inline mr-1" />
                Email usuário (FASE B)
              </label>
              <input
                type="email"
                value={emailUsuario}
                onChange={(e) => setEmailUsuario(e.target.value)}
                placeholder="thais@liesch.com.br"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                <Radio className="w-3.5 h-3.5 inline mr-1" />
                Integração (FASE C)
              </label>
              <select
                value={integrationId}
                onChange={(e) => setIntegrationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">— nenhuma —</option>
                {integracoes.map(i => (
                  <option key={i.id} value={i.id}>{i.nome_instancia} ({i.numero_telefone || 'sem nº'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={modo === 'diagnostico'}
                onChange={() => setModo('diagnostico')} />
              <span>Apenas diagnosticar</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={modo === 'correcao'}
                onChange={() => setModo('correcao')} />
              <span className="text-red-700 font-semibold">Diagnosticar + corrigir</span>
            </label>
          </div>

          <Button
            onClick={executar}
            disabled={executando}
            className="w-full bg-purple-600 hover:bg-purple-700">
            {executando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Executando 4 fases...</> : <><Zap className="w-4 h-4 mr-2" />Executar Diagnóstico Unificado</>}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultado && <ResultadoDiagnostico resultado={resultado} />}
    </div>
  );
}

function ResultadoDiagnostico({ resultado }) {
  return (
    <div className="space-y-3">
      {/* Recomendações */}
      {resultado.recomendacoes?.length > 0 && (
        <Card className="border-2 border-amber-300 bg-amber-50">
          <CardHeader><CardTitle className="text-sm text-amber-900">💡 Recomendações</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {resultado.recomendacoes.map((r, i) => (
                <li key={i} className="flex gap-2"><span>•</span><span>{r}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* FASE A — Dados */}
      <FaseCard
        letra="A"
        titulo="Dados do contato"
        icon={<Phone className="w-4 h-4" />}
        fase={resultado.fases?.A}>
        {resultado.fases?.A?.executada && resultado.fases.A.success && (
          <div className="text-xs space-y-1">
            <p>Saudável: {resultado.fases.A.saudavel === true ? '✅ sim' : resultado.fases.A.saudavel === false ? '❌ não' : '—'}</p>
            {resultado.fases.A.resumo && (
              <pre className="bg-slate-50 p-2 rounded text-[10px] overflow-auto">{JSON.stringify(resultado.fases.A.resumo, null, 2)}</pre>
            )}
          </div>
        )}
      </FaseCard>

      {/* FASE B — Visibilidade */}
      <FaseCard
        letra="B"
        titulo="Visibilidade / Permissões"
        icon={<User className="w-4 h-4" />}
        fase={resultado.fases?.B}>
        {resultado.fases?.B?.executada && resultado.fases.B.success && (
          <div className="text-xs space-y-2">
            <p>
              <strong>{resultado.fases.B.threads_visiveis}</strong> de <strong>{resultado.fases.B.total_threads}</strong> thread(s) visível(is) para {resultado.fases.B.usuario?.email}
            </p>
            {resultado.fases.B.threads?.map((t, i) => (
              <div key={i} className={`p-2 rounded border ${t.visible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px]">{t.thread_id?.substring(0, 8)}...</span>
                  <Badge className={t.visible ? 'bg-green-600' : 'bg-red-600'}>{t.reason_code}</Badge>
                </div>
                <p className="mt-1">{t.motivo}</p>
              </div>
            ))}
          </div>
        )}
      </FaseCard>

      {/* FASE C — Webhook */}
      <FaseCard
        letra="C"
        titulo="Infraestrutura webhook"
        icon={<Radio className="w-4 h-4" />}
        fase={resultado.fases?.C}>
        {resultado.fases?.C?.executada && resultado.fases.C.integracao && (
          <div className="text-xs space-y-1">
            <p><strong>{resultado.fases.C.integracao.nome}</strong> — {resultado.fases.C.integracao.provider}</p>
            <p>Status: <Badge>{resultado.fases.C.integracao.status}</Badge></p>
            {resultado.fases.C.problemas?.length > 0 && (
              <ul className="bg-red-50 p-2 rounded list-disc ml-4">
                {resultado.fases.C.problemas.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
          </div>
        )}
      </FaseCard>

      {/* FASE D — Threads internas */}
      <FaseCard
        letra="D"
        titulo="Threads internas"
        icon={<Users className="w-4 h-4" />}
        fase={resultado.fases?.D}>
        {resultado.fases?.D?.executada && resultado.fases.D.success && (
          <div className="text-xs space-y-1">
            <p>Total: <strong>{resultado.fases.D.total_threads_internas}</strong> threads internas</p>
            <p>Mensagens últimos 2min: <strong>{resultado.fases.D.mensagens_recentes_2min}</strong></p>
            <p>Mensagens órfãs: <strong className={resultado.fases.D.mensagens_orfas > 0 ? 'text-red-600' : 'text-green-600'}>{resultado.fases.D.mensagens_orfas}</strong></p>
          </div>
        )}
      </FaseCard>

      <p className="text-xs text-slate-500 text-center">⏱️ {resultado.duracao_ms}ms · {resultado.version}</p>
    </div>
  );
}

function FaseCard({ letra, titulo, icon, fase, children }) {
  if (!fase || !fase.executada) {
    return (
      <Card className="bg-slate-50 border-slate-200 opacity-60">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-bold">FASE {letra}</span> — {titulo}
            <span className="ml-auto">⏭️ {fase?.motivo || 'não executada'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sucesso = fase.success !== false;
  return (
    <Card className={`border-2 ${sucesso ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {sucesso ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
          {icon}
          <span className="font-bold">FASE {letra}</span> — {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {fase.erro && (
          <Alert className="bg-red-100 border-red-300 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{fase.erro}</AlertDescription>
          </Alert>
        )}
        {children}
      </CardContent>
    </Card>
  );
}