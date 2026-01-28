import React, { useState, useRef, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Clipboard, Bot, User, Phone, Mail, DollarSign, Calendar, MessageSquare, Info, Sparkles, TrendingUp, AlertTriangle, Target } from 'lucide-react';

export default function PainelContexto({ tarefa, dados, onCompletarTarefa, loading }) {
  const [observacoes, setObservacoes] = useState('');
  const [resultado, setResultado] = useState('sucesso');

  const handleCompletar = () => {
    if (!observacoes.trim()) {
      alert("Por favor, adicione observações sobre o resultado da interação");
      return;
    }
    onCompletarTarefa(observacoes, resultado);
    setObservacoes('');
    setResultado('sucesso');
  };

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center shadow-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Carregando contexto inteligente...</p>
        </div>
      </Card>
    );
  }

  if (!tarefa || !dados) {
    return (
      <Card className="h-full flex flex-col items-center justify-center text-center text-slate-500 shadow-xl bg-gradient-to-br from-white to-slate-50">
        <div className="p-8">
          <Clipboard className="w-16 h-16 mb-4 opacity-30 mx-auto" />
          <h3 className="font-semibold text-xl text-slate-700 mb-2">Selecione uma Ação</h3>
          <p className="text-sm text-slate-500">O contexto completo e as sugestões da IA aparecerão aqui</p>
        </div>
      </Card>
    );
  }

  const contextoIA = tarefa.contexto_ia || {};

  return (
    <Card className="h-full flex flex-col shadow-xl border-slate-200 overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white">
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-600" />
          <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Contexto Cognitivo
          </span>
          {contextoIA.confianca_ia && (
            <Badge className="ml-auto bg-purple-100 text-purple-700 border-purple-200">
              🤖 Confiança: {contextoIA.confianca_ia}%
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto space-y-6 pt-6">
        {/* Detalhes da Tarefa */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
          <h3 className="font-bold text-lg text-indigo-900 mb-2">{tarefa.titulo}</h3>
          {tarefa.descricao && <p className="text-slate-700 text-sm mb-3">{tarefa.descricao}</p>}
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-indigo-100 text-indigo-800 capitalize">{tarefa.tipo_tarefa?.replace(/_/g, ' ')}</Badge>
            <Badge className={`${
              tarefa.prioridade === 'critica' ? 'bg-red-100 text-red-800' :
              tarefa.prioridade === 'alta' ? 'bg-amber-100 text-amber-800' :
              'bg-blue-100 text-blue-800'
            } capitalize`}>{tarefa.prioridade}</Badge>
          </div>
        </div>

        {/* Sugestões da IA - DESTAQUE PRINCIPAL */}
        {contextoIA.motivo_criacao && (
          <div className="relative p-5 bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-blue-500/10 rounded-xl border-2 border-purple-300/50 shadow-lg">
            <div className="absolute top-3 right-3">
              <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
            </div>
            
            <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2 text-lg">
              <Bot className="w-5 h-5"/> Análise da Inteligência Artificial
            </h4>
            
            <p className="text-sm text-slate-800 mb-4 leading-relaxed bg-white/60 p-3 rounded-lg">
              {contextoIA.motivo_criacao}
            </p>
            
            {/* Métricas de Score */}
            {tarefa.metricas && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white/80 rounded-lg p-2 text-center">
                  <div className="text-xs text-slate-600">Urgência</div>
                  <div className="text-lg font-bold text-red-600">{tarefa.metricas.score_urgencia || 0}</div>
                </div>
                <div className="bg-white/80 rounded-lg p-2 text-center">
                  <div className="text-xs text-slate-600">Potencial</div>
                  <div className="text-lg font-bold text-green-600">{tarefa.metricas.score_potencial || 0}</div>
                </div>
                <div className="bg-white/80 rounded-lg p-2 text-center">
                  <div className="text-xs text-slate-600">Conversão</div>
                  <div className="text-lg font-bold text-blue-600">{tarefa.metricas.probabilidade_fechamento || 0}%</div>
                </div>
              </div>
            )}
            
            {/* Alertas Especiais */}
            {contextoIA.risco_churn && contextoIA.risco_churn !== 'baixo' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-red-800 font-semibold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Alerta de Risco: {contextoIA.risco_churn.toUpperCase()}
                </div>
                <p className="text-xs text-red-700">Cliente em risco de churn. Ação imediata recomendada.</p>
              </div>
            )}
            
            {/* Sugestões de Abordagem */}
            {contextoIA.sugestoes_abordagem && contextoIA.sugestoes_abordagem.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-semibold text-indigo-900 text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" /> Táticas Recomendadas:
                </h5>
                <ul className="space-y-2">
                  {contextoIA.sugestoes_abordagem.map((sugestao, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2 bg-white/70 p-2 rounded-lg">
                      <span className="text-indigo-600 font-bold">{i + 1}.</span>
                      <span className="flex-1">{sugestao}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Canal e Horário Preferido */}
            {(contextoIA.canal_preferido || contextoIA.melhor_horario) && (
              <div className="mt-4 flex gap-2">
                {contextoIA.canal_preferido && (
                  <Badge className="bg-green-100 text-green-800">
                    📱 Canal: {contextoIA.canal_preferido}
                  </Badge>
                )}
                {contextoIA.melhor_horario && (
                  <Badge className="bg-blue-100 text-blue-800">
                    🕐 Horário: {contextoIA.melhor_horario}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Oportunidades de Upsell */}
            {contextoIA.oportunidades && contextoIA.oportunidades.length > 0 && (
              <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <h5 className="font-semibold text-emerald-900 text-sm mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Oportunidades Identificadas:
                </h5>
                <ul className="space-y-1">
                  {contextoIA.oportunidades.map((opp, i) => (
                    <li key={i} className="text-xs text-emerald-800">
                      • <strong>{opp.produto}</strong>: {opp.motivo} (Confiança: {opp.confianca}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Informações do Cliente */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <User className="w-4 h-4"/> Informações do Cliente
            </h4>
            <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 bg-white p-2 rounded">
                  <User className="w-3.5 h-3.5 text-slate-500"/> 
                  <strong className="text-slate-700">{dados.cliente.razao_social}</strong>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded">
                  <Phone className="w-3.5 h-3.5 text-slate-500"/> {dados.cliente.telefone}
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded">
                  <Mail className="w-3.5 h-3.5 text-slate-500"/> {dados.cliente.email}
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded">
                  <Badge variant="secondary">{dados.cliente.status}</Badge>
                  <Badge variant="outline">{dados.cliente.classificacao}</Badge>
                </div>
            </div>
        </div>

        {/* Histórico Relevante */}
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4"/> Histórico Relevante
          </h4>
          
          {dados.orcamentos && dados.orcamentos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Orçamentos Recentes:</p>
              {dados.orcamentos.slice(0, 3).map(orc => (
                <div key={orc.id} className="text-sm p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-amber-600"/> 
                    <strong className="text-amber-900">{orc.numero_orcamento}</strong>
                    <Badge className="ml-auto bg-amber-100 text-amber-800">{orc.status}</Badge>
                  </div>
                  <p className="text-xs text-amber-700">
                    R$ {orc.valor_total?.toLocaleString('pt-BR')} • {new Date(orc.data_orcamento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
          
          {dados.interacoes && dados.interacoes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Interações Recentes:</p>
              {dados.interacoes.slice(0, 3).map(int => (
                <div key={int.id} className="text-sm p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-blue-600"/> 
                    <strong className="text-blue-900 capitalize">{int.tipo_interacao}</strong>
                    <Badge className="ml-auto bg-blue-100 text-blue-800">{int.resultado}</Badge>
                  </div>
                  <p className="text-xs text-blue-700">
                    {new Date(int.data_interacao).toLocaleDateString('pt-BR')} • {int.observacoes?.substring(0, 60)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </CardContent>
      
      {/* Footer - Conclusão */}
      <div className="p-4 border-t bg-gradient-to-r from-slate-50 to-white">
          <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600"/> Registrar Execução
          </h4>
          
          <div className="space-y-3">
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venda_fechada">🎉 Venda Fechada</SelectItem>
                <SelectItem value="orcamento_solicitado">📋 Orçamento Solicitado</SelectItem>
                <SelectItem value="interessado">👍 Cliente Interessado</SelectItem>
                <SelectItem value="sucesso">✅ Sucesso</SelectItem>
                <SelectItem value="reagendado">📅 Reagendado</SelectItem>
                <SelectItem value="sem_contato">📵 Sem Contato</SelectItem>
                <SelectItem value="nao_interessado">👎 Não Interessado</SelectItem>
              </SelectContent>
            </Select>
            
            <Textarea 
              placeholder="Descreva detalhadamente o resultado da interação, objeções levantadas, próximos passos acordados, etc. Essas informações serão processadas pela IA para melhorar futuras recomendações."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-[100px] bg-white"
            />
            
            <Button 
              onClick={handleCompletar} 
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg"
            >
              <Check className="w-4 h-4 mr-2"/>
              Completar Ação e Aplicar Aprendizado
            </Button>
          </div>
      </div>
    </Card>
  );
}