import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Settings, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const CONFIG_SCHEMA = [
  {
    categoria: "🏢 Empresa",
    itens: [
      { chave: "nome_empresa", label: "Nome da Empresa", tipo: "text", placeholder: "Ex: Minha Empresa Ltda", descricao: "Usado nos prompts da IA ao atender clientes" },
      { chave: "descricao_empresa", label: "Descrição do Negócio", tipo: "text", placeholder: "Ex: tecnologia B2B, 30+ anos de mercado", descricao: "Segmento e ramo de atuação da empresa" },
    ]
  },
  {
    categoria: "🤖 Inteligência Artificial",
    itens: [
      {
        chave: "modelo_ia", label: "Modelo Claude", tipo: "select",
        opcoes: [
          { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (rápido / econômico)" },
          { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (mais inteligente)" },
          { value: "claude-opus-4-6", label: "Claude Opus 4 (máxima qualidade)" }
        ],
        descricao: "Modelo Anthropic usado nas análises de IA (haiku = econômico, sonnet/opus = maior qualidade)"
      },
      { chave: "cooldown_humano_minutos", label: "Cooldown após Atendente Responder (min)", tipo: "number", placeholder: "10", descricao: "Minutos após atendente humano responder antes da IA agir novamente" },
      { chave: "max_disparos_hora", label: "Máx. Disparos Automáticos / hora", tipo: "number", placeholder: "10", descricao: "Limite de mensagens automáticas enviadas por chip por hora" },
      { chave: "calibracao_min_runs", label: "Runs Mínimos para Modo Autônomo", tipo: "number", placeholder: "50", descricao: "Quantos ciclos antes de liberar modo autônomo completo" },
    ]
  },
  {
    categoria: "⏰ Jarvis (Monitor Automático)",
    itens: [
      { chave: "jarvis_cooldown_horas", label: "Cooldown entre Alertas (horas)", tipo: "number", placeholder: "4", descricao: "Intervalo mínimo entre alertas para a mesma conversa" },
      { chave: "jarvis_max_threads", label: "Máx. Conversas por Ciclo", tipo: "number", placeholder: "3", descricao: "Quantas conversas o Jarvis processa por rodada do loop" },
    ]
  }
];

export default function ConfiguracaoIA() {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [savedIds, setSavedIds] = useState({});
  const [usuario, setUsuario] = useState(null);

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [user, configsDB] = await Promise.all([
        base44.auth.me(),
        base44.entities.ConfiguracaoSistema.filter({ ativa: true }, 'chave', 100)
      ]);
      setUsuario(user);
      const map = {};
      const ids = {};
      for (const c of configsDB) {
        map[c.chave] = c.valor?.value !== undefined ? String(c.valor.value) : '';
        ids[c.chave] = c.id;
      }
      setConfigs(map);
      setSavedIds(ids);
    } catch (e) {
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const salvar = async (chave) => {
    setSaving(prev => ({ ...prev, [chave]: true }));
    try {
      const valor = { value: configs[chave] };
      if (savedIds[chave]) {
        await base44.entities.ConfiguracaoSistema.update(savedIds[chave], {
          valor,
          ativa: true,
          ultima_atualizacao: new Date().toISOString(),
          atualizado_por: usuario?.email || ''
        });
      } else {
        const novo = await base44.entities.ConfiguracaoSistema.create({
          chave,
          categoria: 'geral',
          valor,
          ativa: true,
          descricao: `Configuração: ${chave}`,
          ultima_atualizacao: new Date().toISOString(),
          atualizado_por: usuario?.email || ''
        });
        setSavedIds(prev => ({ ...prev, [chave]: novo.id }));
      }
      toast.success(`✅ "${chave}" salvo`);
    } catch (e) {
      toast.error(`Erro ao salvar ${chave}: ${e.message}`);
    } finally {
      setSaving(prev => ({ ...prev, [chave]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (usuario?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Acesso restrito a administradores</h2>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuração do Sistema</h1>
            <p className="text-gray-500 text-sm">Parâmetros carregados dinamicamente pelas funções de IA</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={carregarDados}>
          <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
        </Button>
      </div>

      {CONFIG_SCHEMA.map((grupo) => (
        <Card key={grupo.categoria} className="shadow-sm border border-gray-200">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-base font-semibold text-gray-800">{grupo.categoria}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {grupo.itens.map((item) => (
              <div key={item.chave} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">{item.label}</label>
                  {savedIds[item.chave] ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Salvo no banco
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">
                      Usando padrão
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-400">{item.descricao}</p>
                <div className="flex gap-2">
                  {item.tipo === 'select' ? (
                    <Select
                      value={configs[item.chave] || ''}
                      onValueChange={(val) => setConfigs(prev => ({ ...prev, [item.chave]: val }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {item.opcoes.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={item.tipo}
                      value={configs[item.chave] || ''}
                      onChange={(e) => setConfigs(prev => ({ ...prev, [item.chave]: e.target.value }))}
                      placeholder={item.placeholder}
                      className="flex-1"
                    />
                  )}
                  <Button
                    onClick={() => salvar(item.chave)}
                    disabled={saving[item.chave] || !configs[item.chave]}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4"
                  >
                    {saving[item.chave] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Como funciona:</strong> Cada campo salvo aqui é lido automaticamente pelas funções <code>nexusAgentBrain</code>, <code>agentCommand</code> e <code>jarvisEventLoop</code> via entidade <code>ConfiguracaoSistema</code>. Sem necessidade de alterar código.
      </div>
    </div>
  );
}