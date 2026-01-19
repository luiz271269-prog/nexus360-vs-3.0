import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Workflow, Plus, Copy, Trash, Edit, TrendingUp, Clock, 
  CheckCircle, XCircle, Zap, AlertCircle, Settings 
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * ═══════════════════════════════════════════════════════════════
 * PLAYBOOK MANAGER URA
 * ═══════════════════════════════════════════════════════════════
 * Gerencia playbooks de tipo_fluxo = "pre_atendimento"
 * Foco: URAs com config_global, estados[], regras_ativacao
 */

function formatarTempo(segundos) {
  if (!segundos) return '--';
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}m${secs}s`;
}

function PlaybookCardURA({ playbook, onEdit, onToggle, onDuplicate, onDelete }) {
  const metricas = playbook.metricas_playbook || {};
  const regras = playbook.regras_ativacao || {};
  
  return (
    <Card className="hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          
          {/* NOME + BADGES */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-xl">{playbook.nome}</CardTitle>
              {playbook.is_pre_atendimento_padrao && (
                <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                  Padrão
                </Badge>
              )}
              {playbook.ativo ? (
                <Badge className="bg-green-100 text-green-800">Ativo</Badge>
              ) : (
                <Badge variant="outline">Inativo</Badge>
              )}
            </div>
            <CardDescription>{playbook.descricao || 'Sem descrição'}</CardDescription>
          </div>
          
          {/* TOGGLE ATIVO */}
          <Switch 
            checked={playbook.ativo}
            onCheckedChange={() => onToggle(playbook.id)}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        
        {/* MÉTRICAS */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">
              {metricas.total_execucoes || 0}
            </div>
            <div className="text-xs text-slate-600">Execuções</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {metricas.taxa_conclusao_percentual?.toFixed(0) || 0}%
            </div>
            <div className="text-xs text-slate-600">Conclusão</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatarTempo(metricas.tempo_medio_conclusao_segundos)}
            </div>
            <div className="text-xs text-slate-600">Tempo Médio</div>
          </div>
        </div>
        
        {/* REGRAS DE ATIVAÇÃO (Preview) */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <Settings className="w-3 h-3" />
            Regras de Ativação
          </div>
          
          {/* Prioridade */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Prioridade:</Badge>
            <Badge variant="outline" className="text-xs font-bold">
              {regras.prioridade || 10}
            </Badge>
          </div>
          
          {/* Tipos Permitidos */}
          {regras.tipos_permitidos && regras.tipos_permitidos.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">Tipos:</Badge>
              {regras.tipos_permitidos.map(tipo => (
                <Badge key={tipo} className="bg-blue-100 text-blue-800 text-xs">
                  {tipo}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Tags Obrigatórias */}
          {regras.tags_obrigatorias && regras.tags_obrigatorias.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">Tags Obrigatórias:</Badge>
              {regras.tags_obrigatorias.map(tag => (
                <Badge key={tag} className="bg-green-100 text-green-800 text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Tags Bloqueadas */}
          {regras.tags_bloqueadas && regras.tags_bloqueadas.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">Tags Bloqueadas:</Badge>
              {regras.tags_bloqueadas.map(tag => (
                <Badge key={tag} className="bg-red-100 text-red-800 text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Estados */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Estados:</Badge>
            <Badge variant="outline" className="text-xs">
              {playbook.estados?.length || 0} configurados
            </Badge>
          </div>
        </div>
        
      </CardContent>
      
      {/* AÇÕES */}
      <CardFooter className="flex gap-2 border-t pt-4">
        <Button size="sm" variant="default" onClick={() => onEdit(playbook)}>
          <Edit className="w-4 h-4 mr-1" /> Editar
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDuplicate(playbook)}>
          <Copy className="w-4 h-4 mr-1" /> Duplicar
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => onDelete(playbook)}
        >
          <Trash className="w-4 h-4 mr-1" /> Deletar
        </Button>
      </CardFooter>
      
    </Card>
  );
}

export default function PlaybookManagerURA() {
  const [deleteDialog, setDeleteDialog] = useState({ open: false, playbook: null });
  const queryClient = useQueryClient();
  
  // Buscar playbooks de pré-atendimento
  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ['playbooks-ura'],
    queryFn: async () => {
      const pbs = await base44.entities.FlowTemplate.filter({
        tipo_fluxo: 'pre_atendimento'
      });
      return pbs || [];
    },
    refetchInterval: 30000 // Atualizar a cada 30s
  });
  
  // Calcular métricas agregadas
  const metricasGerais = React.useMemo(() => {
    const ativos = playbooks.filter(p => p.ativo);
    const totalExecucoes = playbooks.reduce((sum, p) => sum + (p.metricas_playbook?.total_execucoes || 0), 0);
    const totalConcluidos = playbooks.reduce((sum, p) => sum + (p.metricas_playbook?.total_concluidos || 0), 0);
    const taxaMedia = totalExecucoes > 0 ? ((totalConcluidos / totalExecucoes) * 100).toFixed(0) : 0;
    
    const temposValidos = playbooks
      .map(p => p.metricas_playbook?.tempo_medio_conclusao_segundos)
      .filter(t => t > 0);
    const tempoMedio = temposValidos.length > 0 
      ? Math.floor(temposValidos.reduce((a, b) => a + b, 0) / temposValidos.length)
      : 0;
    
    return {
      ativos: ativos.length,
      total: playbooks.length,
      execucoes: totalExecucoes,
      taxa_conclusao: taxaMedia,
      tempo_medio: tempoMedio
    };
  }, [playbooks]);
  
  const handleToggle = async (playbookId) => {
    try {
      const playbook = playbooks.find(p => p.id === playbookId);
      await base44.entities.FlowTemplate.update(playbookId, {
        ativo: !playbook.ativo
      });
      queryClient.invalidateQueries(['playbooks-ura']);
      toast.success(playbook.ativo ? 'URA desativada' : 'URA ativada');
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };
  
  const handleDuplicate = async (playbook) => {
    try {
      const copia = {
        ...playbook,
        id: undefined,
        nome: `${playbook.nome} (Cópia)`,
        ativo: false,
        is_pre_atendimento_padrao: false,
        metricas_playbook: {
          total_execucoes: 0,
          total_concluidos: 0,
          total_abandonados: 0,
          tempo_medio_conclusao_segundos: 0,
          taxa_conclusao_percentual: 0
        }
      };
      
      await base44.entities.FlowTemplate.create(copia);
      queryClient.invalidateQueries(['playbooks-ura']);
      toast.success('Playbook duplicado com sucesso');
    } catch (error) {
      toast.error('Erro ao duplicar playbook');
    }
  };
  
  const handleDelete = async () => {
    try {
      if (!deleteDialog.playbook) return;
      
      await base44.entities.FlowTemplate.delete(deleteDialog.playbook.id);
      queryClient.invalidateQueries(['playbooks-ura']);
      toast.success('Playbook deletado');
      setDeleteDialog({ open: false, playbook: null });
    } catch (error) {
      toast.error('Erro ao deletar playbook');
    }
  };
  
  const handleEdit = (playbook) => {
    toast.info('Editor visual será implementado em breve');
    // TODO: Abrir EditorPlaybookURA
  };
  
  const criarNovaURA = async () => {
    try {
      const novaURA = {
        nome: "Nova URA",
        descricao: "Descrição da nova URA",
        tipo_fluxo: "pre_atendimento",
        categoria: "geral",
        ativo: false,
        regras_ativacao: {
          prioridade: 10,
          escopo_contato: "externo",
          tipos_permitidos: [],
          tipos_bloqueados: ["interno"],
          tags_obrigatorias: [],
          tags_bloqueadas: ["nao_ura", "vip"],
          conexoes_permitidas: [],
          setores_permitidos: ["vendas", "assistencia", "financeiro"],
          bypass_fora_horario: false
        },
        config_global: {
          ttl_completed_horas: 24,
          gap_novo_ciclo_horas: 12,
          usar_ia_no_init: true,
          limiar_confianca_ia: 70,
          timeout_padrao_minutos: 10,
          usar_sticky: true,
          usar_guardian: true,
          mensagem_timeout: "⏰ Tempo esgotado. Digite OI para recomeçar.",
          mensagem_cancelamento: "❌ Atendimento cancelado."
        },
        estados: [
          {
            nome_interno: "INIT",
            titulo_admin: "Início",
            descricao: "Primeiro contato",
            mensagem_template: "Olá, {nome}! {saudacao}. Como posso ajudar?",
            tipo_entrada: "buttons",
            usar_ia_fast_track: true,
            usar_sticky_memory: true,
            usar_guardian_mode: true,
            timeout_minutos: 10,
            opcoes: [
              { id: "1", label: "💼 Vendas", valor: "vendas" },
              { id: "2", label: "🔧 Suporte", valor: "assistencia" },
              { id: "3", label: "💰 Financeiro", valor: "financeiro" }
            ],
            transicoes: [
              {
                condicao: { tipo: "button_match", valor: "1" },
                acoes_pre_transicao: [
                  { tipo: "setar_sector_id", parametros: { valor: "vendas" } }
                ],
                proximo_estado: "COMPLETED"
              }
            ]
          },
          {
            nome_interno: "COMPLETED",
            titulo_admin: "Concluído",
            mensagem_template: "✅ Transferido! Aguarde um atendente.",
            tipo_entrada: "system"
          }
        ],
        metricas_playbook: {
          total_execucoes: 0,
          total_concluidos: 0,
          total_abandonados: 0,
          tempo_medio_conclusao_segundos: 0,
          taxa_conclusao_percentual: 0
        }
      };
      
      const criado = await base44.entities.FlowTemplate.create(novaURA);
      queryClient.invalidateQueries(['playbooks-ura']);
      toast.success('Nova URA criada (inativa)');
      handleEdit(criado);
    } catch (error) {
      console.error('Erro ao criar URA:', error);
      toast.error('Erro ao criar nova URA');
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Workflow className="w-12 h-12 text-orange-500 animate-pulse mx-auto mb-3" />
          <p className="text-slate-600">Carregando URAs...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      
      {/* HEADER COM MÉTRICAS GLOBAIS */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-900">URAs Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">
              {metricasGerais.ativos}
              <span className="text-lg text-blue-500">/{metricasGerais.total}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-900">Taxa Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">
              {metricasGerais.taxa_conclusao}%
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-purple-900">Tempo Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">
              {formatarTempo(metricasGerais.tempo_medio)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-900">Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700">
              {metricasGerais.execucoes}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* LISTA DE PLAYBOOKS */}
      {playbooks.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-600 mb-2">Nenhuma URA cadastrada</p>
            <p className="text-sm text-slate-500 mb-4">Crie sua primeira URA de Pré-Atendimento</p>
            <Button onClick={criarNovaURA}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira URA
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {playbooks.map(pb => (
            <PlaybookCardURA 
              key={pb.id}
              playbook={pb}
              onEdit={handleEdit}
              onToggle={handleToggle}
              onDuplicate={handleDuplicate}
              onDelete={(pb) => setDeleteDialog({ open: true, playbook: pb })}
            />
          ))}
        </div>
      )}
      
      {/* BOTÃO CRIAR NOVA URA */}
      {playbooks.length > 0 && (
        <Button 
          onClick={criarNovaURA}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova URA Pré-Atendimento
        </Button>
      )}
      
      {/* DIALOG DE CONFIRMAÇÃO DELETE */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, playbook: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar URA?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar "{deleteDialog.playbook?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
    </div>
  );
}