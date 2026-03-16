import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Target, Users, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PainelResumenMatinal({ usuario }) {
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    carregarResumoDia();
  }, [usuario?.id]);

  const carregarResumoDia = async () => {
    try {
      setCarregando(true);
      const hoje = new Date();
      const inicio_dia = new Date(hoje);
      inicio_dia.setHours(0, 0, 0, 0);

      // Buscar resumo do dia para o usuário logado
      const resumos = await base44.entities.ResumenExecutivoMatinal.filter(
        {
          atendente_id: usuario.id,
          data_geracao: { $gte: inicio_dia.toISOString() }
        },
        '-data_geracao',
        1
      );

      if (resumos.length > 0) {
        setResumo(resumos[0]);
        // Marcar como lido
        if (!resumos[0].data_leitura) {
          await base44.entities.ResumenExecutivoMatinal.update(resumos[0].id, {
            data_leitura: new Date().toISOString()
          });
        }
      }
      setErro(null);
    } catch (error) {
      console.error('[PAINEL_RESUMO] Erro ao carregar resumo:', error);
      setErro('Erro ao carregar resumo matinal');
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return (
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!resumo) {
    return (
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
        <CardContent className="p-6 text-center text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Resumo matinal será gerado às 08:00</p>
        </CardContent>
      </Card>
    );
  }

  // Parse alertas_24h
  let alertas = {};
  try {
    alertas = JSON.parse(resumo.alertas_24h || '{}');
  } catch (e) {
    alertas = {};
  }

  return (
    <div className="space-y-4">
      {/* Header com data */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900">📋 Seu Resumo Matinal</h2>
        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
          {format(new Date(resumo.data_geracao), 'HH:mm', { locale: ptBR })}
        </Badge>
      </div>

      {/* Card Principal com Resumo IA */}
      <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-indigo-200 shadow-lg">
        <CardHeader className="border-b border-indigo-200">
          <CardTitle className="flex items-center gap-2 text-indigo-900">
            <AlertCircle className="w-5 h-5" />
            Resumo Executivo IA
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="prose prose-sm prose-indigo max-w-none text-slate-700 whitespace-pre-wrap">
            {resumo.resumo_ia}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Metas e Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metas do Dia */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="border-b border-green-200">
            <CardTitle className="flex items-center gap-2 text-green-900 text-lg">
              <Target className="w-5 h-5" />
              Metas do Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-sm text-green-800 leading-relaxed">
              {resumo.metas_dia || 'Nenhuma meta crítica'}
            </p>
          </CardContent>
        </Card>

        {/* Top 3 Clientes */}
        <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
          <CardHeader className="border-b border-violet-200">
            <CardTitle className="flex items-center gap-2 text-violet-900 text-lg">
              <Users className="w-5 h-5" />
              Top 3 Prioritários
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-sm text-violet-800 leading-relaxed">
              {resumo.clientes_prioritarios || 'Nenhum cliente assinalado'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas 24h */}
      <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
        <CardHeader className="border-b border-orange-200">
          <CardTitle className="flex items-center gap-2 text-orange-900 text-lg">
            <AlertCircle className="w-5 h-5" />
            Atenção - Últimas 24h
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-white/60 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">
                {alertas.total_threads_ativos || 0}
              </div>
              <p className="text-xs text-orange-700 mt-1">Threads Ativas</p>
            </div>
            <div className="p-3 bg-white/60 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">
                {alertas.threads_sem_resposta || 0}
              </div>
              <p className="text-xs text-red-700 mt-1">Aguardando Resposta</p>
            </div>
            <div className="p-3 bg-white/60 rounded-lg border border-rose-200">
              <div className="text-2xl font-bold text-rose-600">
                {alertas.threads_urgentes || 0}
              </div>
              <p className="text-xs text-rose-700 mt-1">Urgentes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Feedback */}
      <Button 
        onClick={() => console.log('TODO: Modal feedback')}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
      >
        <CheckCircle2 className="w-4 h-4 mr-2" />
        Marcar como Revisado
      </Button>
    </div>
  );
}