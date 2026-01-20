import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

      {/* ABAS COMPACTAS - Bloqueios + Liberações + Ações */}
      <Card>
        <Tabs defaultValue="bloqueios" className="w-full">
          <CardHeader className="pb-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bloqueios" className="text-xs">🔒 Bloqueios</TabsTrigger>
              <TabsTrigger value="liberacoes" className="text-xs">🔓 Liberações</TabsTrigger>
              <TabsTrigger value="acoes" className="text-xs">⚡ Ações</TabsTrigger>
            </TabsList>
          </CardHeader>
          
          <TabsContent value="bloqueios" className="mt-0">
            <CardContent className="space-y-3 pt-3">
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => adicionarRegraBloqueio('setor')} className="text-xs h-7">
                  + Setor
                </Button>
                <Button size="sm" variant="outline" onClick={() => adicionarRegraBloqueio('integracao')} className="text-xs h-7">
                  + Integração
                </Button>
                <Button size="sm" variant="outline" onClick={() => adicionarRegraBloqueio('canal')} className="text-xs h-7">
                  + Canal
                </Button>
              </div>

              <div className="space-y-2">
                {configuracao.regras_bloqueio.map((regra, index) => (
                  <Card key={index} className="border-red-200">
                    <CardContent className="p-2 space-y-2">
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
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-xs">Nenhum bloqueio - Liberado por padrão</p>
                  </div>
                )}
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="liberacoes" className="mt-0">
            <CardContent className="space-y-3 pt-3">
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => adicionarRegraLiberacao('janela_24h')} className="text-xs h-7">
                  + Janela 24h
                </Button>
                <Button size="sm" variant="outline" onClick={() => adicionarRegraLiberacao('gerente_supervisao')} className="text-xs h-7">
                  + Supervisão
                </Button>
              </div>

              <div className="space-y-2">
                {configuracao.regras_liberacao.map((regra, index) => (
                  <Card key={index} className="border-green-200">
                    <CardContent className="p-2 space-y-2">
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
                  <div className="text-center py-3 text-muted-foreground">
                    <p className="text-xs">Nenhuma liberação</p>
                  </div>
                )}
                </CardContent>
                </TabsContent>

                <TabsContent value="acoes" className="mt-0">
                <CardContent className="space-y-2 pt-3 max-h-[600px] overflow-y-auto">
                <div className="space-y-2">
                  {/* CATEGORIA 1: ENVIO */}
                  <h4 className="text-xs font-bold text-slate-600 mb-1">📤 Envio</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { key: 'podeEnviarMensagens', label: 'Mensagens' },
                      { key: 'podeEnviarMidias', label: 'Mídias' },
                      { key: 'podeEnviarAudios', label: 'Áudios' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-1.5 border rounded hover:bg-slate-50">
                        <span className="text-xs">{label}</span>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-2" />

                {/* CATEGORIA 2: GESTÃO */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-600 mb-1">💬 Gestão</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { key: 'podeTransferirConversa', label: 'Transferir' },
                      { key: 'podeAtribuirConversas', label: 'Atribuir' },
                      { key: 'podeAssumirDaFila', label: 'Assumir Fila' },
                      { key: 'podeApagarMensagens', label: 'Apagar Msgs' },
                      { key: 'podeMarcarComoLida', label: 'Marcar Lida' },
                      { key: 'podeCriarNotasInternas', label: 'Notas Internas' },
                      { key: 'podeResponderMensagens', label: 'Responder' },
                      { key: 'podeEncaminharMensagens', label: 'Encaminhar' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-1.5 border rounded hover:bg-slate-50">
                        <span className="text-xs">{label}</span>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-2" />

                {/* CATEGORIA 3: CONTATOS */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-600 mb-1">👤 Contatos</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { key: 'podeVerDetalhesContato', label: 'Ver Detalhes' },
                      { key: 'podeEditarContato', label: 'Editar' },
                      { key: 'podeCriarContato', label: 'Criar' },
                      { key: 'podeBloquearContato', label: 'Bloquear' },
                      { key: 'podeDeletarContato', label: 'Deletar' },
                      { key: 'podeAlterarFidelizacao', label: 'Fidelização' },
                      { key: 'podeAlterarStatusContato', label: 'Status' },
                      { key: 'podeAdicionarTags', label: 'Tags' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-1.5 border rounded hover:bg-slate-50">
                        <span className="text-xs">{label}</span>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-2" />

                {/* CATEGORIA 4: AUTOMAÇÃO */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-600 mb-1">⚡ Automação</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { key: 'podeCriarPlaybooks', label: 'Criar Playbooks' },
                      { key: 'podeEditarPlaybooks', label: 'Editar Playbooks' },
                      { key: 'podeDeletarPlaybooks', label: 'Deletar Playbooks' },
                      { key: 'podeCriarPromocoes', label: 'Criar Promoções' },
                      { key: 'podeCriarRespostasRapidas', label: 'Criar Quick Replies' },
                      { key: 'podeConfigurarURA', label: 'Configurar URA' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-1.5 border rounded hover:bg-slate-50">
                        <span className="text-xs">{label}</span>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-2" />

                {/* CATEGORIA 5: SISTEMA */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-600 mb-1">⚙️ Sistema</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { key: 'podeGerenciarConexoes', label: 'Gerenciar Conexões' },
                      { key: 'podeGerenciarFilas', label: 'Gerenciar Filas' },
                      { key: 'podeGerenciarPermissoes', label: 'Gerenciar Permissões' },
                      { key: 'podeVerDiagnosticos', label: 'Diagnósticos' },
                      { key: 'podeVerRelatorios', label: 'Relatórios' },
                      { key: 'podeExportarDados', label: 'Exportar' },
                      { key: 'podeRealizarChamadas', label: 'Chamadas' },
                      { key: 'podeVerMetricasIndividuais', label: 'Métricas Próprias' },
                      { key: 'podeVerMetricasEquipe', label: 'Métricas Equipe' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between p-1.5 border rounded hover:bg-slate-50">
                        <span className="text-xs">{label}</span>
                        <Switch
                          checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                          onCheckedChange={(checked) => setPermissoesAcoes(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </TabsContent>
          </Tabs>
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