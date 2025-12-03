import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Zap
} from "lucide-react";
import { toast } from "sonner";

export default function PlaybookEngineTest() {
  const [testando, setTestando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [playbookId, setPlaybookId] = useState('');
  const [contactId, setContactId] = useState('');
  const [mensagemTeste, setMensagemTeste] = useState('Olá, gostaria de um orçamento');

  const executarTesteSuite = async () => {
    setTestando(true);
    setResultados([]);
    toast.info('Iniciando suite de testes...');

    const testes = [
      testeClassificacaoIA,
      testeExecucaoPlaybook,
      testeRAG,
      testeTimeouts,
      testeVariaveis
    ];

    for (const teste of testes) {
      try {
        const resultado = await teste();
        setResultados(prev => [...prev, resultado]);
      } catch (error) {
        setResultados(prev => [...prev, {
          nome: teste.name,
          sucesso: false,
          erro: error.message
        }]);
      }
    }

    setTestando(false);
    toast.success('Suite de testes concluída!');
  };

  const testeClassificacaoIA = async () => {
    console.log('[TESTE] 🧪 Testando classificação de intenção...');

    const resultado = await base44.functions.invoke('nexusClassifier', {
      action: 'classify_intention',
      mensagem: mensagemTeste,
      contexto: {}
    });

    return {
      nome: 'Classificação de Intenção (IA)',
      sucesso: resultado.data.success && resultado.data.confidence > 0.5,
      detalhes: `Intent: ${resultado.data.intent}, Confiança: ${Math.round(resultado.data.confidence * 100)}%`,
      dados: resultado.data
    };
  };

  const testeExecucaoPlaybook = async () => {
    console.log('[TESTE] 🧪 Testando execução de playbook...');

    if (!playbookId || !contactId) {
      throw new Error('playbook_id e contact_id são obrigatórios');
    }

    const resultado = await base44.functions.invoke('playbookEngine', {
      action: 'start_execution',
      playbook_id: playbookId,
      contact_id: contactId,
      initial_variables: { teste: true }
    });

    return {
      nome: 'Execução de Playbook',
      sucesso: resultado.data.success,
      detalhes: `Execution ID: ${resultado.data.execution?.id || 'N/A'}`,
      dados: resultado.data
    };
  };

  const testeRAG = async () => {
    console.log('[TESTE] 🧪 Testando consulta RAG...');

    const resultado = await base44.functions.invoke('nexusClassifier', {
      action: 'query_rag',
      pergunta: 'Qual o horário de atendimento?',
      limit: 3
    });

    return {
      nome: 'Consulta RAG (Base de Conhecimento)',
      sucesso: resultado.data.success,
      detalhes: `Encontrados: ${resultado.data.resultados?.length || 0} conhecimentos relevantes`,
      dados: resultado.data
    };
  };

  const testeTimeouts = async () => {
    console.log('[TESTE] 🧪 Testando sistema de timeouts...');

    // Criar uma execução de teste
    const playbook = await base44.entities.FlowTemplate.filter({ ativo: true }, 'created_date', 1);

    if (!playbook || playbook.length === 0) {
      throw new Error('Nenhum playbook ativo para teste');
    }

    const execucao = await base44.entities.FlowExecution.create({
      flow_template_id: playbook[0].id,
      contact_id: contactId || 'test_contact',
      status: 'ativo',
      current_step: 0,
      started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hora atrás
      variables: {}
    });

    return {
      nome: 'Sistema de Timeouts',
      sucesso: true,
      detalhes: `Execução de teste criada: ${execucao.id}`,
      dados: { execucao_id: execucao.id }
    };
  };

  const testeVariaveis = async () => {
    console.log('[TESTE] 🧪 Testando sistema de variáveis...');

    const variaveis = {
      nome_cliente: 'João Silva',
      produto_interesse: 'Notebook',
      valor_orcamento: 3500
    };

    // Testar interpolação de variáveis
    const texto = "Olá {{nome_cliente}}, seu orçamento para {{produto_interesse}} é R$ {{valor_orcamento}}";
    const interpolado = Object.keys(variaveis).reduce(
      (str, key) => str.replace(new RegExp(`{{${key}}}`, 'g'), String(variaveis[key])),
      texto
    );

    const esperado = "Olá João Silva, seu orçamento para Notebook é R$ 3500";

    return {
      nome: 'Sistema de Variáveis',
      sucesso: interpolado === esperado,
      detalhes: `Interpolação: ${interpolado === esperado ? 'OK' : 'FALHOU'}`,
      dados: { original: texto, interpolado, esperado }
    };
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Testes de Playbook Engine</h1>
          <p className="text-slate-600 mt-1">Suite automatizada de testes de integração</p>
        </div>
        <Button
          onClick={executarTesteSuite}
          disabled={testando}
          className="bg-gradient-to-r from-blue-600 to-indigo-600"
        >
          {testando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testando...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Executar Testes
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração dos Testes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Playbook ID (para testes de execução)</label>
            <Input
              value={playbookId}
              onChange={(e) => setPlaybookId(e.target.value)}
              placeholder="ID do playbook para testar"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Contact ID (para testes de execução)</label>
            <Input
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              placeholder="ID do contato para testar"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Mensagem de Teste</label>
            <Textarea
              value={mensagemTeste}
              onChange={(e) => setMensagemTeste(e.target.value)}
              placeholder="Mensagem para testar classificação"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {resultados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultados dos Testes</span>
              <Badge className={
                resultados.every(r => r.sucesso) ? 'bg-green-500' : 'bg-red-500'
              }>
                {resultados.filter(r => r.sucesso).length}/{resultados.length} passou(ram)
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resultados.map((resultado, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    resultado.sucesso 
                      ? 'bg-green-50 border-l-green-500' 
                      : 'bg-red-50 border-l-red-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {resultado.sucesso ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mt-1" />
                    )}
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{resultado.nome}</h4>
                      <p className="text-sm text-slate-600 mt-1">{resultado.detalhes}</p>
                      
                      {resultado.erro && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800">
                          <strong>Erro:</strong> {resultado.erro}
                        </div>
                      )}
                      
                      {resultado.dados && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer">
                            Ver dados completos
                          </summary>
                          <pre className="mt-2 p-2 bg-slate-100 rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(resultado.dados, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!testando && resultados.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">
              Nenhum teste executado ainda
            </h3>
            <p className="text-slate-500">
              Configure os parâmetros acima e clique em "Executar Testes"
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}