import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Zap, Bot } from 'lucide-react';
import { toast } from 'sonner';

import CatalogoSkills from '@/components/super-agente/CatalogoSkills';
import TerminalExecucao from '@/components/super-agente/TerminalExecucao';
import MetricasSuperAgente from '@/components/super-agente/MetricasSuperAgente';

export default function SuperAgente({ usuario }) {
  const [comando, setComando] = useState('');
  const [modoExecucao, setModoExecucao] = useState('copilot');
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(null);
  const queryClient = useQueryClient();

  const { data: skills = [], isLoading: loadingSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const lista = await base44.entities.SkillRegistry.filter({ ativa: true }, '-created_date', 100);
      return lista;
    }
  });

  const { data: execucoes = [], isLoading: loadingExecucoes } = useQuery({
    queryKey: ['skill-execucoes'],
    queryFn: async () => {
      const lista = await base44.entities.SkillExecution.list('-created_date', 50);
      return lista;
    }
  });

  const enviarComando = async () => {
    if (!comando.trim()) return;

    // Adicionar mensagem do usuário ao histórico
    const mensagemUser = {
      tipo: 'user',
      conteudo: comando,
      timestamp: new Date()
    };
    setHistorico(prev => [...prev, mensagemUser]);

    const comandoAtual = comando;
    setComando('');
    setLoading(true);
    setAguardandoConfirmacao(null);

    try {
      const resposta = await base44.functions.invoke('superAgente', {
        comando_texto: comandoAtual,
        modo: modoExecucao
      });

      const res = resposta.data || resposta;

      // Adicionar resposta do agente ao histórico
      const mensagemAgent = {
        tipo: 'agent',
        conteudo: res.message || JSON.stringify(res, null, 2),
        timestamp: new Date(),
        sucesso: res.success,
        skill_executada: res.skill_executada,
        duracao_ms: res.duracao_ms,
        requer_confirmacao: res.requer_confirmacao
      };
      setHistorico(prev => [...prev, mensagemAgent]);

      // Se requer confirmação
      if (res.requer_confirmacao) {
        setAguardandoConfirmacao({
          skill: res.skill,
          plano: res.plano_execucao,
          frase_confirmacao: res.frase_confirmacao,
          nivel_risco: res.nivel_risco,
          comando_original: comandoAtual
        });
        toast.warning('Confirmação necessária');
      } else if (res.success) {
        toast.success('Executado com sucesso');
      } else {
        toast.error('Erro na execução');
      }

      queryClient.invalidateQueries({ queryKey: ['skill-execucoes'] });
      queryClient.invalidateQueries({ queryKey: ['skills'] });

    } catch (error) {
      console.error('Erro ao executar:', error);
      toast.error('Erro: ' + error.message);
      
      setHistorico(prev => [...prev, {
        tipo: 'agent',
        conteudo: `❌ Erro: ${error.message}`,
        timestamp: new Date(),
        sucesso: false
      }]);
    } finally {
      setLoading(false);
    }
  };

  const confirmarExecucao = async (textoConfirmacao) => {
    if (!aguardandoConfirmacao) return;

    setLoading(true);

    try {
      const resposta = await base44.functions.invoke('superAgente', {
        comando_texto: aguardandoConfirmacao.comando_original,
        modo: modoExecucao,
        confirmacao: textoConfirmacao
      });

      const res = resposta.data || resposta;

      setHistorico(prev => [...prev, {
        tipo: 'agent',
        conteudo: res.message || JSON.stringify(res, null, 2),
        timestamp: new Date(),
        sucesso: res.success,
        skill_executada: res.skill_executada,
        duracao_ms: res.duracao_ms
      }]);

      if (res.success) {
        toast.success('Ação confirmada e executada');
        setAguardandoConfirmacao(null);
      } else {
        toast.error('Confirmação inválida');
      }

      queryClient.invalidateQueries({ queryKey: ['skill-execucoes'] });

    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const executarSkillDireta = (skill) => {
    if (skill.exemplos_uso && skill.exemplos_uso.length > 0) {
      setComando(skill.exemplos_uso[0].comando);
    } else {
      setComando(`executar ${skill.skill_name}`);
    }
  };

  const toggleSkillAtiva = async (skill) => {
    if (usuario?.role !== 'admin') {
      toast.error('Apenas admin pode ativar/desativar skills');
      return;
    }

    try {
      await base44.entities.SkillRegistry.update(skill.id, {
        ativa: !skill.ativa
      });
      toast.success(`Skill ${skill.ativa ? 'desativada' : 'ativada'}`);
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    } catch (error) {
      toast.error('Erro ao atualizar skill');
    }
  };

  // Calcular KPIs da URA
  const kpisURA = useMemo(() => {
    const execsURA = execucoes.filter(e => e.skill_name === 'pre_atendimento');
    if (execsURA.length === 0) return null;

    const metricas = execsURA.reduce((acc, exec) => {
      acc.total++;
      if (exec.metricas?.fast_track_usado) acc.fast_track++;
      if (exec.metricas?.timeout_ocorreu) acc.abandonos++;
      if (exec.metricas?.menu_mostrado) acc.menu++;
      if (exec.metricas?.sticky_ativado) acc.sticky++;
      acc.tempo_total += exec.duration_ms || 0;
      return acc;
    }, { total: 0, fast_track: 0, abandonos: 0, menu: 0, sticky: 0, tempo_total: 0 });

    return {
      total: metricas.total,
      taxa_fast_track: (metricas.fast_track / metricas.total * 100).toFixed(1),
      taxa_abandono: (metricas.abandonos / metricas.total * 100).toFixed(1),
      taxa_menu: (metricas.menu / metricas.total * 100).toFixed(1),
      taxa_sticky: (metricas.sticky / metricas.total * 100).toFixed(1),
      tempo_medio_ms: Math.round(metricas.tempo_total / metricas.total)
    };
  }, [execucoes]);

  // Sugestões rápidas baseadas nas skills
  const sugestoesRapidas = useMemo(() => {
    return skills
      .filter(s => s.ativa && s.exemplos_uso && s.exemplos_uso.length > 0)
      .slice(0, 4)
      .map(s => s.exemplos_uso[0].comando);
  }, [skills]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-purple-50/20 to-indigo-50/20">
      {/* Header Fixo */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Super Agente Nexus360
              </h1>
              <p className="text-xs text-slate-600">
                Orquestrador universal de skills com IA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-green-100 text-green-800 px-3 py-1">
              <Zap className="w-3 h-3 mr-1" />
              ONLINE
            </Badge>
            <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1">
              {skills.filter(s => s.ativa).length} Skills Ativas
            </Badge>
          </div>
        </div>
      </div>

      {/* 3 Painéis Simultâneos */}
      <div className="flex-1 flex gap-4 p-4 max-w-[1800px] mx-auto w-full min-h-0">
        {/* PAINEL 1 — Catálogo (30%) */}
        <div className="w-[30%] min-w-0">
          <CatalogoSkills 
            skills={skills}
            onExecutar={executarSkillDireta}
            onToggle={toggleSkillAtiva}
            usuario={usuario}
          />
        </div>

        {/* PAINEL 2 — Terminal (40%) */}
        <div className="flex-1 min-w-0">
          <TerminalExecucao
            historico={historico}
            loading={loading}
            aguardandoConfirmacao={aguardandoConfirmacao}
            comando={comando}
            setComando={setComando}
            onEnviar={enviarComando}
            onConfirmar={confirmarExecucao}
            sugestoesRapidas={sugestoesRapidas}
          />
        </div>

        {/* PAINEL 3 — Métricas (30%) */}
        <div className="w-[30%] min-w-0">
          <MetricasSuperAgente
            execucoes={execucoes}
            kpisURA={kpisURA}
          />
        </div>
      </div>
    </div>
  );
}