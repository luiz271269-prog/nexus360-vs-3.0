import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Shield, Eye, Lock, Unlock, AlertTriangle, CheckCircle2, Info, Zap, Settings, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PERMISSIONS_PRESETS, buildUserPermissions } from '@/components/lib/permissionsService';
import GuiaRegraP1P12 from './GuiaRegraP1P12';
import { toast } from 'sonner';

export default function PainelPermissoesUnificado({ usuario, integracoes = [], onSalvar, runtimeMode = 'nexus360' }) {
  const [configuracao, setConfiguracao] = useState({
    modo_visibilidade: 'padrao_liberado',
    regras_bloqueio: [],
    regras_liberacao: [],
    deduplicacao: {
      ativa: true,
      criterio: 'contact_id',
      manter: 'mais_recente',
      excecoes: [
        { condicao: 'thread_interna', desativar_dedup: true },
        { condicao: 'admin_com_busca', desativar_dedup: true }
      ]
    }
  });
  
  const [permissoesAcoes, setPermissoesAcoes] = useState({});
  const [diagnostico, setDiagnostico] = useState({ ativo: false, log_level: 'info' });
  const [presetSelecionado, setPresetSelecionado] = useState(null);

  // Carregar configuração atual do usuário
  useEffect(() => {
    if (usuario?.configuracao_visibilidade_nexus) {
      setConfiguracao(usuario.configuracao_visibilidade_nexus);
    }
    
    if (usuario?.permissoes_acoes_nexus) {
      setPermissoesAcoes(usuario.permissoes_acoes_nexus);
    }
    
    if (usuario?.diagnostico_nexus) {
      setDiagnostico(usuario.diagnostico_nexus);
    }
    
    // Detectar preset baseado em attendant_role
    if (usuario?.attendant_role) {
      setPresetSelecionado(usuario.attendant_role);
    } else if (usuario?.role === 'admin') {
      setPresetSelecionado('admin');
    }
  }, [usuario]);

  const handleSalvar = async () => {
    try {
      console.log('[PainelPermissoesUnificado] Salvando configurações Nexus360:', {
        configuracao_visibilidade_nexus: configuracao,
        permissoes_acoes_nexus: permissoesAcoes,
        diagnostico_nexus: diagnostico
      });
      
      // Chamar onSalvar passando os dados Nexus360
      await onSalvar(usuario.id, {
        configuracao_visibilidade_nexus: configuracao,
        permissoes_acoes_nexus: permissoesAcoes,
        diagnostico_nexus: diagnostico
      });
      
      toast.success('✅ Permissões Nexus360 salvas com sucesso');
    } catch (error) {
      console.error('[PainelPermissoesUnificado] Erro ao salvar permissões:', error);
      toast.error('❌ Erro ao salvar permissões: ' + error.message);
    }
  };

  const aplicarPreset = (presetKey) => {
    const preset = PERMISSIONS_PRESETS[presetKey];
    if (preset) {
      setPermissoesAcoes({ ...preset });
      setPresetSelecionado(presetKey);
      toast.success(`Preset "${presetKey}" aplicado`);
    }
  };

  const adicionarRegraBloqueio = (tipo) => {
    const novaRegra = {
      tipo,
      valores_bloqueados: [],
      ativa: true,
      prioridade: 10,
      descricao: ''
    };
    
    setConfiguracao(prev => ({
      ...prev,
      regras_bloqueio: [...prev.regras_bloqueio, novaRegra]
    }));
  };

  const removerRegraBloqueio = (index) => {
    setConfiguracao(prev => ({
      ...prev,
      regras_bloqueio: prev.regras_bloqueio.filter((_, i) => i !== index)
    }));
  };

  const adicionarRegraLiberacao = (tipo) => {
    const configs = {
      janela_24h: { horas: 24 },
      gerente_supervisao: { minutos_sem_resposta: 30 }
    };
    
    const novaRegra = {
      tipo,
      ativa: true,
      prioridade: 5,
      configuracao: configs[tipo] || {}
    };
    
    setConfiguracao(prev => ({
      ...prev,
      regras_liberacao: [...prev.regras_liberacao, novaRegra]
    }));
  };

  const removerRegraLiberacao = (index) => {
    setConfiguracao(prev => ({
      ...prev,
      regras_liberacao: prev.regras_liberacao.filter((_, i) => i !== index)
    }));
  };

  const atualizarRegraBloqueio = (index, campo, valor) => {
    setConfiguracao(prev => ({
      ...prev,
      regras_bloqueio: prev.regras_bloqueio.map((regra, i) => 
        i === index ? { ...regra, [campo]: valor } : regra
      )
    }));
  };

  const atualizarRegraLiberacao = (index, campo, valor) => {
    setConfiguracao(prev => ({
      ...prev,
      regras_liberacao: prev.regras_liberacao.map((regra, i) => 
        i === index ? { ...regra, [campo]: valor } : regra
      )
    }));
  };

  const previewPermissoes = React.useMemo(() => {
    if (!usuario) return null;
    
    const usuarioSimulado = {
      ...usuario,
      configuracao_visibilidade_nexus: configuracao,
      permissoes_acoes_nexus: permissoesAcoes,
      diagnostico_nexus: diagnostico
    };
    
    return buildUserPermissions(usuarioSimulado, integracoes);
  }, [usuario, configuracao, permissoesAcoes, diagnostico, integracoes]);

  return (
    <div className="space-y-6">
      {/* GUIA P1-P12 */}
      <GuiaRegraP1P12 />

      {/* Header com modo Nexus360 */}
       <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Permissões Nexus360</CardTitle>
                <CardDescription>
                  Sistema centralizado de permissões - Padrão liberado, bloqueio por exceção
                </CardDescription>
              </div>
            </div>
            <Badge variant={configuracao.modo_visibilidade === 'padrao_liberado' ? 'default' : 'destructive'}>
              {configuracao.modo_visibilidade === 'padrao_liberado' ? '🟢 Liberado por Padrão' : '🔴 Bloqueado por Padrão'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* SEÇÃO 1: Perfil Rápido */}
      <Card>
            <CardHeader>
              <CardTitle>
                <Users className="w-5 h-5 inline mr-2" />
                Aplicar Perfil Predefinido
              </CardTitle>
              <CardDescription>
                Escolha um perfil base e personalize depois nas seções abaixo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.keys(PERMISSIONS_PRESETS).map(key => (
                  <Button
                    key={key}
                    variant={presetSelecionado === key ? 'default' : 'outline'}
                    onClick={() => aplicarPreset(key)}
                    className="h-auto flex-col items-start p-4"
                  >
                    <span className="font-semibold capitalize">{key}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {key === 'admin' && 'Acesso total'}
                      {key === 'gerente' && 'Visão ampla + gestão'}
                      {key === 'coordenador' && 'Supervisão setorial'}
                      {key === 'senior' && 'Supervisor operacional'}
                      {key === 'pleno' && 'Atendente completo'}
                      {key === 'junior' && 'Atendente básico'}
                    </span>
                  </Button>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Modo de Visibilidade</Label>
                <Select
                  value={configuracao.modo_visibilidade}
                  onValueChange={(val) => setConfiguracao(prev => ({ ...prev, modo_visibilidade: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao_liberado">
                      🟢 Padrão Liberado (Nexus360)
                    </SelectItem>
                    <SelectItem value="padrao_bloqueado">
                      🔴 Padrão Bloqueado (Restritivo)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {configuracao.modo_visibilidade === 'padrao_liberado' 
                    ? 'Tudo visível por padrão, bloqueado apenas por regra explícita'
                    : 'Tudo bloqueado por padrão, liberado apenas por regra explícita'
                  }
                </p>
              </div>
            </CardContent>
          </Card>

      {/* SEÇÃO 2: Bloqueios (Escopo de Acesso) */}
      <Card>
            <CardHeader>
              <CardTitle>
                <Lock className="w-5 h-5 inline mr-2 text-red-600" />
                Escopo de Acesso - Bloqueios Explícitos
              </CardTitle>
              <CardDescription>
                Define o que o usuário NÃO pode ver (P9/P10/P11 - deny-first)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => adicionarRegraBloqueio('setor')}>
                  + Bloquear Setor
                </Button>
                <Button size="sm" variant="outline" onClick={() => adicionarRegraBloqueio('integracao')}>
                  + Bloquear Integração
                </Button>
                <Button size="sm" variant="outline" onClick={() => adicionarRegraBloqueio('canal')}>
                  + Bloquear Canal
                </Button>
              </div>

              <div className="space-y-3">
                {configuracao.regras_bloqueio.map((regra, index) => (
                  <Card key={index} className="border-red-200">
                    <CardContent className="p-4 space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <Badge variant="destructive">{regra.tipo}</Badge>
                         <Badge variant="outline" className="text-xs">
                           {regra.tipo === 'setor' && 'P11'}
                           {regra.tipo === 'integracao' && 'P10'}
                           {regra.tipo === 'canal' && 'P9'}
                         </Badge>
                       </div>
                       <div className="flex items-center gap-2">
                          <Switch
                            checked={regra.ativa}
                            onCheckedChange={(checked) => atualizarRegraBloqueio(index, 'ativa', checked)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removerRegraBloqueio(index)}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Valores Bloqueados</Label>
                        {regra.tipo === 'setor' && (
                          <Select
                            value=""
                            onValueChange={(val) => {
                              const valores = regra.valores_bloqueados || [];
                              if (!valores.includes(val)) {
                                atualizarRegraBloqueio(index, 'valores_bloqueados', [...valores, val]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Adicionar setor bloqueado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vendas">Vendas</SelectItem>
                              <SelectItem value="assistencia">Assistência</SelectItem>
                              <SelectItem value="financeiro">Financeiro</SelectItem>
                              <SelectItem value="fornecedor">Fornecedor</SelectItem>
                              <SelectItem value="geral">Geral</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {regra.tipo === 'integracao' && (
                          <Select
                            value=""
                            onValueChange={(val) => {
                              const valores = regra.valores_bloqueados || [];
                              if (!valores.includes(val)) {
                                atualizarRegraBloqueio(index, 'valores_bloqueados', [...valores, val]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Adicionar integração bloqueada" />
                            </SelectTrigger>
                            <SelectContent>
                              {integracoes.map(int => (
                                <SelectItem key={int.id} value={int.id}>
                                  {int.nome_instancia} ({int.numero_telefone})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {regra.tipo === 'canal' && (
                          <Select
                            value=""
                            onValueChange={(val) => {
                              const valores = regra.valores_bloqueados || [];
                              if (!valores.includes(val)) {
                                atualizarRegraBloqueio(index, 'valores_bloqueados', [...valores, val]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Adicionar canal bloqueado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="instagram">Instagram</SelectItem>
                              <SelectItem value="facebook">Facebook</SelectItem>
                              <SelectItem value="phone">Telefone</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                          {(regra.valores_bloqueados || []).map((valor, vIdx) => (
                            <Badge key={vIdx} variant="destructive" className="cursor-pointer" onClick={() => {
                              atualizarRegraBloqueio(
                                index, 
                                'valores_bloqueados', 
                                regra.valores_bloqueados.filter((_, i) => i !== vIdx)
                              );
                            }}>
                              {valor} ×
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Input
                        placeholder="Descrição da regra (opcional)"
                        value={regra.descricao || ''}
                        onChange={(e) => atualizarRegraBloqueio(index, 'descricao', e.target.value)}
                      />
                    </CardContent>
                  </Card>
                ))}

                {configuracao.regras_bloqueio.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma regra de bloqueio configurada</p>
                    <p className="text-xs">Usuário pode ver TUDO (padrão Nexus360)</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

      {/* SEÇÃO 3: Liberações (Redes de Segurança) */}
      <Card>
            <CardHeader>
              <CardTitle>
                <Unlock className="w-5 h-5 inline mr-2 text-green-600" />
                Redes de Segurança - Liberações Especiais
              </CardTitle>
              <CardDescription>
                Libera acesso mesmo quando normalmente seria bloqueado (P5/P8 - allow-override)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => adicionarRegraLiberacao('janela_24h')}>
                  + Janela 24h
                </Button>
                <Button size="sm" variant="outline" onClick={() => adicionarRegraLiberacao('gerente_supervisao')}>
                  + Supervisão Gerencial
                </Button>
              </div>

              <div className="space-y-3">
                {configuracao.regras_liberacao.map((regra, index) => (
                  <Card key={index} className="border-green-200">
                    <CardContent className="p-4 space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                           {regra.tipo === 'janela_24h' ? '⏰ Janela 24h' : '👁️ Supervisão Gerencial'}
                         </Badge>
                         <Badge variant="outline" className="text-xs">
                           {regra.tipo === 'janela_24h' ? 'P5' : 'P8'}
                         </Badge>
                       </div>
                       <div className="flex items-center gap-2">
                          <Switch
                            checked={regra.ativa}
                            onCheckedChange={(checked) => atualizarRegraLiberacao(index, 'ativa', checked)}
                          />
                          <Button size="sm" variant="ghost" onClick={() => removerRegraLiberacao(index)}>
                            Remover
                          </Button>
                        </div>
                      </div>

                      {regra.tipo === 'janela_24h' && (
                        <div className="space-y-2">
                          <Label>Janela de Tempo (horas)</Label>
                          <Input
                            type="number"
                            value={regra.configuracao?.horas || 24}
                            onChange={(e) => atualizarRegraLiberacao(index, 'configuracao', {
                              ...regra.configuracao,
                              horas: parseInt(e.target.value) || 24
                            })}
                            min={1}
                            max={168}
                          />
                          <p className="text-xs text-muted-foreground">
                            Usuário vê threads que recebeu mensagem do cliente nas últimas {regra.configuracao?.horas || 24} horas
                          </p>
                        </div>
                      )}

                      {regra.tipo === 'gerente_supervisao' && (
                        <div className="space-y-2">
                          <Label>Tempo Sem Resposta (minutos)</Label>
                          <Input
                            type="number"
                            value={regra.configuracao?.minutos_sem_resposta || 30}
                            onChange={(e) => atualizarRegraLiberacao(index, 'configuracao', {
                              ...regra.configuracao,
                              minutos_sem_resposta: parseInt(e.target.value) || 30
                            })}
                            min={5}
                            max={1440}
                          />
                          <p className="text-xs text-muted-foreground">
                            Gerente vê threads de outros quando cliente aguarda resposta há {regra.configuracao?.minutos_sem_resposta || 30}+ minutos
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {configuracao.regras_liberacao.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Unlock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma regra de liberação configurada</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

      {/* SEÇÃO 4: Ações Granulares */}
      <Card>
            <CardHeader>
              <CardTitle>
                <Shield className="w-5 h-5 inline mr-2 text-purple-600" />
                Permissões Granulares de Ações
              </CardTitle>
              <CardDescription>
                Controle fino de ações e flags de visibilidade híbrida (sobrescreve preset)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className={runtimeMode === 'nexus_ativo' ? 'bg-amber-50 border-amber-300' : ''}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Preset aplicado: <strong>{presetSelecionado || 'Nenhum'}</strong>. 
                  Alterações aqui sobrescrevem o preset.
                  {runtimeMode === 'nexus_ativo' && (
                    <span className="block mt-1 text-amber-700 font-medium">
                      ⚠️ ATENÇÃO: Nexus360 está ativo - mudanças afetam o usuário imediatamente!
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              {/* NOVA SEÇÃO: Visibilidade Fina (Regras Híbridas) */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold">Visibilidade Fina (Regras Híbridas P6/P7)</h3>
                </div>
                
                <Alert className="mb-4 bg-purple-50 border-purple-200">
                  <Info className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-xs">
                    <strong>Regras Híbridas:</strong> Controlam como supervisores/gerentes 
                    acessam conversas de equipe sem violar privacidade individual.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 gap-3">
                  {/* Flag 1: Ver Não Atribuídas */}
                  <div className="flex items-start justify-between p-4 border rounded-lg bg-blue-50/50 hover:bg-blue-100/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">Ver threads não atribuídas (filas)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Permite visualizar conversas na fila "Sem dono" do seu setor
                      </p>
                    </div>
                    <Switch
                      checked={permissoesAcoes.podeVerNaoAtribuidas ?? true}
                      onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, podeVerNaoAtribuidas: v}))}
                    />
                  </div>

                  {/* Flag 2: Ver Conversas de Outros */}
                  <div className="flex items-start justify-between p-4 border rounded-lg bg-amber-50/50 hover:bg-amber-100/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium">Ver conversas atribuídas a outros</span>
                        <Badge variant="outline" className="text-xs ml-2">P7</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Permite supervisão de threads em andamento de outros atendentes do setor
                      </p>
                    </div>
                    <Switch
                      checked={permissoesAcoes.podeVerConversasOutros ?? false}
                      onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, podeVerConversasOutros: v}))}
                    />
                  </div>

                  {/* Flag 3: Ver Carteiras de Outros */}
                  <div className="flex items-start justify-between p-4 border rounded-lg bg-green-50/50 hover:bg-green-100/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium">Ver carteiras de outros atendentes</span>
                        <Badge variant="outline" className="text-xs ml-2">P6</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Permite acessar contatos fidelizados a colegas do setor (supervisão de carteira)
                      </p>
                    </div>
                    <Switch
                      checked={permissoesAcoes.podeVerCarteiraOutros ?? false}
                      onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, podeVerCarteiraOutros: v}))}
                    />
                  </div>

                  {/* Flag 4: Ver Todos Setores */}
                  <div className="flex items-start justify-between p-4 border rounded-lg bg-indigo-50/50 hover:bg-indigo-100/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm font-medium">Ver todos os setores (cross-setorial)</span>
                        <Badge variant="outline" className="text-xs ml-2">P11 Override</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Permite acesso a threads de TODOS os setores (diretor/gerente geral)
                      </p>
                    </div>
                    <Switch
                      checked={permissoesAcoes.podeVerTodosSetores ?? false}
                      onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, podeVerTodosSetores: v}))}
                    />
                  </div>

                  {/* Flag 5: Strict Mode */}
                  <div className="flex items-start justify-between p-4 border-2 border-red-300 rounded-lg bg-red-50 hover:bg-red-100/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Lock className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium">🚨 Strict Mode (Modo Restrito)</span>
                        <Badge variant="destructive" className="text-xs ml-2">Desativa P5/P8</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Desativa liberações P5 (janela 24h) e P8 (supervisão) - zero exceções
                      </p>
                      <p className="text-xs text-red-600 font-medium mt-1">
                        ⚠️ Use para estagiários ou usuários em período de experiência
                      </p>
                    </div>
                    <Switch
                      checked={permissoesAcoes.strictMode ?? false}
                      onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, strictMode: v}))}
                    />
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Seção existente de ações granulares - EXPANDIDA */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold">Permissões Detalhadas de Comunicação</h3>
                </div>

                {/* CATEGORIA 1: ENVIO DE MENSAGENS */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    📤 Envio de Mensagens e Conteúdo
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeEnviarMensagens', 
                        label: 'Enviar mensagens de texto', 
                        desc: 'Permite digitar e enviar mensagens de texto nas conversas'
                      },
                      { 
                        key: 'podeEnviarMidias', 
                        label: 'Enviar imagens, vídeos e documentos', 
                        desc: 'Habilita botão de anexo (📎) para enviar arquivos'
                      },
                      { 
                        key: 'podeEnviarAudios', 
                        label: 'Gravar e enviar áudios', 
                        desc: 'Habilita botão de microfone (🎤) para gravar mensagens de voz'
                      },
                      { 
                        key: 'podeUsarTemplates', 
                        label: 'Usar templates aprovados', 
                        desc: 'Enviar mensagens fora da janela de 24h usando templates do WhatsApp'
                      },
                      { 
                        key: 'podeUsarRespostasRapidas', 
                        label: 'Usar respostas rápidas (Quick Replies)', 
                        desc: 'Acessar biblioteca de respostas prontas para agilizar atendimento'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 2: GESTÃO DE CONVERSAS */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    💬 Gestão de Conversas
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeTransferirConversa', 
                        label: 'Transferir conversas para outros', 
                        desc: 'Pode transferir atendimento para outro atendente ou setor'
                      },
                      { 
                        key: 'podeAtribuirConversas', 
                        label: 'Atribuir conversas não atribuídas', 
                        desc: 'Pode pegar conversas da fila e atribuir a si mesmo ou colegas'
                      },
                      { 
                        key: 'podeAssumirDaFila', 
                        label: '⭐ Assumir conversa da fila', 
                        desc: '🚨 CRÍTICO: Botão "Assumir Próximo" - pega thread automaticamente'
                      },
                      { 
                        key: 'podeApagarMensagens', 
                        label: 'Apagar mensagens enviadas', 
                        desc: 'Permite deletar mensagens do WhatsApp (apaga para todos)'
                      },
                      { 
                        key: 'podeMarcarComoLida', 
                        label: 'Marcar conversas como lidas', 
                        desc: 'Pode limpar contador de não lidas mesmo sem ler todas'
                      },
                      { 
                        key: 'podeEncerrarConversa', 
                        label: 'Encerrar/Arquivar conversas', 
                        desc: 'Marcar conversa como resolvida e arquivar (implementar)'
                      },
                      { 
                        key: 'podeReabrirConversa', 
                        label: 'Reabrir conversas arquivadas', 
                        desc: 'Reativar conversas que foram encerradas (implementar)'
                      },
                      { 
                        key: 'podeCriarNotasInternas', 
                        label: '⭐ Criar notas internas (privadas)', 
                        desc: '🚨 CRÍTICO: Mensagens com visibility=internal_only (cliente não vê)'
                      },
                      { 
                        key: 'podeResponderMensagens', 
                        label: 'Responder mensagens (reply/quote)', 
                        desc: 'Usar recurso de resposta citando mensagem anterior'
                      },
                      { 
                        key: 'podeEncaminharMensagens', 
                        label: '⭐ Encaminhar mensagens para outros contatos', 
                        desc: '🚨 PRIVACIDADE: Forward de mensagens entre conversas'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 3: GESTÃO DE CONTATOS */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    👤 Gestão de Contatos
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeVerDetalhesContato', 
                        label: 'Ver informações detalhadas do contato', 
                        desc: 'Acessar painel lateral com dados completos, histórico e score'
                      },
                      { 
                        key: 'podeEditarContato', 
                        label: 'Editar dados do contato', 
                        desc: 'Alterar nome, empresa, cargo, telefone, email e observações'
                      },
                      { 
                        key: 'podeCriarContato', 
                        label: 'Criar novos contatos', 
                        desc: 'Adicionar contatos via busca ou formulário de cadastro'
                      },
                      { 
                        key: 'podeBloquearContato', 
                        label: 'Bloquear/Desbloquear contatos', 
                        desc: 'Impedir temporariamente recebimento de mensagens de um contato'
                      },
                      { 
                        key: 'podeDeletarContato', 
                        label: 'Deletar contatos permanentemente', 
                        desc: '⚠️ Ação irreversível - remove contato e histórico completo'
                      },
                      { 
                        key: 'podeAlterarFidelizacao', 
                        label: 'Alterar atendente fidelizado', 
                        desc: 'Modificar atendentes fixos por setor (carteira de clientes)'
                      },
                      { 
                        key: 'podeAlterarTipoContato', 
                        label: 'Alterar tipo de contato', 
                        desc: 'Mudar classificação: Novo → Lead → Cliente → Fornecedor'
                      },
                      { 
                        key: 'podeAlterarStatusContato', 
                        label: '⭐ Alterar status do lead/cliente', 
                        desc: 'Mudar status: novo_lead → qualificado → desqualificado, etc.'
                      },
                      { 
                        key: 'podeAdicionarTags', 
                        label: 'Adicionar/Remover etiquetas', 
                        desc: 'Gerenciar tags para categorização de contatos'
                      },
                      { 
                        key: 'podeVerHistoricoCompleto', 
                        label: 'Ver histórico completo de interações', 
                        desc: 'Acesso a todas as interações passadas (ligações, emails, visitas)'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 4: VISIBILIDADE E ACESSO */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    👁️ Visibilidade e Acesso a Conversas
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeVerTodasConversas', 
                        label: 'Ver todas as conversas do sistema', 
                        desc: '🔴 ADMIN/GERENTE - Acesso irrestrito a todas as threads (ignora atribuições)'
                      },
                      { 
                        key: 'podeVerConversasAtribuidas', 
                        label: 'Ver conversas atribuídas a mim', 
                        desc: 'Threads com assigned_user_id = meu ID (sempre habilitado)'
                      },
                      { 
                        key: 'podeVerConversasFidelizadas', 
                        label: 'Ver conversas de contatos fidelizados', 
                        desc: 'Threads de clientes da minha carteira (atendente_fidelizado_*)'
                      },
                      { 
                        key: 'podeVerConversasNaoAtribuidas', 
                        label: 'Ver fila de não atribuídas', 
                        desc: 'Conversas sem dono - permite assumir atendimento'
                      },
                      { 
                        key: 'podeVerConversasOutrosAtendentes', 
                        label: 'Ver conversas de outros atendentes', 
                        desc: 'Supervisão - vê threads atribuídas a colegas do setor'
                      },
                      { 
                        key: 'podeVerConversasOutrosSetores', 
                        label: 'Ver conversas de outros setores', 
                        desc: '🔴 CROSS-SETORIAL - Acesso além do seu setor (gerente geral)'
                      },
                      { 
                        key: 'podeVerThreadsInternas', 
                        label: 'Ver chats internos da equipe', 
                        desc: 'Conversas team_internal e sector_group que participa'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 5: AUTOMAÇÃO E PLAYBOOKS */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    ⚡ Automação e Fluxos
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeCriarPlaybooks', 
                        label: 'Criar novos playbooks', 
                        desc: 'Desenhar fluxos conversacionais e automações'
                      },
                      { 
                        key: 'podeEditarPlaybooks', 
                        label: 'Editar playbooks existentes', 
                        desc: 'Modificar fluxos criados por outros usuários'
                      },
                      { 
                        key: 'podeDeletarPlaybooks', 
                        label: '⭐ Deletar playbooks permanentemente', 
                        desc: '⚠️ Remover fluxos do sistema (ação irreversível)'
                      },
                      { 
                        key: 'podeDuplicarPlaybooks', 
                        label: 'Duplicar/Clonar playbooks', 
                        desc: 'Copiar fluxos existentes para criar variações'
                      },
                      { 
                        key: 'podeAtivarDesativarPlaybooks', 
                        label: 'Ativar/Desativar playbooks', 
                        desc: 'Controlar quais fluxos estão rodando no sistema'
                      },
                      { 
                        key: 'podeVerEstatisticasPlaybooks', 
                        label: 'Ver estatísticas de playbooks', 
                        desc: 'Acessar métricas de performance dos fluxos'
                      },
                      { 
                        key: 'podeCriarPromocoes', 
                        label: 'Criar campanhas promocionais', 
                        desc: 'Configurar envios automáticos de promoções'
                      },
                      { 
                        key: 'podeEnviarPromocoesManuais', 
                        label: 'Enviar promoções manualmente', 
                        desc: 'Disparar campanhas fora do ciclo automático'
                      },
                      { 
                        key: 'podeCriarRespostasRapidas', 
                        label: '⭐ Criar respostas rápidas (Quick Replies)', 
                        desc: 'Adicionar mensagens prontas na biblioteca'
                      },
                      { 
                        key: 'podeDeletarRespostasRapidas', 
                        label: 'Deletar respostas rápidas', 
                        desc: 'Remover Quick Replies da biblioteca'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 6: CONFIGURAÇÕES E SISTEMA */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    ⚙️ Configurações e Sistema
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeGerenciarConexoes', 
                        label: 'Gerenciar conexões WhatsApp', 
                        desc: '⚠️ Configurar, conectar e desconectar instâncias WhatsApp'
                      },
                      { 
                        key: 'podeGerenciarFilas', 
                        label: 'Gerenciar filas de atendimento', 
                        desc: 'Criar, editar e configurar setores/filas de distribuição'
                      },
                      { 
                        key: 'podeGerenciarPermissoes', 
                        label: 'Gerenciar permissões de outros usuários', 
                        desc: '🔴 ADMIN - Editar esta tela para outros usuários'
                      },
                      { 
                        key: 'podeVerDiagnosticos', 
                        label: 'Acessar diagnósticos do sistema', 
                        desc: 'Ver logs, webhooks e ferramentas de debug técnico'
                      },
                      { 
                        key: 'podeVerRelatorios', 
                        label: 'Ver relatórios e analytics', 
                        desc: 'Dashboard com métricas de performance e vendas'
                      },
                      { 
                        key: 'podeExportarDados', 
                        label: 'Exportar dados e relatórios', 
                        desc: 'Baixar CSVs, PDFs e planilhas de dados do sistema'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 7: BROADCAST E ENVIOS EM MASSA */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    📢 Envios em Massa e Broadcast
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeUsarBroadcastExterno', 
                        label: 'Enviar broadcast para múltiplos clientes', 
                        desc: 'Modo seleção múltipla - enviar mesma mensagem para vários contatos'
                      },
                      { 
                        key: 'podeUsarBroadcastInterno', 
                        label: 'Enviar broadcast interno (equipe)', 
                        desc: 'Enviar mensagem para múltiplos atendentes/setores simultaneamente'
                      },
                      { 
                        key: 'podeSelecionarMultiplosContatos', 
                        label: 'Selecionar múltiplos contatos na lista', 
                        desc: 'Habilita checkboxes de seleção múltipla'
                      },
                      { 
                        key: 'podeEnviarParaSetorCompleto', 
                        label: 'Enviar para setor completo (grupo)', 
                        desc: 'Broadcast para todos do setor de uma vez'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 8: MENSAGENS INTERNAS */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    🔵 Chat Interno (Team)
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeEnviarMensagensInternas', 
                        label: 'Enviar mensagens internas 1:1', 
                        desc: 'Chat privado com colegas da equipe'
                      },
                      { 
                        key: 'podeCriarGruposInternos', 
                        label: 'Criar grupos internos customizados', 
                        desc: 'Criar canais de equipe personalizados'
                      },
                      { 
                        key: 'podeParticiparGruposSetor', 
                        label: 'Participar de grupos de setor', 
                        desc: 'Acesso automático ao grupo do seu setor'
                      },
                      { 
                        key: 'podeAdicionarMembrosGrupo', 
                        label: 'Adicionar membros em grupos', 
                        desc: 'Convidar outros usuários para grupos que participa (implementar)'
                      },
                      { 
                        key: 'podeRemoverMembrosGrupo', 
                        label: 'Remover membros de grupos', 
                        desc: 'Expulsar usuários de grupos internos (implementar)'
                      },
                      { 
                        key: 'podeSairDeGrupo', 
                        label: 'Sair de grupos', 
                        desc: 'Deixar conversas em grupo que não quer participar'
                      },
                      { 
                        key: 'podeVerMembrosGrupo', 
                        label: 'Ver lista de membros do grupo', 
                        desc: 'Acessar lista completa de participantes'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 9: INTELIGÊNCIA E IA */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    🤖 Inteligência Artificial
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeUsarSugestorRespostas', 
                        label: 'Sugestor de respostas com IA', 
                        desc: 'Botão "Sugerir" que gera respostas contextuais automáticas'
                      },
                      { 
                        key: 'podeVerScoreContato', 
                        label: 'Ver score e temperatura do contato', 
                        desc: 'Visualizar análise de engajamento e próximas ações sugeridas'
                      },
                      { 
                        key: 'podeForcarRequalificacao', 
                        label: 'Forçar requalificação de lead', 
                        desc: 'Rodar análise de IA manualmente para atualizar score'
                      },
                      { 
                        key: 'podeVerInsightsIA', 
                        label: 'Ver insights e alertas da IA', 
                        desc: 'Notificações inteligentes sobre oportunidades e riscos'
                      },
                      { 
                        key: 'podeCategorizarMensagensIndividuais', 
                        label: '⭐ Categorizar mensagens individuais', 
                        desc: 'Adicionar tags em mensagens específicas (menu contexto)'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 10: TELEFONIA (GoTo Integration) */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    📞 Telefonia e Chamadas
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeRealizarChamadas', 
                        label: '⭐ Realizar chamadas outbound', 
                        desc: 'Discar para contatos via integração GoTo/telefônica'
                      },
                      { 
                        key: 'podeVerHistoricoChamadas', 
                        label: '⭐ Ver histórico de chamadas', 
                        desc: '🚨 PRIVACIDADE: Acessar CallHistoryPanel com ligações de outros'
                      },
                      { 
                        key: 'podeEscutarGravacoes', 
                        label: 'Escutar gravações de chamadas', 
                        desc: '🔴 ALTA SENSIBILIDADE: Ouvir áudios de ligações gravadas'
                      },
                      { 
                        key: 'podeVerMetricasTelefonia', 
                        label: 'Ver métricas de atendimento telefônico', 
                        desc: 'Dashboard de performance de chamadas'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 11: ANALYTICS E MÉTRICAS */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    📊 Analytics e Métricas
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeVerMetricasIndividuais', 
                        label: 'Ver métricas individuais (próprias)', 
                        desc: 'Dashboard pessoal: metas, conversões, tempo de resposta'
                      },
                      { 
                        key: 'podeVerMetricasEquipe', 
                        label: '⭐ Ver métricas da equipe', 
                        desc: '🔴 SUPERVISÃO: Performance de colegas do setor'
                      },
                      { 
                        key: 'podeVerMetricasGlobais', 
                        label: 'Ver métricas globais da empresa', 
                        desc: '🔴 DIRETORIA: Visão macro de todos os setores'
                      },
                      { 
                        key: 'podeVerDashboardVendas', 
                        label: 'Ver dashboard de vendas', 
                        desc: 'Faturamento, pipeline, conversões'
                      },
                      { 
                        key: 'podeVerRankings', 
                        label: 'Ver rankings de desempenho', 
                        desc: 'Classificação de vendedores/atendentes'
                      },
                      { 
                        key: 'podeExportarRelatoriosCustomizados', 
                        label: 'Exportar relatórios customizados', 
                        desc: 'Gerar CSVs/PDFs com filtros personalizados'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 12: CONFIGURAÇÕES AVANÇADAS */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    🎛️ Configurações Avançadas do Sistema
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeConfigurarURA', 
                        label: '⭐ Configurar URA (pré-atendimento)', 
                        desc: '🔴 ALTO IMPACTO: Editar fluxo de escolha de setor inicial'
                      },
                      { 
                        key: 'podeConfigurarHorariosAtendimento', 
                        label: 'Configurar horários de atendimento', 
                        desc: 'Definir quando cada setor/atendente está disponível'
                      },
                      { 
                        key: 'podeConfigurarMensagensAutomaticas', 
                        label: 'Configurar mensagens automáticas', 
                        desc: 'Auto-respostas, mensagens de ausência, boas-vindas'
                      },
                      { 
                        key: 'podeConfigurarRegrasRoteamento', 
                        label: 'Configurar regras de roteamento', 
                        desc: '🔴 CRÍTICO: Algoritmo de distribuição de conversas'
                      },
                      { 
                        key: 'podeConfigurarSLAs', 
                        label: 'Configurar SLAs e alertas', 
                        desc: 'Tempo máximo de resposta, escalação automática'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* CATEGORIA 13: INTEGRAÇÃO COM OUTROS MÓDULOS */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    🔗 Integração com Outros Módulos
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        key: 'podeCriarOrcamentoDeChat', 
                        label: 'Criar orçamento a partir do chat', 
                        desc: 'Botão contexto na mensagem para gerar orçamento pré-preenchido'
                      },
                      { 
                        key: 'podeCriarClienteDeContato', 
                        label: 'Converter contato em cliente', 
                        desc: 'Promover Contact para Cliente (entidade completa)'
                      },
                      { 
                        key: 'podeRegistrarInteracao', 
                        label: 'Registrar interações manualmente', 
                        desc: 'Criar registro de ligação, reunião ou visita'
                      },
                      { 
                        key: 'podeAcessarAgenda', 
                        label: 'Acessar agenda de tarefas', 
                        desc: 'Ver e criar lembretes/tarefas a partir de conversas'
                      }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 mr-4">
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                        </div>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

      {/* SEÇÃO 5: Preview Consolidado */}
      <Card className="border-slate-300 bg-slate-50">
            <CardHeader>
              <CardTitle>
                <Eye className="w-5 h-5 inline mr-2 text-slate-600" />
                Preview das Permissões Processadas
              </CardTitle>
              <CardDescription>
                Como o sistema interpretará estas configurações (decisão final P1-P12)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {previewPermissoes && (
                <div className="space-y-4">
                  {/* Bloqueios */}
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-500" />
                      Bloqueios Ativos
                    </h3>
                    <div className="space-y-1">
                      {previewPermissoes.setoresBloqueados?.length > 0 && (
                        <div className="flex gap-2 items-center text-sm">
                          <span className="text-muted-foreground">Setores:</span>
                          {previewPermissoes.setoresBloqueados.map(s => (
                            <Badge key={s} variant="destructive">{s}</Badge>
                          ))}
                        </div>
                      )}
                      {previewPermissoes.integracoesBloqueadas?.length > 0 && (
                        <div className="flex gap-2 items-center text-sm">
                          <span className="text-muted-foreground">Integrações:</span>
                          {previewPermissoes.integracoesBloqueadas.map(i => (
                            <Badge key={i} variant="destructive">{i}</Badge>
                          ))}
                        </div>
                      )}
                      {previewPermissoes.canaisBloqueados?.length > 0 && (
                        <div className="flex gap-2 items-center text-sm">
                          <span className="text-muted-foreground">Canais:</span>
                          {previewPermissoes.canaisBloqueados.map(c => (
                            <Badge key={c} variant="destructive">{c}</Badge>
                          ))}
                        </div>
                      )}
                      {!previewPermissoes.setoresBloqueados?.length && 
                       !previewPermissoes.integracoesBloqueadas?.length && 
                       !previewPermissoes.canaisBloqueados?.length && (
                        <p className="text-sm text-muted-foreground">Nenhum bloqueio ativo</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Liberações */}
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Unlock className="w-4 h-4 text-green-500" />
                      Liberações Especiais
                    </h3>
                    <div className="space-y-1 text-sm">
                      {previewPermissoes.janela24hAtiva && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span>Janela de {previewPermissoes.janela24hHoras}h ativa</span>
                        </div>
                      )}
                      {previewPermissoes.gerenteSupervisaoAtiva && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span>Supervisão gerencial ({previewPermissoes.gerenteSupervisaoMinutos}min)</span>
                        </div>
                      )}
                      {!previewPermissoes.janela24hAtiva && !previewPermissoes.gerenteSupervisaoAtiva && (
                        <p className="text-muted-foreground">Nenhuma liberação especial ativa</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Ações principais */}
                  <div>
                    <h3 className="font-semibold mb-2">Principais Ações Permitidas</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(permissoesAcoes).slice(0, 10).map(([key, valor]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          {valor ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <Lock className="w-4 h-4 text-red-500" />
                          )}
                          <span className={valor ? '' : 'text-muted-foreground'}>
                            {key.replace('pode', '').replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Diagnóstico */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Diagnóstico Avançado</h3>
                      <Switch
                        checked={diagnostico.ativo}
                        onCheckedChange={(checked) => setDiagnostico(prev => ({ ...prev, ativo: checked }))}
                      />
                    </div>
                    {diagnostico.ativo && (
                      <Alert>
                        <Info className="h-4 h-4" />
                        <AlertDescription>
                          Logs detalhados de decisões (decision_path, reason_code) serão gerados no console.
                          Use apenas para debugging.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            </Card>

            {/* Botões de Ação */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Cancelar
        </Button>
        <Button onClick={handleSalvar} className="bg-purple-600 hover:bg-purple-700">
          <Shield className="w-4 h-4 mr-2" />
          Salvar Permissões Nexus360
        </Button>
      </div>
    </div>
  );
}