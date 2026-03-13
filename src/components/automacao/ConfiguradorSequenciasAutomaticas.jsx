import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit2, Play, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguradorSequenciasAutomaticas() {
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState({
    nome: '',
    descricao: '',
    tipo_gatilho: 'dias_sem_resposta',
    parametro_gatilho: { dias: 3 },
    passos: [{ numero: 1, atraso_dias: 0, tipo_mensagem: 'texto', conteudo: '' }],
    ativa: true
  });

  const queryClient = useQueryClient();

  const { data: sequencias = [], isLoading } = useQuery({
    queryKey: ['sequencias-automaticas'],
    queryFn: () => base44.entities.SequenciaAutomatica.list('-created_date', 50)
  });

  const criarMutation = useMutation({
    mutationFn: (dados) => base44.entities.SequenciaAutomatica.create(dados),
    onSuccess: () => {
      queryClient.invalidateQueries(['sequencias-automaticas']);
      resetFormulario();
      toast.success('✅ Sequência criada!');
    }
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, dados }) => base44.entities.SequenciaAutomatica.update(id, dados),
    onSuccess: () => {
      queryClient.invalidateQueries(['sequencias-automaticas']);
      resetFormulario();
      toast.success('✅ Sequência atualizada!');
    }
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.SequenciaAutomatica.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['sequencias-automaticas']);
      toast.success('✅ Sequência removida!');
    }
  });

  const resetFormulario = () => {
    setFormulario({
      nome: '',
      descricao: '',
      tipo_gatilho: 'dias_sem_resposta',
      parametro_gatilho: { dias: 3 },
      passos: [{ numero: 1, atraso_dias: 0, tipo_mensagem: 'texto', conteudo: '' }],
      ativa: true
    });
    setEditandoId(null);
  };

  const handleSalvar = () => {
    if (!formulario.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (editandoId) {
      atualizarMutation.mutate({ id: editandoId, dados: formulario });
    } else {
      criarMutation.mutate(formulario);
    }
  };

  const handleEditar = (seq) => {
    setFormulario(seq);
    setEditandoId(seq.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const adicionarPasso = () => {
    setFormulario(prev => ({
      ...prev,
      passos: [...prev.passos, {
        numero: (prev.passos?.length || 0) + 1,
        atraso_dias: 1,
        tipo_mensagem: 'texto',
        conteudo: ''
      }]
    }));
  };

  const removerPasso = (idx) => {
    setFormulario(prev => ({
      ...prev,
      passos: prev.passos.filter((_, i) => i !== idx)
    }));
  };

  const atualizarPasso = (idx, campo, valor) => {
    setFormulario(prev => ({
      ...prev,
      passos: prev.passos.map((p, i) => i === idx ? { ...p, [campo]: valor } : p)
    }));
  };

  const getTipoGatilhoLabel = (tipo) => {
    const labels = {
      dias_sem_resposta: '⏰ Dias sem resposta',
      baixa_intencao_compra: '📉 Baixa intenção',
      alto_risco_churn: '🚨 Risco de churn',
      novo_contato: '🆕 Novo contato'
    };
    return labels[tipo] || tipo;
  };

  if (isLoading) {
    return <div className="p-4 text-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Formulário */}
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <CardTitle>
              {editandoId ? '✏️ Editar Sequência' : '➕ Nova Sequência'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Nome e Descrição */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold block mb-2">Nome *</label>
                <Input
                  value={formulario.nome}
                  onChange={(e) => setFormulario(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Follow-up após 3 dias"
                />
              </div>
              <div>
                <label className="text-sm font-semibold block mb-2">Gatilho *</label>
                <select
                  value={formulario.tipo_gatilho}
                  onChange={(e) => setFormulario(prev => ({ ...prev, tipo_gatilho: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md">
                  <option value="dias_sem_resposta">⏰ Dias sem resposta</option>
                  <option value="baixa_intencao_compra">📉 Baixa intenção</option>
                  <option value="alto_risco_churn">🚨 Risco de churn</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-2">Descrição</label>
              <Textarea
                value={formulario.descricao}
                onChange={(e) => setFormulario(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva a sequência..."
                className="h-20"
              />
            </div>

            {/* Parâmetro do Gatilho */}
            <div className="bg-slate-100 p-4 rounded-lg">
              <label className="text-sm font-semibold block mb-2">
                {formulario.tipo_gatilho === 'dias_sem_resposta' && 'Dias sem resposta'}
                {formulario.tipo_gatilho === 'baixa_intencao_compra' && 'Score máximo de intenção'}
              </label>
              {formulario.tipo_gatilho === 'dias_sem_resposta' && (
                <Input
                  type="number"
                  min="1"
                  value={formulario.parametro_gatilho.dias}
                  onChange={(e) => setFormulario(prev => ({
                    ...prev,
                    parametro_gatilho: { dias: parseInt(e.target.value) }
                  }))}
                  className="w-32"
                />
              )}
            </div>

            {/* Passos */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">📧 Passos da Sequência</h3>
                <Button onClick={adicionarPasso} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Passo
                </Button>
              </div>

              <div className="space-y-4">
                {formulario.passos?.map((passo, idx) => (
                  <div key={idx} className="p-4 border rounded-lg bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">Passo {idx + 1}</span>
                      {formulario.passos.length > 1 && (
                        <Button
                          onClick={() => removerPasso(idx)}
                          size="sm"
                          variant="ghost"
                          className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 block mb-1">Atraso (dias)</label>
                        <Input
                          type="number"
                          min="0"
                          value={passo.atraso_dias}
                          onChange={(e) => atualizarPasso(idx, 'atraso_dias', parseInt(e.target.value))}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 block mb-1">Tipo</label>
                        <select
                          value={passo.tipo_mensagem}
                          onChange={(e) => atualizarPasso(idx, 'tipo_mensagem', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm">
                          <option value="texto">Texto</option>
                          <option value="template">Template</option>
                          <option value="sugestao_ia">IA Personalizada</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-600 block mb-1">Mensagem</label>
                      <Textarea
                        value={passo.conteudo}
                        onChange={(e) => atualizarPasso(idx, 'conteudo', e.target.value)}
                        placeholder="Digite a mensagem..."
                        className="h-16 text-sm"
                      />
                    </div>

                    {passo.tipo_mensagem === 'sugestao_ia' && (
                      <Badge className="bg-purple-100 text-purple-800">
                        💡 Será personalizada com análise de intenção
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 justify-end border-t pt-4">
              <Button onClick={resetFormulario} variant="outline">
                Cancelar
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={criarMutation.isPending || atualizarMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700">
                {editandoId ? 'Atualizar' : 'Criar'} Sequência
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Sequências */}
        <div>
          <h2 className="text-2xl font-bold mb-4">📋 Sequências Ativas</h2>
          <div className="grid gap-4">
            {sequencias.map(seq => (
              <Card key={seq.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg">{seq.nome}</h3>
                        <Badge className={seq.ativa ? 'bg-green-600' : 'bg-gray-600'}>
                          {seq.ativa ? '✅ Ativa' : '⭕ Inativa'}
                        </Badge>
                        <Badge variant="outline">
                          {getTipoGatilhoLabel(seq.tipo_gatilho)}
                        </Badge>
                      </div>

                      <p className="text-sm text-slate-600 mb-3">{seq.descricao}</p>

                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="bg-blue-50 p-2 rounded">
                          <span className="text-slate-600">Passos</span>
                          <p className="font-bold text-lg">{seq.passos?.length || 0}</p>
                        </div>
                        <div className="bg-green-50 p-2 rounded">
                          <span className="text-slate-600">Disparos</span>
                          <p className="font-bold text-lg">{seq.metricas?.total_disparos || 0}</p>
                        </div>
                        <div className="bg-purple-50 p-2 rounded">
                          <span className="text-slate-600">Engajamentos</span>
                          <p className="font-bold text-lg">{seq.metricas?.total_engajamentos || 0}</p>
                        </div>
                        <div className="bg-orange-50 p-2 rounded">
                          <span className="text-slate-600">Taxa</span>
                          <p className="font-bold text-lg">
                            {Math.round(seq.metricas?.taxa_engajamento || 0)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => handleEditar(seq)}
                        size="sm"
                        variant="outline">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => deletarMutation.mutate(seq.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}