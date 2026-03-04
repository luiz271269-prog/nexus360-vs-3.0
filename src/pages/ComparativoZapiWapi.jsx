import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Zap, Shield } from "lucide-react";

const OK = ({ text }) => (
  <span className="flex items-center gap-1 text-green-700 font-medium">
    <CheckCircle2 className="w-4 h-4 shrink-0" /> {text}
  </span>
);

const NOK = ({ text }) => (
  <span className="flex items-center gap-1 text-red-600 font-medium">
    <XCircle className="w-4 h-4 shrink-0" /> {text}
  </span>
);

const WARN = ({ text }) => (
  <span className="flex items-center gap-1 text-amber-600 font-medium">
    <AlertTriangle className="w-4 h-4 shrink-0" /> {text}
  </span>
);

const rows = [
  {
    categoria: "🔐 Autenticação / Identificação",
    aspecto: "Identificação da instância no webhook",
    zapi: { node: <OK text="connectedPhone (número legível) + instanceId como fallback" />, destaque: false },
    wapi: { node: <OK text="instanceId como primário + connectedPhone como fallback" />, destaque: false },
    diferenca: "Z-API prefere número do chip; W-API prefere ID da instância. Lógica invertida.",
    impacto: "baixo"
  },
  {
    categoria: "🔐 Autenticação / Identificação",
    aspecto: "Token no webhook",
    zapi: { node: <OK text="Nunca trafega — arquitetura Porteiro Cego" />, destaque: false },
    wapi: { node: <OK text="Nunca trafega — mesma arquitetura Porteiro Cego" />, destaque: false },
    diferenca: "Idêntico. Ambos usam serviceRole para buscar token no banco.",
    impacto: "nenhum"
  },
  {
    categoria: "📦 Formato do Payload",
    aspecto: "Campo do remetente",
    zapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">payload.phone</span>, destaque: false },
    wapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">payload.phone</span>, destaque: false },
    diferenca: "Idêntico.",
    impacto: "nenhum"
  },
  {
    categoria: "📦 Formato do Payload",
    aspecto: "Campo de conteúdo de texto",
    zapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">payload.text.message / payload.body</span>, destaque: false },
    wapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">payload.msgContent.conversation / payload.text.message</span>, destaque: false },
    diferenca: "W-API encapsula tudo dentro de msgContent{}. Z-API mantém campos no root.",
    impacto: "médio"
  },
  {
    categoria: "📦 Formato do Payload",
    aspecto: "Estrutura de mídia (imagem, vídeo, áudio)",
    zapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">payload.image / payload.audio / payload.video (root)</span>, destaque: false },
    wapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">payload.msgContent.imageMessage / audioMessage / videoMessage</span>, destaque: false },
    diferenca: "W-API usa msgContent aninhado com mediaKey+directPath. Z-API coloca URLs diretas no root.",
    impacto: "alto"
  },
  {
    categoria: "📦 Formato do Payload",
    aspecto: "Evento de status update",
    zapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">MessageStatusCallback com ids[] e status string (READ/DELIVERED)</span>, destaque: false },
    wapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">webhookDelivery com status numérico (1/2/3)</span>, destaque: false },
    diferenca: "Status Z-API é string (READ/DELIVERED); W-API é numérico (1=sent, 2=delivered, 3=read).",
    impacto: "médio"
  },
  {
    categoria: "📦 Formato do Payload",
    aspecto: "Evento de desconexão",
    zapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">type: 'disconnect'</span>, destaque: false },
    wapi: { node: <span className="font-mono text-sm bg-slate-100 px-1 rounded">event: 'webhookDisconnected'</span>, destaque: false },
    diferenca: "Nomes de eventos completamente diferentes. Requer classificação específica por provider.",
    impacto: "médio"
  },
  {
    categoria: "🎵 Download de Mídia",
    aspecto: "Mecanismo de download",
    zapi: { node: <WARN text="URL direta (Backblaze B2) — temporária, expira em ~2h" />, destaque: false },
    wapi: { node: <WARN text="Requer chamada API com mediaKey + directPath para obter fileLink temporário" />, destaque: false },
    diferenca: "Z-API entrega URL pronta mas temporária. W-API exige chamada adicional à API para obter o link.",
    impacto: "alto"
  },
  {
    categoria: "🎵 Download de Mídia",
    aspecto: "Dados necessários para download",
    zapi: { node: <OK text="Apenas a URL no payload já basta para download imediato" />, destaque: false },
    wapi: { node: <WARN text="Precisa de mediaKey + directPath + token. PTTs frequentemente chegam SEM esses campos." />, destaque: true },
    diferenca: "W-API PTT/áudio muitas vezes chegam sem mediaKey e directPath → falha no download. Z-API nunca tem esse problema.",
    impacto: "crítico"
  },
  {
    categoria: "🎵 Download de Mídia",
    aspecto: "Endpoint de download",
    zapi: { node: <span className="font-mono text-xs bg-slate-100 px-1 rounded">{"/instances/{instance_id}/token/{token}/download/{file_id}"}</span>, destaque: false },
    wapi: { node: <span className="font-mono text-xs bg-slate-100 px-1 rounded">{"POST /v1/message/download-media?instanceId={id} (Bearer token)"}</span>, destaque: false },
    diferenca: "Estruturas de URL completamente diferentes. Token Z-API na URL; W-API no header Bearer.",
    impacto: "médio"
  },
  {
    categoria: "🎵 Download de Mídia",
    aspecto: "Persistência final",
    zapi: { node: <WARN text="downloadMediaZAPI → Supabase (usa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)" />, destaque: true },
    wapi: { node: <OK text="persistirMidiaWapi → Base44 UploadFile (sem dependências externas de secrets)" />, destaque: false },
    diferenca: "Z-API ainda depende de Supabase diretamente. W-API já migrou para Base44 UploadFile. Z-API precisa migrar.",
    impacto: "alto"
  },
  {
    categoria: "🎵 Download de Mídia",
    aspecto: "Modo de disparo da persistência",
    zapi: { node: <OK text="Inline (síncrono) — persiste ANTES de salvar a mensagem" />, destaque: false },
    wapi: { node: <WARN text="Assíncrono — salva mensagem com media_url='pending_download', persiste depois" />, destaque: false },
    diferenca: "Z-API bloqueia o webhook até persistir (mais lento). W-API responde imediatamente (UX melhor, mas exige tratamento de pending).",
    impacto: "médio"
  },
  {
    categoria: "⚙️ Arquitetura do Webhook",
    aspecto: "Classificação de eventos",
    zapi: { node: <OK text="deveIgnorar() — função única para filtrar eventos" />, destaque: false },
    wapi: { node: <OK text="classifyWapiEvent() + deveIgnorar() — classificação em 2 etapas" />, destaque: false },
    diferenca: "W-API tem uma etapa a mais de classificação (provavelmente por maior variedade de eventos da API).",
    impacto: "baixo"
  },
  {
    categoria: "⚙️ Arquitetura do Webhook",
    aspecto: "Detecção de mensagem real vs status",
    zapi: { node: <OK text="Verifica messageId + phone + fromMe=false + conteúdo" />, destaque: false },
    wapi: { node: <OK text="Mesma lógica — verifica messageId + phone + fromMe=false + conteúdo" />, destaque: false },
    diferenca: "Idêntico. Boa simetria.",
    impacto: "nenhum"
  },
  {
    categoria: "⚙️ Arquitetura do Webhook",
    aspecto: "Auto-merge de threads duplicadas",
    zapi: { node: <OK text="Implementado — elege mais antiga como canônica" />, destaque: false },
    wapi: { node: <OK text="Implementado — mesma lógica" />, destaque: false },
    diferenca: "Idêntico. Boa simetria.",
    impacto: "nenhum"
  },
  {
    categoria: "⚙️ Arquitetura do Webhook",
    aspecto: "Deduplicação",
    zapi: { node: <OK text="Por messageId (prioridade) + por conteúdo (últimos 2s)" />, destaque: false },
    wapi: { node: <OK text="Por messageId (prioridade) + por conteúdo (últimos 2s)" />, destaque: false },
    diferenca: "Idêntico.",
    impacto: "nenhum"
  },
  {
    categoria: "⚙️ Arquitetura do Webhook",
    aspecto: "Invocação de processInbound",
    zapi: { node: <OK text="Síncrono (await) — bloqueia resposta" />, destaque: false },
    wapi: { node: <OK text="Síncrono (await) — bloqueia resposta" />, destaque: false },
    diferenca: "Idêntico.",
    impacto: "nenhum"
  },
  {
    categoria: "⚙️ Arquitetura do Webhook",
    aspecto: "Audit log (ZapiPayloadNormalized)",
    zapi: { node: <OK text="Salva ao final + eventos ignorados" />, destaque: false },
    wapi: { node: <OK text="Salva ao final + eventos ignorados + erros de normalização" />, destaque: false },
    diferenca: "W-API salva audit log em mais situações (erros de normalização também).",
    impacto: "baixo"
  },
  {
    categoria: "⚙️ Arquitetura do Webhook",
    aspecto: "Notificação de desconexão",
    zapi: { node: <OK text="Cria NotificationEvent com prioridade alta + anti-spam 2min" />, destaque: false },
    wapi: { node: <OK text="Cria NotificationEvent com prioridade alta + anti-spam 2min" />, destaque: false },
    diferenca: "Idêntico.",
    impacto: "nenhum"
  },
  {
    categoria: "📡 Envio de Mensagens",
    aspecto: "Estrutura da URL de envio",
    zapi: { node: <span className="font-mono text-xs bg-slate-100 px-1 rounded">/instances/{id}/token/{token}/send-text</span>, destaque: false },
    wapi: { node: <span className="font-mono text-xs bg-slate-100 px-1 rounded">POST /v1/sendMessage/sendText?instanceId={id} (Bearer token)</span>, destaque: false },
    diferenca: "Z-API embute token na URL. W-API usa Bearer header. Segurança diferente (W-API melhor nesse aspecto).",
    impacto: "médio"
  },
  {
    categoria: "🐛 Problemas Conhecidos",
    aspecto: "PTT/Áudio sem mediaKey",
    zapi: { node: <OK text="Não tem esse problema — URL já vem pronta" />, destaque: false },
    wapi: { node: <NOK text="PTTs frequentemente chegam sem mediaKey/directPath → fallback para URL direta (pode falhar)" />, destaque: true },
    diferenca: "Problema exclusivo da W-API. Z-API entrega URL pronta, W-API exige dados extras que podem estar ausentes.",
    impacto: "crítico"
  },
  {
    categoria: "🐛 Problemas Conhecidos",
    aspecto: "Dependência de Supabase",
    zapi: { node: <NOK text="downloadMediaZAPI ainda usa Supabase diretamente (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)" />, destaque: true },
    wapi: { node: <OK text="Já migrado para Base44 UploadFile — sem secrets externos" />, destaque: false },
    diferenca: "Z-API desatualizada: usa Supabase. W-API mais moderna: usa Base44. Precisa migrar downloadMediaZAPI.",
    impacto: "alto"
  },
  {
    categoria: "🐛 Problemas Conhecidos",
    aspecto: "Payload wrapping no invoke",
    zapi: { node: <OK text="Usa req.json() diretamente — sem wrapping" />, destaque: false },
    wapi: { node: <OK text="Corrigido: bodyRaw?.payload ?? bodyRaw para aceitar invocações pelo SDK" />, destaque: false },
    diferenca: "W-API foi corrigido. Z-API não tem esse problema pois não é invocado pelo SDK.",
    impacto: "nenhum"
  },
];

