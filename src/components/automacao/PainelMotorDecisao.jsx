import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap, Settings, Database, TrendingUp, Shield, Plus, Save, 
  Trash2, Power, Clock, Brain, Target, Users, AlertCircle,
  CheckCircle2, BarChart3, Edit2, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

export default function PainelMotorDecisao() {
  const [contextoSelecionado, setContextoSelecionado] = useState('global');
  const [configSelecionada, setConfigSelecionada] = useState(null);
  const [regraSelecionada, setRegraSelecionada] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const queryClient = useQueryClient();

  // Buscar configurações
  const { data: configuracoes = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['motor-decisao-configs'],
    queryFn: () => base44.entities.MotorDecisaoConfig.list('-updated_date'),
    staleTime: 2 * 60 * 1000
  });

  // Buscar regras de intenção
  const { data: regras = [], isLoading: loadingRegras } = useQuery({
    queryKey: ['regras-intencao'],
    queryFn: () => base44.entities.RegrasIntencao.list('prioridade'),
    staleTime: 2 * 60 * 1000
  });

  // Buscar integrações para seletor
  const { data: integracoes = [] } = useQuery({
    queryKey: ['integracoes-whatsapp'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    staleTime: 5 * 60 * 1000
  });

  // Buscar playbooks para seleção
  const { data: playbooks = [] } = useQuery({
    queryKey: ['playbooks'],
    queryFn: () => base44.entities.FlowTemplate.filter({ ativo: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  // Configuração global vs específica
  const configGlobal = configuracoes.find(c => !c.integration_id);
  const configsEspecificas = configuracoes.filter(c => c.integration_id);

  // Determinar qual config mostrar
  const configAtual = contextoSelecionado === 'global' 
    ? configGlobal 
    : configsEspecificas.find(c => c.integration_id === contextoSelecionado);

  useEffect(() => {
    if (configAtual) {
      setConfigSelecionada(configAtual);
    }
  }, [contextoSelecionado, configuracoes]);

  // Criar nova configuração
  const handleCriarConfig = async (integration_id = null) => {
    try {
      const integracao = integration_id ? integracoes.find(i => i.id === integration_id) : null;
      
      const novaConfig = await base44.entities.MotorDecisaoConfig.create({
        integration_id,
        nome_configuracao: integration_id 
          ? `Config - ${integracao?.nome_instancia || 'Conexão'}` 
          : 'Configuração Global',
        ativo: true,
        janela_continuidade_horas: 48,
        buffer_agrupamento_segundos: 3,
        usar_intencao_palavras: true,
        usar_intencao_ia: false,
        usar_fidelizacao: true,
        threshold_confianca_ia: 0.75,
        modo_debug: false,
        prioridade: 10
      });

      await queryClient.invalidateQueries({ queryKey: ['motor-decisao-configs'] });
      setConfigSelecionada(novaConfig);
      toast.success('✅ Configuração criada!');
    } catch (error) {
      console.error('[MOTOR] Erro ao criar config:', error);
      toast.error('Erro ao criar configuração');
    }
  };

  // Salvar configuração
  const handleSalvarConfig = async () => {
    if (!configSelecionada) return;
    
    setSalvando(true);
    try {
      await base44.entities.MotorDecisaoConfig.update(configSelecionada.id, configSelecionada);
      await queryClient.invalidateQueries({ queryKey: ['motor-decisao-configs'] });
      toast.success('✅ Configuração salva!');
    } catch (error) {
      console.error('[MOTOR] Erro ao salvar:', error);
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  // Criar nova regra
  const handleCriarRegra = async () => {
    try {
      const novaRegra = await base44.entities.RegrasIntencao.create({
        nome_regra: 'Nova Regra',
        termos_chave: [],
        setor_alvo: 'geral',
        prioridade: 10,
        ativo: true,
        match_type: 'any',
        case_sensitive: false,
        conexoes_permitidas: contextoSelecionado === 'global' ? [] : [contextoSelecionado]
      });

      await queryClient.invalidateQueries({ queryKey: ['regras-intencao'] });
      setRegraSelecionada(novaRegra);
      toast.success('✅ Regra criada!');
    } catch (error) {
      console.error('[MOTOR] Erro ao criar regra:', error);
      toast.error('Erro ao criar regra');
    }
  };

  // Salvar regra
  const handleSalvarRegra = async () => {
    if (!regraSelecionada) return;
    
    try {
      await base44.entities.RegrasIntencao.update(regraSelecionada.id, regraSelecionada);
      await queryClient.invalidateQueries({ queryKey: ['regras-intencao'] });
      toast.success('✅ Regra salva!');
    } catch (error) {
      console.error('[MOTOR] Erro ao salvar regra:', error);
      toast.error('Erro ao salvar regra');
    }
  };

  // Excluir regra
  const handleExcluirRegra = async (regraId) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;
    
    try {
      await base44.entities.RegrasIntencao.delete(regraId);
      await queryClient.invalidateQueries({ queryKey: ['regras-intencao'] });
      if (regraSelecionada?.id === regraId) setRegraSelecionada(null);
      toast.success('✅ Regra excluída!');
    } catch (error) {
      console.error('[MOTOR] Erro ao excluir:', error);
      toast.error('Erro ao excluir regra');
    }
  };

  // Filtrar regras por contexto
  const regrasFiltradas = regras.filter(regra => {
    if (contextoSelecionado === 'global') {
      return !regra.conexoes_permitidas || regra.conexoes_permitidas.length === 0;
    }
    return !regra.conexoes_permitidas || 
           regra.conexoes_permitidas.length === 0 || 
           regra.conexoes_permitidas.includes(contextoSelecionado);
  });

  // Gerar explicação da lógica atual
  const gerarExplicacaoLogica = () => {
    if (!configAtual) {
      return "⚠️ Nenhuma configuração ativa. Configure o motor para começar.";
    }

    const explicacoes = [];

    // Status do motor
    if (!configAtual.ativo) {
      explicacoes.push("🔴 **Motor Desativado** - Sistema usando comportamento padrão (fallback).");
      return explicacoes.join("\n\n");
    }

    explicacoes.push("🟢 **Motor Ativo** - Decisão inteligente de 3 camadas operando.");

    // Horário de Atendimento
    const inicio = configAtual.horario_atendimento_inicio || '08:00';
    const fim = configAtual.horario_atendimento_fim || '18:00';
    const dias = configAtual.dias_atendimento_semana || [1, 2, 3, 4, 5];
    const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const diasTexto = dias.map(d => diasNomes[d]).join(', ');
    
    explicacoes.push(`⏰ **Horário de Atendimento:**\n${inicio} às ${fim} (${diasTexto})\n→ Fora deste horário: ${configAtual.playbook_fora_horario_id ? '✅ Executa playbook específico' : '❌ Sem playbook configurado'}`);

    // Camada 1: Continuidade
    const janela = configAtual.janela_continuidade_horas || 48;
    explicacoes.push(`🔄 **Camada 1 - Continuidade:**\nSe o cliente conversou nas últimas ${janela}h:\n→ Retorna para o mesmo atendente\n→ **Ignora** bot e regras`);

    // Camada 2: Intenção
    let intencaoTexto = "🧠 **Camada 2 - Intenção:**\n";
    if (configAtual.usar_intencao_palavras) {
      const totalRegras = regrasFiltradas.length;
      intencaoTexto += `✅ Palavras-chave ativas (${totalRegras} regras)\n`;
    }
    if (configAtual.usar_intencao_ia) {
      intencaoTexto += `🤖 IA ativa (${Math.round((configAtual.threshold_confianca_ia || 0.75) * 100)}% confiança)\n`;
    }
    if (!configAtual.usar_intencao_palavras && !configAtual.usar_intencao_ia) {
      intencaoTexto += "❌ Intenção desativada\n";
    }
    intencaoTexto += "→ Se detectar intenção: Roteia para setor/playbook";
    explicacoes.push(intencaoTexto);

    // Camada 3: Fidelização
    explicacoes.push(`👤 **Camada 3 - Fidelização:**\n${configAtual.usar_fidelizacao ? '✅ Ativa - Roteia para vendedor responsável' : '❌ Desativada'}`);

    // Fallback
    explicacoes.push(`🔄 **Fallback:**\nSe nenhuma camada decidir:\n→ ${configAtual.fallback_playbook_id ? '✅ Executa playbook padrão (Menu)' : '❌ Sem playbook configurado'}`);

    return explicacoes.join("\n\n");
  };

  return (
    <div className="grid grid-cols-[1fr,400px] gap-6">
      {/* Coluna Principal: Configurações */}
      <div className="space-y-6">
        {/* Header com Seletor de Contexto */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-7 h-7" />
              Motor de Decisão Pré-Atendimento
            </h1>
            <p className="text-indigo-100 text-sm mt-1">
              Sistema inteligente de roteamento com 3 camadas + anti-redundância
            </p>
          </div>
          {configAtual && (
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
              <Power className={`w-5 h-5 ${configAtual.ativo ? 'text-green-300' : 'text-red-300'}`} />
              <span className="font-semibold">
                {configAtual.ativo ? 'ATIVO' : 'DESATIVADO'}
              </span>
            </div>
          )}
        </div>

        {/* Seletor de Contexto */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Configurando:</span>
          <Select value={contextoSelecionado} onValueChange={setContextoSelecionado}>
            <SelectTrigger className="w-64 bg-white text-slate-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">🌍 Todas as Conexões (Padrão Global)</SelectItem>
              {integracoes.map(int => (
                <SelectItem key={int.id} value={int.id}>
                  📱 {int.nome_instancia} ({int.numero_telefone})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {contextoSelecionado !== 'global' && !configAtual && (
            <Button 
              onClick={() => handleCriarConfig(contextoSelecionado)}
              className="bg-white text-indigo-600 hover:bg-indigo-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Config Específica
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="config-geral" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config-geral">
            <Settings className="w-4 h-4 mr-2" />
            Configuração Geral
          </TabsTrigger>
          <TabsTrigger value="regras-intencao">
            <Target className="w-4 h-4 mr-2" />
            Regras de Intenção
          </TabsTrigger>
          <TabsTrigger value="metricas">
            <BarChart3 className="w-4 h-4 mr-2" />
            Métricas & Performance
          </TabsTrigger>
        </TabsList>

        {/* TAB: CONFIGURAÇÃO GERAL */}
        <TabsContent value="config-geral" className="space-y-4">
          {!configAtual ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma configuração encontrada</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Crie uma configuração {contextoSelecionado === 'global' ? 'global' : 'para esta conexão'}
                  </p>
                  <Button onClick={() => handleCriarConfig(contextoSelecionado === 'global' ? null : contextoSelecionado)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Configuração
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Disjuntor Geral */}
              <Card className={configSelecionada?.ativo ? 'border-green-500' : 'border-red-500'}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Power className={`w-5 h-5 ${configSelecionada?.ativo ? 'text-green-600' : 'text-red-600'}`} />
                    Disjuntor Geral do Motor
                  </CardTitle>
                  <CardDescription>
                    {configSelecionada?.ativo 
                      ? '✅ Motor ativo - usando decisão inteligente de 3 camadas' 
                      : '⚠️ Motor desligado - usando pré-atendimento padrão (fallback)'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Ativar Motor Inteligente</p>
                      <p className="text-xs text-slate-500">
                        Quando desligado, volta ao comportamento padrão atual
                      </p>
                    </div>
                    <Switch
                      checked={configSelecionada?.ativo || false}
                      onCheckedChange={(v) => setConfigSelecionada({ ...configSelecionada, ativo: v })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Camada 1: Continuidade */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Camada 1: Continuidade
                  </CardTitle>
                  <CardDescription>
                    Retorna conversas para o último atendente se dentro da janela de tempo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Janela de Continuidade (horas)
                    </label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min="1"
                        max="168"
                        value={configSelecionada?.janela_continuidade_horas || 48}
                        onChange={(e) => setConfigSelecionada({ 
                          ...configSelecionada, 
                          janela_continuidade_horas: parseInt(e.target.value) || 48 
                        })}
                        className="w-24"
                      />
                      <span className="text-sm text-slate-600">
                        {configSelecionada?.janela_continuidade_horas || 48} horas = {Math.round((configSelecionada?.janela_continuidade_horas || 48) / 24)} dias
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      💡 Vendas: 12-24h | Suporte: 48-72h | Projetos: 168h (1 semana)
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Buffer de Agrupamento (segundos)
                    </label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={configSelecionada?.buffer_agrupamento_segundos || 3}
                        onChange={(e) => setConfigSelecionada({ 
                          ...configSelecionada, 
                          buffer_agrupamento_segundos: parseInt(e.target.value) || 3 
                        })}
                        className="w-24"
                      />
                      <span className="text-sm text-slate-600">segundos</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      🛡️ Anti-redundância: aguarda mensagens picadas antes de processar
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Timeout do Lock (minutos)
                    </label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={configSelecionada?.lock_timeout_minutos || 5}
                        onChange={(e) => setConfigSelecionada({ 
                          ...configSelecionada, 
                          lock_timeout_minutos: parseInt(e.target.value) || 5 
                        })}
                        className="w-24"
                      />
                      <span className="text-sm text-slate-600">minutos</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      🔒 Segurança: libera locks travados após este tempo
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Camada 2: Intenção */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-600" />
                    Camada 2: Detecção de Intenção
                  </CardTitle>
                  <CardDescription>
                    Identifica a necessidade do cliente e roteia automaticamente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Palavras-Chave</p>
                      <p className="text-xs text-slate-600">Roteamento baseado em termos configurados</p>
                    </div>
                    <Switch
                      checked={configSelecionada?.usar_intencao_palavras || false}
                      onCheckedChange={(v) => setConfigSelecionada({ 
                        ...configSelecionada, 
                        usar_intencao_palavras: v 
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Classificação via IA</p>
                      <p className="text-xs text-slate-600">Usa LLM para detectar intenção complexa</p>
                    </div>
                    <Switch
                      checked={configSelecionada?.usar_intencao_ia || false}
                      onCheckedChange={(v) => setConfigSelecionada({ 
                        ...configSelecionada, 
                        usar_intencao_ia: v 
                      })}
                    />
                  </div>

                  {configSelecionada?.usar_intencao_ia && (
                    <div className="space-y-3 p-3 border rounded-lg">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Prompt para IA</label>
                        <Textarea
                          value={configSelecionada?.prompt_ia_intencao || ''}
                          onChange={(e) => setConfigSelecionada({ 
                            ...configSelecionada, 
                            prompt_ia_intencao: e.target.value 
                          })}
                          placeholder="Exemplo: Analise a mensagem do cliente e identifique qual setor seria mais adequado..."
                          className="h-24"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Confiança Mínima: {Math.round((configSelecionada?.threshold_confianca_ia || 0.75) * 100)}%
                        </label>
                        <Slider
                          value={[(configSelecionada?.threshold_confianca_ia || 0.75) * 100]}
                          onValueChange={(v) => setConfigSelecionada({ 
                            ...configSelecionada, 
                            threshold_confianca_ia: v[0] / 100 
                          })}
                          min={50}
                          max={95}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Camada 3: Fidelização */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    Camada 3: Fidelização & Carteira
                  </CardTitle>
                  <CardDescription>
                    Roteia para vendedor/atendente responsável do contato
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Ativar Fidelização</p>
                      <p className="text-xs text-slate-600">
                        Envia automaticamente para vendedor_responsavel ou atendente_fidelizado
                      </p>
                    </div>
                    <Switch
                      checked={configSelecionada?.usar_fidelizacao !== false}
                      onCheckedChange={(v) => setConfigSelecionada({ 
                        ...configSelecionada, 
                        usar_fidelizacao: v 
                      })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Horário de Atendimento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-600" />
                    Horário de Atendimento
                  </CardTitle>
                  <CardDescription>
                    Define quando o atendimento está disponível
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Horário de Início</label>
                      <Input
                        type="time"
                        value={configSelecionada?.horario_atendimento_inicio || '08:00'}
                        onChange={(e) => setConfigSelecionada({ 
                          ...configSelecionada, 
                          horario_atendimento_inicio: e.target.value 
                        })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Horário de Fim</label>
                      <Input
                        type="time"
                        value={configSelecionada?.horario_atendimento_fim || '18:00'}
                        onChange={(e) => setConfigSelecionada({ 
                          ...configSelecionada, 
                          horario_atendimento_fim: e.target.value 
                        })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Dias de Atendimento</label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 0, label: 'Dom' },
                        { value: 1, label: 'Seg' },
                        { value: 2, label: 'Ter' },
                        { value: 3, label: 'Qua' },
                        { value: 4, label: 'Qui' },
                        { value: 5, label: 'Sex' },
                        { value: 6, label: 'Sáb' }
                      ].map(dia => {
                        const diasAtivos = configSelecionada?.dias_atendimento_semana || [1, 2, 3, 4, 5];
                        const isAtivo = diasAtivos.includes(dia.value);
                        
                        return (
                          <Button
                            key={dia.value}
                            size="sm"
                            variant={isAtivo ? "default" : "outline"}
                            onClick={() => {
                              const novos = isAtivo
                                ? diasAtivos.filter(d => d !== dia.value)
                                : [...diasAtivos, dia.value].sort();
                              setConfigSelecionada({ 
                                ...configSelecionada, 
                                dias_atendimento_semana: novos 
                              });
                            }}
                            className={isAtivo ? 'bg-green-600 hover:bg-green-700' : ''}
                          >
                            {dia.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Playbook Fora de Horário</label>
                    <Select 
                      value={configSelecionada?.playbook_fora_horario_id || ''} 
                      onValueChange={(v) => setConfigSelecionada({ 
                        ...configSelecionada, 
                        playbook_fora_horario_id: v 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o playbook para fora de horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {playbooks.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-2">
                      💡 Este playbook será executado automaticamente quando mensagens chegarem fora do horário
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Fallback */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-600" />
                    Fallback & Segurança
                  </CardTitle>
                  <CardDescription>
                    O que fazer quando nenhuma camada decidir
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Playbook Padrão (URA/Menu)</label>
                    <Select 
                      value={configSelecionada?.fallback_playbook_id || ''} 
                      onValueChange={(v) => setConfigSelecionada({ 
                        ...configSelecionada, 
                        fallback_playbook_id: v 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o playbook padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        {playbooks.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Modo Debug</p>
                      <p className="text-xs text-slate-600">Gera logs detalhados para diagnóstico</p>
                    </div>
                    <Switch
                      checked={configSelecionada?.modo_debug || false}
                      onCheckedChange={(v) => setConfigSelecionada({ 
                        ...configSelecionada, 
                        modo_debug: v 
                      })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Botão Salvar */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleSalvarConfig} 
                  disabled={!configSelecionada || salvando}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  {salvando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Configuração
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* TAB: REGRAS DE INTENÇÃO */}
        <TabsContent value="regras-intencao" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Regras de Palavras-Chave</h3>
              <p className="text-sm text-slate-600">
                {contextoSelecionado === 'global' 
                  ? 'Regras aplicadas em todas as conexões' 
                  : `Regras para esta conexão específica`}
              </p>
            </div>
            <Button onClick={handleCriarRegra}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Regra
            </Button>
          </div>

          <div className="grid gap-4">
            {regrasFiltradas.map(regra => (
              <Card key={regra.id} className={!regra.ativo ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {regra.nome_regra}
                        {!regra.ativo && <Badge variant="secondary">Inativa</Badge>}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-blue-100 text-blue-800">
                          → {regra.setor_alvo}
                        </Badge>
                        <Badge variant="outline">
                          Prioridade: {regra.prioridade}
                        </Badge>
                        {regra.metricas?.total_matches > 0 && (
                          <Badge className="bg-green-100 text-green-800">
                            {regra.metricas.total_matches} matches
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setRegraSelecionada(regra)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleExcluirRegra(regra.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(regra.termos_chave || []).map((termo, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {termo}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {regrasFiltradas.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-sm text-slate-600">
                      Nenhuma regra configurada para este contexto
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Editor de Regra (Modal simplificado inline) */}
          {regraSelecionada && (
            <Card className="border-2 border-indigo-500 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <CardTitle className="flex items-center justify-between">
                  <span>Editando: {regraSelecionada.nome_regra}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRegraSelecionada(null)}
                  >
                    ✕
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nome da Regra</label>
                  <Input
                    value={regraSelecionada.nome_regra}
                    onChange={(e) => setRegraSelecionada({ ...regraSelecionada, nome_regra: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Palavras-Chave (separadas por vírgula)
                  </label>
                  <Input
                    value={(regraSelecionada.termos_chave || []).join(', ')}
                    onChange={(e) => setRegraSelecionada({ 
                      ...regraSelecionada, 
                      termos_chave: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    })}
                    placeholder="Ex: boleto, fatura, nota fiscal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Setor Alvo</label>
                    <Select 
                      value={regraSelecionada.setor_alvo} 
                      onValueChange={(v) => setRegraSelecionada({ ...regraSelecionada, setor_alvo: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendas">Vendas</SelectItem>
                        <SelectItem value="assistencia">Assistência</SelectItem>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="geral">Geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Prioridade</label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={regraSelecionada.prioridade}
                      onChange={(e) => setRegraSelecionada({ 
                        ...regraSelecionada, 
                        prioridade: parseInt(e.target.value) || 10 
                      })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Playbook Específico (opcional)</label>
                  <Select 
                    value={regraSelecionada.playbook_especifico_id || ''} 
                    onValueChange={(v) => setRegraSelecionada({ 
                      ...regraSelecionada, 
                      playbook_especifico_id: v 
                    })}
                  >
                    <SelectTrigger><SelectValue placeholder="Usar playbook padrão do setor" /></SelectTrigger>
                    <SelectContent>
                      {playbooks.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium">Regra Ativa</p>
                  <Switch
                    checked={regraSelecionada.ativo !== false}
                    onCheckedChange={(v) => setRegraSelecionada({ ...regraSelecionada, ativo: v })}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRegraSelecionada(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSalvarRegra} className="bg-green-600 hover:bg-green-700">
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Regra
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB: MÉTRICAS */}
        <TabsContent value="metricas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Performance do Motor de Decisão
              </CardTitle>
            </CardHeader>
            <CardContent>
              {configAtual?.metricas ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Total Decisões</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {configAtual.metricas.total_decisoes || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Continuidade</p>
                    <p className="text-2xl font-bold text-green-600">
                      {configAtual.metricas.camada1_hits || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Intenção</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {configAtual.metricas.camada2_hits || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Fallback</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {configAtual.metricas.fallback_hits || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-cyan-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Tempo Médio</p>
                    <p className="text-2xl font-bold text-cyan-600">
                      {configAtual.metricas.tempo_medio_decisao_ms || 0}ms
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Tempo IA</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {configAtual.metricas.tempo_medio_ia_ms || 0}ms
                    </p>
                  </div>
                  {configAtual.metricas.total_locks_expirados > 0 && (
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Locks Expirados</p>
                      <p className="text-2xl font-bold text-red-600">
                        {configAtual.metricas.total_locks_expirados}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">
                  Aguardando primeiras decisões...
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      {/* Coluna Lateral: Explicação da Lógica */}
      <div className="space-y-4">
        <Card className="sticky top-4 bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Brain className="w-5 h-5" />
              Lógica de Funcionamento
            </CardTitle>
            <CardDescription className="text-blue-700">
              Fluxo de decisão atual (gerado automaticamente)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-line leading-relaxed">
              {gerarExplicacaoLogica()}
            </div>
          </CardContent>
        </Card>

        {/* Exemplo de Simulação */}
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
              <Zap className="w-4 h-4" />
              Exemplo de Execução
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-amber-800 space-y-2">
            <p>📱 <strong>Cliente envia:</strong> "Oi, bom dia"</p>
            <p>🕐 <strong>Horário:</strong> Dentro do expediente</p>
            <p>🔄 <strong>Continuidade:</strong> Primeira conversa</p>
            <p>🧠 <strong>Intenção:</strong> Gatilho detectado</p>
            <p>➡️ <strong>Ação:</strong> {configAtual?.usar_intencao_palavras ? 'Executa playbook ou menu' : 'Vai para fallback'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}