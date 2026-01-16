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

export default function PainelPermissoesUnificado({ usuario, integracoes = [], onSalvar, runtimeMode = 'legacy' }) {
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
  const [sistemaAtivo, setSistemaAtivo] = useState('legado');

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
    
    if (usuario?.sistema_permissoes_ativo) {
      setSistemaAtivo(usuario.sistema_permissoes_ativo);
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
        sistema_permissoes_ativo: sistemaAtivo,
        configuracao_visibilidade_nexus: configuracao,
        permissoes_acoes_nexus: permissoesAcoes,
        diagnostico_nexus: diagnostico
      });
      
      // Chamar onSalvar passando os dados Nexus360
      await onSalvar(usuario.id, {
        sistema_permissoes_ativo: sistemaAtivo,
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
      {/* HEADER: Tabela Comparativa - Legado vs Nexus360 */}
       <Card className="border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50">
         <CardHeader>
           <CardTitle className="text-base">⚙️ Sistema de Permissões - Comparativo</CardTitle>
           <CardDescription className="text-xs">Legado vs Nexus360: campos iguais em cinza (desabilitado), diferenças destacadas</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           {/* Tabela Comparativa */}
           <div className="overflow-x-auto">
             <table className="w-full text-sm border-collapse">
               <thead>
                 <tr className="bg-slate-200">
                   <th className="border px-3 py-2 text-left font-bold">Campo</th>
                   <th className="border px-3 py-2 text-left font-bold">🔵 Legado (Atual)</th>
                   <th className="border px-3 py-2 text-left font-bold">🟢 Nexus360 (Novo)</th>
                 </tr>
               </thead>
               <tbody>
                 {/* Setor */}
                 <tr className={usuario?.setor === 'geral' ? 'bg-slate-100 opacity-50' : 'hover:bg-blue-50'}>
                   <td className="border px-3 py-2 font-medium">Setor Principal</td>
                   <td className="border px-3 py-2">{usuario?.setor || 'geral'}</td>
                   <td className="border px-3 py-2 text-slate-500">
                     {usuario?.setor === 'geral' ? '(mesmo)' : usuario?.setor || 'geral'}
                   </td>
                 </tr>

                 {/* Função */}
                 <tr className={usuario?.attendant_role === 'pleno' ? 'bg-slate-100 opacity-50' : 'hover:bg-blue-50'}>
                   <td className="border px-3 py-2 font-medium">Função</td>
                   <td className="border px-3 py-2">{usuario?.attendant_role || 'pleno'}</td>
                   <td className="border px-3 py-2 text-slate-500">
                     {usuario?.attendant_role === 'pleno' ? '(mesmo)' : usuario?.attendant_role || 'pleno'}
                   </td>
                 </tr>

                 {/* Modo Visibilidade */}
                 <tr className="hover:bg-green-50 bg-green-50/30 border-l-4 border-green-500">
                   <td className="border px-3 py-2 font-medium">Modo Visibilidade</td>
                   <td className="border px-3 py-2">
                     <Badge variant="outline" className="bg-blue-100">Padrão Liberado*</Badge>
                     <p className="text-[10px] text-muted-foreground mt-1">*sem configuração = libera</p>
                   </td>
                   <td className="border px-3 py-2">
                     <Badge variant={configuracao.modo_visibilidade === 'padrao_liberado' ? 'default' : 'destructive'}>
                       {configuracao.modo_visibilidade === 'padrao_liberado' ? '🟢 Liberado' : '🔴 Bloqueado'}
                     </Badge>
                     <p className="text-[10px] text-muted-foreground mt-1">Configurável</p>
                   </td>
                 </tr>

                 {/* Bloqueios */}
                 <tr className={configuracao.regras_bloqueio?.length === 0 ? 'bg-slate-100 opacity-50' : 'hover:bg-orange-50'}>
                   <td className="border px-3 py-2 font-medium">Bloqueios Explícitos</td>
                   <td className="border px-3 py-2">
                     <Badge variant="outline">Hardcoded</Badge>
                     <p className="text-[10px] text-muted-foreground mt-1">Integração, conexão, setor</p>
                   </td>
                   <td className="border px-3 py-2">
                     <Badge variant={configuracao.regras_bloqueio?.length > 0 ? 'destructive' : 'outline'}>
                       {configuracao.regras_bloqueio?.length || 0} regras
                     </Badge>
                     <p className="text-[10px] text-muted-foreground mt-1">P9/P10/P11 configuráveis</p>
                   </td>
                 </tr>

                 {/* Liberações */}
                 <tr className={configuracao.regras_liberacao?.length === 0 ? 'bg-slate-100 opacity-50' : 'hover:bg-green-50'}>
                   <td className="border px-3 py-2 font-medium">Liberações (P5/P8)</td>
                   <td className="border px-3 py-2">
                     <Badge variant="outline" className="bg-green-100">Hardcoded</Badge>
                     <p className="text-[10px] text-muted-foreground mt-1">Janela 24h, Supervisão 30min</p>
                   </td>
                   <td className="border px-3 py-2">
                     <Badge variant={configuracao.regras_liberacao?.length > 0 ? 'default' : 'outline'}>
                       {configuracao.regras_liberacao?.length || 0} regras
                     </Badge>
                     <p className="text-[10px] text-muted-foreground mt-1">Customizáveis</p>
                   </td>
                 </tr>

                 {/* Fidelização */}
                 <tr className="hover:bg-purple-50 bg-purple-50/30 border-l-4 border-purple-500">
                   <td className="border px-3 py-2 font-medium">Fidelização (Chave Mestra)</td>
                   <td className="border px-3 py-2">
                     <Badge variant="secondary">Genérica + Setorial</Badge>
                     <p className="text-[10px] text-muted-foreground mt-1">Contacto fidelizado = sempre vê</p>
                   </td>
                   <td className="border px-3 py-2">
                     <Badge variant="secondary">Genérica</Badge>
                     <p className="text-[10px] text-red-600 font-medium mt-1">⚠️ Setorial perdido</p>
                   </td>
                 </tr>

                 {/* WhatsApp */}
                 <tr className={!usuario?.is_whatsapp_attendant ? 'bg-slate-100 opacity-50' : 'hover:bg-blue-50'}>
                   <td className="border px-3 py-2 font-medium">WhatsApp Ativo</td>
                   <td className="border px-3 py-2">
                     <Badge variant={usuario?.is_whatsapp_attendant ? 'default' : 'outline'}>
                       {usuario?.is_whatsapp_attendant ? 'Ativo' : 'Inativo'}
                     </Badge>
                   </td>
                   <td className="border px-3 py-2 text-slate-500">
                     {!usuario?.is_whatsapp_attendant ? '(mesmo)' : 'Ativo'}
                   </td>
                 </tr>

                 {/* Conexões/Integrações */}
                 <tr className={!usuario?.whatsapp_permissions?.length ? 'bg-slate-100 opacity-50' : 'hover:bg-blue-50'}>
                   <td className="border px-3 py-2 font-medium">Conexões WhatsApp</td>
                   <td className="border px-3 py-2">
                     <Badge variant="outline">{(usuario?.whatsapp_permissions || []).length} conexões</Badge>
                   </td>
                   <td className="border px-3 py-2 text-slate-500">
                     {!usuario?.whatsapp_permissions?.length ? '(mesmo)' : '+ configurações detalhadas'}
                   </td>
                 </tr>

                 {/* Gerência (Supervisão) */}
                 <tr className={!['gerente', 'coordenador', 'senior'].includes(usuario?.attendant_role) ? 'bg-slate-100 opacity-50' : 'hover:bg-amber-50'}>
                   <td className="border px-3 py-2 font-medium">Pode Ver Conversas Outros (P7)</td>
                   <td className="border px-3 py-2">
                     <Badge variant="outline" className="bg-amber-100">
                       {['gerente', 'coordenador', 'senior'].includes(usuario?.attendant_role) ? 'Sim' : 'Não'}
                     </Badge>
                     <p className="text-[10px] text-muted-foreground mt-1">Por role</p>
                   </td>
                   <td className="border px-3 py-2">
                     <Switch
                       checked={permissoesAcoes.podeVerConversasOutros ?? false}
                       onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, podeVerConversasOutros: v}))}
                     />
                     <p className="text-[10px] text-muted-foreground mt-1">Configurável</p>
                   </td>
                 </tr>

                 {/* Strict Mode */}
                 <tr className={!permissoesAcoes.strictMode ? 'bg-slate-100 opacity-50' : 'bg-red-50/30 border-l-4 border-red-500'}>
                   <td className="border px-3 py-2 font-medium">Strict Mode (Desativa P5/P8)</td>
                   <td className="border px-3 py-2 text-slate-500">
                     N/A (não existe)
                   </td>
                   <td className="border px-3 py-2">
                     <Badge variant={permissoesAcoes.strictMode ? 'destructive' : 'outline'}>
                       {permissoesAcoes.strictMode ? '🚨 Ativo' : 'Inativo'}
                     </Badge>
                   </td>
                 </tr>
               </tbody>
             </table>
           </div>

           {/* Legenda e Alerta */}
           <Alert className="mt-4 border-amber-300 bg-amber-50">
             <AlertTriangle className="h-4 w-4 text-amber-600" />
             <AlertDescription className="text-xs text-amber-800">
               <strong>Linhas Cinzas:</strong> Campos idênticos (sem mudança)  
               <strong className="block mt-1">Linhas Coloridas:</strong> Mudanças importantes ou novas configurações (Nexus360)
             </AlertDescription>
           </Alert>

           {/* Botões de Ação */}
           <div className="flex gap-3 mt-4">
             <Button 
               variant={sistemaAtivo === 'legado' ? 'default' : 'outline'}
               size="sm"
               onClick={async () => {
                 setSistemaAtivo('legado');
                 try {
                   await onSalvar(usuario.id, { sistema_permissoes_ativo: 'legado' }, 'nexus360');
                   toast.success('🔵 Sistema Legado ativado');
                 } catch (error) {
                   console.error('Erro ao ativar Legado:', error);
                   toast.error('Erro ao salvar configuração');
                 }
               }}
               className={sistemaAtivo === 'legado' ? 'bg-blue-600' : ''}
             >
               🔵 Manter Legado
             </Button>
             <Button 
               variant={sistemaAtivo === 'nexus360' ? 'default' : 'outline'}
               size="sm"
               onClick={async () => {
                 setSistemaAtivo('nexus360');
                 try {
                   await onSalvar(usuario.id, { sistema_permissoes_ativo: 'nexus360' }, 'nexus360');
                   toast.success('🟢 Nexus360 ativado');
                 } catch (error) {
                   console.error('Erro ao ativar Nexus360:', error);
                   toast.error('Erro ao salvar configuração');
                 }
               }}
               className={sistemaAtivo === 'nexus360' ? 'bg-green-600' : ''}
             >
               🟢 Ativar Nexus360
             </Button>
           </div>
         </CardContent>
       </Card>

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
            <div className="flex items-center gap-2">
              <Badge variant={configuracao.modo_visibilidade === 'padrao_liberado' ? 'default' : 'destructive'}>
                {configuracao.modo_visibilidade === 'padrao_liberado' ? '🟢 Liberado por Padrão' : '🔴 Bloqueado por Padrão'}
              </Badge>
              <Badge 
                variant={runtimeMode === 'nexus_ativo' ? 'default' : 'outline'}
                className={
                  runtimeMode === 'nexus_ativo' ? 'bg-green-600 text-white' :
                  runtimeMode === 'nexus_shadow' ? 'bg-amber-500 text-white' :
                  'bg-slate-500 text-white'
                }
              >
                {runtimeMode === 'legacy' && '🔵 Legacy Ativo'}
                {runtimeMode === 'nexus_shadow' && '🟡 Nexus em Shadow'}
                {runtimeMode === 'nexus_ativo' && '🟢 Nexus360 Ativo'}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Alerta de status */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Nexus360:</strong> {
            runtimeMode === 'nexus_ativo' 
              ? 'Estas configurações estão ATIVAS para este usuário. Alterações mudam imediatamente o que ele vê na Comunicação.'
              : runtimeMode === 'nexus_shadow'
              ? 'Nexus360 está em modo Shadow (comparação). As regras são calculadas mas não afetam o sistema.'
              : 'Sistema Legacy ativo. Configure e teste Nexus360 antes de ativar na alternância acima.'
          }
        </AlertDescription>
      </Alert>

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

              {/* Seção existente de ações granulares */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold">Ações Granulares (Operações)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: 'podeVerTodasConversas', label: 'Ver Todas as Conversas', icon: Eye },
                    { key: 'podeEnviarMensagens', label: 'Enviar Mensagens', icon: Shield },
                    { key: 'podeEnviarMidias', label: 'Enviar Mídias', icon: Shield },
                    { key: 'podeEnviarAudios', label: 'Enviar Áudios', icon: Shield },
                    { key: 'podeTransferirConversa', label: 'Transferir Conversas', icon: Shield },
                    { key: 'podeApagarMensagens', label: 'Apagar Mensagens', icon: Lock },
                    { key: 'podeGerenciarFilas', label: 'Gerenciar Filas', icon: Settings },
                    { key: 'podeAtribuirConversas', label: 'Atribuir Conversas', icon: Users },
                    { key: 'podeVerDetalhesContato', label: 'Ver Detalhes Contato', icon: Eye },
                    { key: 'podeEditarContato', label: 'Editar Contato', icon: Settings },
                    { key: 'podeBloquearContato', label: 'Bloquear Contato', icon: Lock },
                    { key: 'podeDeletarContato', label: 'Deletar Contato', icon: Lock },
                    { key: 'podeCriarPlaybooks', label: 'Criar Playbooks', icon: Settings },
                    { key: 'podeEditarPlaybooks', label: 'Editar Playbooks', icon: Settings },
                    { key: 'podeGerenciarConexoes', label: 'Gerenciar Conexões', icon: Settings },
                    { key: 'podeVerRelatorios', label: 'Ver Relatórios', icon: Eye },
                    { key: 'podeExportarDados', label: 'Exportar Dados', icon: Shield },
                    { key: 'podeGerenciarPermissoes', label: 'Gerenciar Permissões', icon: Lock },
                    { key: 'podeVerDiagnosticos', label: 'Ver Diagnósticos', icon: Settings }
                  ].map(({ key, label, icon: Icon }) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{label}</span>
                      </div>
                      <Switch
                        checked={permissoesAcoes[key] ?? (previewPermissoes?.[key] ?? true)}
                        onCheckedChange={(checked) => setPermissoesAcoes(prev => ({
                          ...prev,
                          [key]: checked
                        }))}
                      />
                    </div>
                  ))}
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