const impactoBadge = (impacto) => {
  const map = {
    nenhum: "bg-slate-100 text-slate-600",
    baixo: "bg-blue-100 text-blue-700",
    médio: "bg-amber-100 text-amber-700",
    alto: "bg-orange-100 text-orange-700",
    crítico: "bg-red-100 text-red-700"
  };
  return <Badge className={`${map[impacto] || ''} text-xs font-semibold`}>{impacto}</Badge>;
};

const categorias = [...new Set(rows.map(r => r.categoria))];

export default function ComparativoZapiWapi() {
  const [filtroImpacto, setFiltroImpacto] = useState("todos");
  const [tabAtiva, setTabAtiva] = useState("tabela");

  const rowsFiltrados = filtroImpacto === "todos"
    ? rows
    : rows.filter(r => r.impacto === filtroImpacto);

  const criticos = rows.filter(r => r.impacto === "crítico");
  const altos = rows.filter(r => r.impacto === "alto");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comparativo Z-API vs W-API</h1>
          <p className="text-sm text-slate-500">Análise das diferenças de implementação nos webhooks e funções de mídia</p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total de aspectos", value: rows.length, color: "bg-slate-700" },
          { label: "🔴 Críticos", value: rows.filter(r => r.impacto === "crítico").length, color: "bg-red-600" },
          { label: "🟠 Alto impacto", value: rows.filter(r => r.impacto === "alto").length, color: "bg-orange-500" },
          { label: "🟡 Médio impacto", value: rows.filter(r => r.impacto === "médio").length, color: "bg-amber-500" },
        ].map(c => (
          <Card key={c.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex flex-col gap-1">
              <span className={`text-3xl font-bold text-white w-12 h-12 ${c.color} rounded-xl flex items-center justify-center`}>{c.value}</span>
              <span className="text-sm text-slate-600 mt-2">{c.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
        <TabsList>
          <TabsTrigger value="tabela">📋 Tabela Completa</TabsTrigger>
          <TabsTrigger value="acoes">🚨 Ações Necessárias</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela" className="space-y-4 mt-4">
          {/* Filtro */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-slate-500 self-center">Filtrar:</span>
            {["todos", "crítico", "alto", "médio", "baixo", "nenhum"].map(f => (
              <button
                key={f}
                onClick={() => setFiltroImpacto(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  filtroImpacto === f
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {categorias.map(cat => {
            const rowsCat = rowsFiltrados.filter(r => r.categoria === cat);
            if (rowsCat.length === 0) return null;
            return (
              <Card key={cat} className="shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-base font-bold text-slate-800">{cat}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-y border-slate-100">
                          <th className="text-left px-4 py-2 font-semibold text-slate-600 w-48">Aspecto</th>
                          <th className="text-left px-4 py-2 font-semibold text-blue-700 w-64">Z-API</th>
                          <th className="text-left px-4 py-2 font-semibold text-purple-700 w-64">W-API</th>
                          <th className="text-left px-4 py-2 font-semibold text-slate-600">Diferença / Observação</th>
                          <th className="text-left px-4 py-2 font-semibold text-slate-600 w-24">Impacto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowsCat.map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b border-slate-50 ${row.zapi.destaque || row.wapi.destaque ? "bg-red-50/40" : i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                          >
                            <td className="px-4 py-3 font-medium text-slate-700 align-top">{row.aspecto}</td>
                            <td className={`px-4 py-3 align-top ${row.zapi.destaque ? "ring-2 ring-inset ring-red-300" : ""}`}>{row.zapi.node}</td>
                            <td className={`px-4 py-3 align-top ${row.wapi.destaque ? "ring-2 ring-inset ring-red-300" : ""}`}>{row.wapi.node}</td>
                            <td className="px-4 py-3 text-slate-600 align-top text-xs leading-relaxed">{row.diferenca}</td>
                            <td className="px-4 py-3 align-top">{impactoBadge(row.impacto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="acoes" className="space-y-4 mt-4">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Problemas Críticos — Resolver Imediatamente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-white rounded-lg p-4 border border-red-200">
                <p className="font-semibold text-red-800">1. W-API: PTT/Áudio sem mediaKey/directPath</p>
                <p className="text-sm text-slate-600 mt-1">
                  Mensagens de áudio PTT chegam frequentemente sem <code className="bg-slate-100 px-1 rounded">mediaKey</code> e <code className="bg-slate-100 px-1 rounded">directPath</code>.
                  O fallback para URL direta pode não funcionar. Isso causa a mensagem ficar presa em "Processando áudio..." indefinidamente.
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <ArrowRight className="w-4 h-4" />
                  <span>Arquivo: <code className="bg-slate-100 px-1 rounded">functions/persistirMidiaWapi.js</code> — função <code className="bg-slate-100 px-1 rounded">obterLinkDownloadWapi()</code></span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Alto Impacto — Corrigir em Breve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="font-semibold text-orange-800">1. Z-API: downloadMediaZAPI ainda usa Supabase diretamente</p>
                <p className="text-sm text-slate-600 mt-1">
                  O arquivo <code className="bg-slate-100 px-1 rounded">functions/downloadMediaZAPI.js</code> usa{" "}
                  <code className="bg-slate-100 px-1 rounded">SUPABASE_URL</code> e{" "}
                  <code className="bg-slate-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> diretamente.
                  W-API já migrou para <code className="bg-slate-100 px-1 rounded">base44.asServiceRole.integrations.Core.UploadFile()</code>.
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-orange-700 font-medium">
                  <ArrowRight className="w-4 h-4" />
                  <span>Migrar downloadMediaZAPI para usar Base44 UploadFile (igual ao persistirMidiaWapi)</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="font-semibold text-orange-800">2. Z-API: mídia persistida de forma síncrona (bloqueia webhook)</p>
                <p className="text-sm text-slate-600 mt-1">
                  A Z-API persiste mídia inline (antes de responder ao webhook), o que pode causar timeouts se o download for lento.
                  W-API usa padrão assíncrono (salva mensagem com <code className="bg-slate-100 px-1 rounded">pending_download</code> e persiste depois).
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-orange-700 font-medium">
                  <ArrowRight className="w-4 h-4" />
                  <span>Considerar refatorar webhookFinalZapi para disparar persistência assincronamente</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="font-semibold text-orange-800">3. Diferença no formato de mídia do payload</p>
                <p className="text-sm text-slate-600 mt-1">
                  Z-API entrega mídias no root do payload (ex: <code className="bg-slate-100 px-1 rounded">payload.image</code>).
                  W-API encapsula tudo em <code className="bg-slate-100 px-1 rounded">payload.msgContent</code>.
                  Qualquer lógica genérica de parsing deve considerar os dois formatos.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-slate-700 flex items-center gap-2">
                <Shield className="w-5 h-5" /> Boas Práticas — Manter como estão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>✅ Arquitetura "Porteiro Cego" — Token nunca no webhook (ambos)</p>
              <p>✅ Auto-merge de threads duplicadas (ambos)</p>
              <p>✅ Deduplicação por messageId + conteúdo (ambos)</p>
              <p>✅ processInbound como ponto único de inteligência (ambos)</p>
              <p>✅ Notificação de desconexão com anti-spam (ambos)</p>
              <p>✅ Audit log em ZapiPayloadNormalized (ambos)</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}