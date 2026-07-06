import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supervisorAprendizadosSemanais } from '@/functions/supervisorAprendizadosSemanais';
import AprendizadoCard from '@/components/conhecimento/AprendizadoCard';
import { Button } from '@/components/ui/button';
import { Brain, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AprendizadosSemanais() {
  const [processando, setProcessando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ['aprendizados-pendentes'],
    queryFn: () => base44.entities.BaseConhecimento.filter({ aprovado: false, ativo: true }, '-created_date', 50),
    refetchOnWindowFocus: false
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['aprendizados-pendentes'] });

  const handleAprovar = async (item) => {
    setProcessando(true);
    const user = await base44.auth.me();
    await base44.entities.BaseConhecimento.update(item.id, {
      aprovado: true,
      aprovado_por: user.full_name || user.email,
      data_aprovacao: new Date().toISOString()
    });
    toast({ title: '✅ Aprovado', description: `"${item.titulo}" entrou no Segundo Cérebro.` });
    invalidar();
    setProcessando(false);
  };

  const handleDescartar = async (item) => {
    setProcessando(true);
    await base44.entities.BaseConhecimento.update(item.id, { ativo: false });
    toast({ title: 'Descartado', description: `"${item.titulo}" foi removido das sugestões.` });
    invalidar();
    setProcessando(false);
  };

  const handleGerarAgora = async () => {
    setGerando(true);
    try {
      const res = await supervisorAprendizadosSemanais({});
      toast({ title: '🧠 Supervisor executado', description: `${res.data?.total_criados || 0} novos aprendizados sugeridos.` });
      invalidar();
    } catch (e) {
      toast({ title: 'Erro ao executar supervisor', description: e.message, variant: 'destructive' });
    }
    setGerando(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-600" /> Aprendizados Semanais
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sugestões do Agente Supervisor para o Segundo Cérebro — valide com um clique.
          </p>
        </div>
        <Button onClick={handleGerarAgora} disabled={gerando}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Gerar agora
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      ) : pendentes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
          Nenhum aprendizado pendente de validação.
        </div>
      ) : (
        <div className="space-y-4">
          {pendentes.map(item => (
            <AprendizadoCard key={item.id} item={item}
              onAprovar={handleAprovar} onDescartar={handleDescartar} processando={processando} />
          ))}
        </div>
      )}
    </div>
  );
}