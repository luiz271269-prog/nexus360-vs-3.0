import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus, CheckCircle, AlertCircle, Trash2, Loader2,
  Eye, EyeOff, Edit, Key, Settings, RefreshCw,
  Cloud, Phone, ExternalLink, Copy, Info
} from "lucide-react";
import { toast } from "sonner";
import { getWebhookUrlProducao } from "../lib/webhookUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const META_WEBHOOK_FN = "webhookWatsZapi"; // reutiliza o handler genérico ou crie um específico
const META_BASE_URL = "https://graph.facebook.com/v21.0";

const MetaLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.11 7.86l-1.44 6.79c-.11.49-.39.61-.79.38l-2.17-1.6-1.05 1.01c-.12.11-.21.21-.43.21l.15-2.22 3.99-3.6c.17-.16-.04-.24-.27-.08L7.71 14.5l-2.1-.66c-.46-.14-.47-.46.1-.68l8.2-3.16c.38-.14.72.09.19.86z"/>
  </svg>
);

export default function MetaCloudAPISetup({ integracoes = [], onRecarregar, usuarioAtual }) {
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testando, setTestando] = useState(null);
  const [showToken, setShowToken] = useState(false);

  const isAdmin = usuarioAtual?.role === 'admin';

  const initialForm = {
    nome_instancia: "",
    numero_telefone: "",
    meta_waba_id: "",
    meta_phone_number_id: "",
    api_key_provider: "", // token permanente
  };
  const [form, setForm] = useState(initialForm);

  const webhookUrl = getWebhookUrlProducao("webhookWatsZapi");

  const integracoesMeta = integracoes.filter(i => i.api_provider === 'meta_cloud_api');

  const selecionarIntegracao = (integ) => {
    setIntegracaoSelecionada(integ);
    setForm({
      nome_instancia: integ.nome_instancia || "",
      numero_telefone: integ.numero_telefone || "",
      meta_waba_id: integ.meta_waba_id || "",
      meta_phone_number_id: integ.meta_phone_number_id || "",
      api_key_provider: integ.api_key_provider || "",
    });
    setModoEdicao(false);
  };

  const iniciarNova = () => {
    setIntegracaoSelecionada(null);
    setForm(initialForm);
    setModoEdicao(true);
  };

  const salvar = async () => {
    if (!form.nome_instancia?.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.numero_telefone?.trim()) { toast.error("Número é obrigatório"); return; }
    if (!form.meta_waba_id?.trim()) { toast.error("WABA ID é obrigatório"); return; }
    if (!form.meta_phone_number_id?.trim()) { toast.error("Phone Number ID é obrigatório"); return; }
    if (!form.api_key_provider?.trim()) { toast.error("Token de acesso é obrigatório"); return; }

    setLoading(true);
    try {
      const dados = {
        nome_instancia: form.nome_instancia.trim(),
        numero_telefone: form.numero_telefone.trim(),
        api_provider: "meta_cloud_api",
        modo: "manual",
        meta_waba_id: form.meta_waba_id.trim(),
        meta_phone_number_id: form.meta_phone_number_id.trim(),
        api_key_provider: form.api_key_provider.trim(),
        base_url_provider: META_BASE_URL,
        webhook_url: webhookUrl,
        tipo_conexao: "webhook",
        status: "desconectado",
        configuracoes_avancadas: { auto_resposta_fora_horario: false, rate_limit_mensagens_hora: 100 },
        estatisticas: { total_mensagens_enviadas: 0, total_mensagens_recebidas: 0, taxa_resposta_24h: 0, tempo_medio_resposta_minutos: 0 },
        ultima_atividade: new Date().toISOString()
      };

      if (integracaoSelecionada) {
        await base44.entities.WhatsAppIntegration.update(integracaoSelecionada.id, dados);
        toast.success("✅ Integração Meta Cloud API atualizada!");
      } else {
        await base44.entities.WhatsAppIntegration.create(dados);
        toast.success("✅ Integração Meta Cloud API criada!");
      }

      setModoEdicao(false);
      setIntegracaoSelecionada(null);
      setForm(initialForm);
      if (onRecarregar) await onRecarregar();
    } catch (error) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (integ) => {
    if (!confirm("⚠️ Tem certeza que deseja DELETAR esta integração Meta Cloud API?")) return;
    try {
      await base44.entities.WhatsAppIntegration.delete(integ.id);
      toast.success("✅ Integração removida!");
      setIntegracaoSelecionada(null);
      if (onRecarregar) await onRecarregar();
    } catch (error) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  const testarConexao = async (integ) => {
    setTestando(integ.id);
    try {
      // Testar via Graph API - verificar número
      const url = `https://graph.facebook.com/v21.0/${integ.meta_phone_number_id}?access_token=${integ.api_key_provider}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.id) {
        await base44.entities.WhatsAppIntegration.update(integ.id, {
          status: "conectado",
          ultima_atividade: new Date().toISOString()
        });
        toast.success(`✅ Meta Cloud API conectada! Número: ${data.display_phone_number || integ.numero_telefone}`);
        if (onRecarregar) await onRecarregar();
      } else {
        throw new Error(data.error?.message || "Token inválido ou número não encontrado");
      }
    } catch (error) {
      toast.error("❌ Erro na conexão: " + error.message);
      await base44.entities.WhatsAppIntegration.update(integ.id, { status: "erro_conexao" });
      if (onRecarregar) await onRecarregar();
    } finally {
      setTestando(null);
    }
  };

  const copiar = (texto) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };

  const statusBadge = (status) => {
    switch (status) {
      case "conectado": return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case "erro_conexao": return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      default: return <Badge className="bg-orange-100 text-orange-700 border-orange-200"><AlertCircle className="w-3 h-3 mr-1" />Desconectado</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <MetaLogo />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Meta Cloud API</h2>
            <p className="text-[11px] text-slate-500">WhatsApp Business API oficial (sem celular Android)</p>
          </div>
          <Badge variant="outline" className="ml-2 text-[10px] h-5">
            {integracoesMeta.filter(i => i.status === 'conectado').length}/{integracoesMeta.length}
          </Badge>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={iniciarNova} className="h-8 text-xs bg-blue-600 hover:bg-blue-700">
            <Plus className="w-3 h-3 mr-1" />
            Nova
          </Button>
        )}
      </div>

      {/* Alerta informativo */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-xs">
          <strong>Número Fixo / Sem Android:</strong> A Meta Cloud API permite usar qualquer número de telefone (fixo ou celular) sem precisar de um smartphone Android conectado. O número é verificado via <strong>ligação de voz</strong> ou SMS.
          {" "}<a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">Ver guia Meta <ExternalLink className="w-3 h-3" /></a>
        </AlertDescription>
      </Alert>

      {/* Layout 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista */}
        <div className="space-y-1.5">
          {integracoesMeta.length === 0 ? (
            <div className="p-6 text-center border border-dashed rounded-lg bg-slate-50">
              <Cloud className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Nenhuma conexão Meta</p>
              {isAdmin && (
                <Button onClick={iniciarNova} size="sm" className="mt-3 h-7 text-xs bg-blue-600">
                  <Plus className="w-3 h-3 mr-1" />Criar
                </Button>
              )}
            </div>
          ) : (
            integracoesMeta.map((integ) => (
              <div
                key={integ.id}
                onClick={() => selecionarIntegracao(integ)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                  integracaoSelecionada?.id === integ.id
                    ? 'border-blue-400 bg-blue-50/80 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${integ.status === 'conectado' ? 'bg-green-500 animate-pulse' : 'bg-orange-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-slate-800 truncate">{integ.nome_instancia}</p>
                    <p className="text-[10px] text-slate-500 truncate">{integ.numero_telefone}</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5">Meta</Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Painel direito */}
        <div className="lg:col-span-2 space-y-4">
          {!integracaoSelecionada && !modoEdicao ? (
            <div className="p-8 text-center border border-dashed rounded-lg bg-slate-50">
              <Settings className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Selecione uma instância ou crie uma nova</p>
            </div>
          ) : (
            <Card className="border-blue-200">
              <CardHeader className="pb-3 pt-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-600" />
                    {modoEdicao ? (integracaoSelecionada ? 'Editar' : 'Nova Conexão Meta Cloud API') : 'Configurações'}
                  </CardTitle>
                  <div className="flex gap-1.5">
                    {!modoEdicao && isAdmin && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setModoEdicao(true)} className="h-7 text-xs">
                          <Edit className="w-3 h-3 mr-1" />Editar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200" onClick={() => excluir(integracaoSelecionada)}>
                          <Trash2 className="w-3 h-3 mr-1" />Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {modoEdicao ? (
                  <div className="space-y-3">
                    {/* Guia passo a passo */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 space-y-1">
                      <p className="font-semibold">📋 Como obter as credenciais:</p>
                      <ol className="list-decimal ml-4 space-y-0.5">
                        <li>Acesse <a href="https://developers.facebook.com" target="_blank" className="underline">developers.facebook.com</a> → Criar App</li>
                        <li>Adicione o produto <strong>WhatsApp</strong></li>
                        <li>Em <strong>WhatsApp → Configuração</strong>, copie o <strong>Phone Number ID</strong> e <strong>WABA ID</strong></li>
                        <li>Gere um <strong>Token Permanente</strong> no Gerenciador de Negócios</li>
                        <li>Para número fixo: use a verificação por <strong>ligação de voz</strong></li>
                      </ol>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600">Nome *</Label>
                        <Input value={form.nome_instancia} onChange={e => setForm({...form, nome_instancia: e.target.value})} placeholder="meta-vendas" className="mt-1 h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600">Número *</Label>
                        <Input value={form.numero_telefone} onChange={e => setForm({...form, numero_telefone: e.target.value})} placeholder="+55 48 3333-4444" className="mt-1 h-8 text-xs" />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">WABA ID (WhatsApp Business Account ID) *</Label>
                      <Input value={form.meta_waba_id} onChange={e => setForm({...form, meta_waba_id: e.target.value})} placeholder="123456789012345" className="mt-1 h-8 font-mono text-[11px]" />
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">Phone Number ID *</Label>
                      <Input value={form.meta_phone_number_id} onChange={e => setForm({...form, meta_phone_number_id: e.target.value})} placeholder="987654321098765" className="mt-1 h-8 font-mono text-[11px]" />
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <Key className="w-3 h-3" />Token de Acesso Permanente *
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          type={showToken ? "text" : "password"}
                          value={form.api_key_provider}
                          onChange={e => setForm({...form, api_key_provider: e.target.value})}
                          placeholder="EAAxxxxxx..."
                          className="h-8 pr-8 font-mono text-[11px]"
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-8 w-7" onClick={() => setShowToken(!showToken)}>
                          {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Gere um token permanente em: Meta Business Manager → Configurações → Usuários do Sistema</p>
                    </div>

                    {/* Webhook */}
                    <div className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg">
                      <Label className="text-[11px] font-semibold text-purple-700 mb-1.5 flex items-center justify-between">
                        🔗 URL do Webhook
                        <Badge className="bg-purple-600 text-white text-[9px] h-4 px-1.5">Configure no painel Meta</Badge>
                      </Label>
                      <div className="flex gap-2">
                        <Input value={webhookUrl} readOnly className="font-mono text-[10px] bg-white h-8 flex-1" />
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => copiar(webhookUrl)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-purple-600 mt-1">
                        💡 No painel Meta Developers → WhatsApp → Configuração → Cole esta URL no campo <strong>Webhook</strong>
                      </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setModoEdicao(false); if (!integracaoSelecionada) setIntegracaoSelecionada(null); }}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={salvar} disabled={loading} className="h-7 text-xs bg-blue-600 hover:bg-blue-700">
                        {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                        {integracaoSelecionada ? 'Salvar' : 'Criar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Modo visualização
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px]">Nome:</span>
                        <p className="font-semibold text-slate-800">{integracaoSelecionada?.nome_instancia}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">Número:</span>
                        <p className="font-semibold text-slate-800">{integracaoSelecionada?.numero_telefone}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">Status:</span>
                        <div className="mt-0.5">{statusBadge(integracaoSelecionada?.status)}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">Provedor:</span>
                        <div className="mt-0.5"><Badge className="bg-blue-100 text-blue-700 text-[10px]">Meta Cloud API</Badge></div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">WABA ID:</span>
                        <p className="font-mono text-[10px] text-slate-700 truncate">{integracaoSelecionada?.meta_waba_id || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">Phone Number ID:</span>
                        <p className="font-mono text-[10px] text-slate-700 truncate">{integracaoSelecionada?.meta_phone_number_id || '—'}</p>
                      </div>
                    </div>

                    {/* Webhook */}
                    <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-[10px] font-semibold text-purple-700 mb-1">🔗 Webhook URL</p>
                      <div className="flex gap-2">
                        <Input value={integracaoSelecionada?.webhook_url || webhookUrl} readOnly className="font-mono text-[10px] bg-white h-7 flex-1" />
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => copiar(integracaoSelecionada?.webhook_url || webhookUrl)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Botão testar */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testarConexao(integracaoSelecionada)}
                        disabled={testando === integracaoSelecionada?.id}
                        className="h-7 text-xs"
                      >
                        {testando === integracaoSelecionada?.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                        Testar Conexão
                      </Button>
                      <a
                        href="https://developers.facebook.com/apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline h-7 px-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Painel Meta
                      </a>
                    </div>

                    {integracaoSelecionada?.estatisticas && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <div className="bg-green-50 rounded-md p-1.5 text-center">
                          <div className="text-[10px] text-slate-500">Enviadas</div>
                          <div className="font-bold text-sm text-green-600">{integracaoSelecionada.estatisticas.total_mensagens_enviadas || 0}</div>
                        </div>
                        <div className="bg-blue-50 rounded-md p-1.5 text-center">
                          <div className="text-[10px] text-slate-500">Recebidas</div>
                          <div className="font-bold text-sm text-blue-600">{integracaoSelecionada.estatisticas.total_mensagens_recebidas || 0}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}