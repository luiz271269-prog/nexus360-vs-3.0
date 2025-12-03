import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MessageSquare, 
  Send, 
  CheckCircle, 
  XCircle, 
  Loader2,
  User,
  RefreshCw,
  Play,
  Trash2
} from "lucide-react";
import { toast } from "sonner";

export default function TestesPreAtendimento() {
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState([]);
  const [atendentes, setAtendentes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [integracoes, setIntegracoes] = useState([]);
  
  // Estado do simulador
  const [threadSelecionada, setThreadSelecionada] = useState(null);
  const [mensagemSimulada, setMensagemSimulada] = useState("");
  const [historico, setHistorico] = useState([]);
  const [simulacaoAtiva, setSimulacaoAtiva] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [threadsData, atendentesData, contactsData, integracoesData] = await Promise.all([
        base44.entities.MessageThread.list('-created_date', 10),
        base44.entities.User.filter({ is_whatsapp_attendant: true }),
        base44.entities.Contact.list('-created_date', 20),
        base44.entities.WhatsAppIntegration.list()
      ]);

      setThreads(threadsData);
      setAtendentes(atendentesData);
      setContacts(contactsData);
      setIntegracoes(integracoesData);

      toast.success("Dados carregados com sucesso!");
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do sistema");
    }
    setLoading(false);
  };

  const criarThreadTeste = async () => {
    setLoading(true);
    try {
      // Criar contato de teste
      const contatoTeste = await base44.entities.Contact.create({
        nome: `Teste ${Date.now()}`,
        telefone: `+55${Math.floor(Math.random() * 10000000000)}`,
        tipo_contato: 'lead'
      });

      // Criar thread de teste
      const threadTeste = await base44.entities.MessageThread.create({
        contact_id: contatoTeste.id,
        whatsapp_integration_id: integracoes[0]?.id || null,
        last_message_content: "Thread de teste criada",
        last_message_at: new Date().toISOString(),
        last_message_sender: "contact",
        status: "aberta",
        pre_atendimento_ativo: false,
        pre_atendimento_etapa: null
      });

      toast.success(`✅ Thread de teste criada: ${threadTeste.id}`);
      setThreadSelecionada(threadTeste);
      setHistorico([{
        timestamp: new Date().toISOString(),
        tipo: 'sistema',
        mensagem: 'Thread de teste criada'
      }]);
      
      await carregarDados();
    } catch (error) {
      console.error("Erro ao criar thread de teste:", error);
      toast.error("Erro ao criar thread de teste");
    }
    setLoading(false);
  };

  const simularMensagemCliente = async () => {
    if (!threadSelecionada || !mensagemSimulada.trim()) {
      toast.error("Selecione uma thread e digite uma mensagem");
      return;
    }

    setLoading(true);
    setSimulacaoAtiva(true);

    try {
      // Buscar contato da thread
      const contato = contacts.find(c => c.id === threadSelecionada.contact_id);
      
      if (!contato) {
        throw new Error("Contato não encontrado");
      }

      // Adicionar ao histórico
      setHistorico(prev => [...prev, {
        timestamp: new Date().toISOString(),
        tipo: 'cliente',
        mensagem: mensagemSimulada
      }]);

      console.log('🧪 [TESTE] Enviando para preAtendimentoHandler:', {
        thread_id: threadSelecionada.id,
        contact_id: contato.id,
        mensagem_cliente: mensagemSimulada,
        integracao_id: threadSelecionada.whatsapp_integration_id
      });

      // Chamar a função de pré-atendimento
      const resultado = await base44.functions.invoke('preAtendimentoHandler', {
        thread_id: threadSelecionada.id,
        contact_id: contato.id,
        mensagem_cliente: mensagemSimulada,
        integracao_id: threadSelecionada.whatsapp_integration_id
      });

      console.log('🧪 [TESTE] Resultado do preAtendimentoHandler:', resultado.data);

      // Adicionar resultado ao histórico
      setHistorico(prev => [...prev, {
        timestamp: new Date().toISOString(),
        tipo: 'resultado',
        mensagem: JSON.stringify(resultado.data, null, 2)
      }]);

      if (resultado.data.success) {
        toast.success("✅ Pré-atendimento processado com sucesso!");
        
        // Recarregar thread atualizada
        const threadAtualizada = await base44.entities.MessageThread.get(threadSelecionada.id);
        setThreadSelecionada(threadAtualizada);

        // Adicionar resposta do sistema ao histórico
        if (resultado.data.mensagem_enviada) {
          setHistorico(prev => [...prev, {
            timestamp: new Date().toISOString(),
            tipo: 'sistema',
            mensagem: '✅ Mensagem automática enviada ao cliente'
          }]);
        }

        if (resultado.data.atribuido) {
          setHistorico(prev => [...prev, {
            timestamp: new Date().toISOString(),
            tipo: 'sistema',
            mensagem: `✅ Thread atribuída a: ${threadAtualizada.assigned_user_name}`
          }]);
        }
      } else {
        toast.error("❌ Erro no processamento: " + resultado.data.error);
      }

      setMensagemSimulada("");
    } catch (error) {
      console.error("Erro ao simular mensagem:", error);
      toast.error("Erro ao simular mensagem: " + error.message);
      
      setHistorico(prev => [...prev, {
        timestamp: new Date().toISOString(),
        tipo: 'erro',
        mensagem: error.message
      }]);
    }

    setLoading(false);
    setSimulacaoAtiva(false);
  };

  const limparSimulacao = async () => {
    if (threadSelecionada) {
      try {
        // Resetar thread
        await base44.entities.MessageThread.update(threadSelecionada.id, {
          pre_atendimento_ativo: false,
          pre_atendimento_etapa: null,
          assigned_user_id: null,
          assigned_user_name: null,
          sector_id: null
        });

        // Resetar contadores de atendentes
        for (const atendente of atendentes) {
          if (atendente.current_conversations_count > 0) {
            await base44.entities.User.update(atendente.id, {
              current_conversations_count: 0
            });
          }
        }

        toast.success("✅ Simulação limpa!");
        setHistorico([]);
        setThreadSelecionada(null);
        await carregarDados();
      } catch (error) {
        console.error("Erro ao limpar simulação:", error);
        toast.error("Erro ao limpar simulação");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-white" />
                </div>
                Testes de Pré-atendimento
              </h1>
              <p className="text-slate-600 mt-2">
                Ambiente de testes isolado para validar o sistema de pré-atendimento
              </p>
            </div>
            <Button onClick={carregarDados} variant="outline" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Recarregar
            </Button>
          </div>
        </div>

        {/* Status dos Atendentes */}
        <Card className="mb-6 border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <User className="w-5 h-5" />
              Atendentes Disponíveis: {atendentes.filter(a => a.availability_status === 'online').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {atendentes.map(atendente => (
                <div key={atendente.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-semibold text-sm">{atendente.full_name}</p>
                    <p className="text-xs text-slate-600">
                      {atendente.attendant_sector} • {atendente.attendant_role}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      atendente.availability_status === 'online' ? 'bg-green-500' :
                      atendente.availability_status === 'ocupado' ? 'bg-yellow-500' :
                      'bg-slate-400'
                    }>
                      {atendente.availability_status}
                    </Badge>
                    <Badge variant="outline">
                      {atendente.current_conversations_count || 0}/{atendente.max_concurrent_conversations || 5}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {atendentes.length === 0 && (
              <Alert>
                <AlertDescription>
                  ⚠️ Nenhum atendente configurado. Configure usuários como atendentes na página de Usuários.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Painel de Controle */}
          <Card className="border-2 border-purple-200">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-purple-600" />
                Controle da Simulação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {/* Criar Thread de Teste */}
              <div>
                <Button 
                  onClick={criarThreadTeste}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Criar Nova Thread de Teste
                </Button>
              </div>

              {/* Selecionar Thread Existente */}
              <div>
                <label className="text-sm font-medium mb-2 block">Ou selecionar thread existente:</label>
                <select
                  value={threadSelecionada?.id || ''}
                  onChange={(e) => {
                    const thread = threads.find(t => t.id === e.target.value);
                    setThreadSelecionada(thread || null);
                    setHistorico([]);
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Selecione uma thread...</option>
                  {threads.map(thread => {
                    const contato = contacts.find(c => c.id === thread.contact_id);
                    return (
                      <option key={thread.id} value={thread.id}>
                        {contato?.nome || 'Sem nome'} - {thread.pre_atendimento_etapa || 'inicial'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {threadSelecionada && (
                <>
                  {/* Info da Thread */}
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription>
                      <div className="space-y-1 text-sm">
                        <p><strong>Thread ID:</strong> {threadSelecionada.id}</p>
                        <p><strong>Etapa:</strong> {threadSelecionada.pre_atendimento_etapa || 'Não iniciado'}</p>
                        <p><strong>Ativo:</strong> {threadSelecionada.pre_atendimento_ativo ? 'Sim' : 'Não'}</p>
                        {threadSelecionada.assigned_user_name && (
                          <p><strong>Atendente:</strong> {threadSelecionada.assigned_user_name}</p>
                        )}
                        {threadSelecionada.sector_id && (
                          <p><strong>Setor:</strong> {threadSelecionada.sector_id}</p>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Simular Mensagem */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Simular mensagem do cliente:</label>
                    <div className="flex gap-2">
                      <Input
                        value={mensagemSimulada}
                        onChange={(e) => setMensagemSimulada(e.target.value)}
                        placeholder="Ex: 1 (para escolher setor)"
                        onKeyPress={(e) => e.key === 'Enter' && simularMensagemCliente()}
                        disabled={loading || simulacaoAtiva}
                      />
                      <Button 
                        onClick={simularMensagemCliente}
                        disabled={loading || simulacaoAtiva || !mensagemSimulada.trim()}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {simulacaoAtiva ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex gap-2">
                    <Button 
                      onClick={limparSimulacao}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpar Simulação
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Histórico da Simulação */}
          <Card className="border-2 border-orange-200">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-600" />
                Histórico da Simulação
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {historico.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma simulação iniciada</p>
                  </div>
                ) : (
                  historico.map((item, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border-2 ${
                        item.tipo === 'cliente' ? 'bg-blue-50 border-blue-200' :
                        item.tipo === 'sistema' ? 'bg-green-50 border-green-200' :
                        item.tipo === 'resultado' ? 'bg-purple-50 border-purple-200' :
                        'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {item.tipo === 'cliente' && <User className="w-4 h-4 text-blue-600 mt-0.5" />}
                        {item.tipo === 'sistema' && <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />}
                        {item.tipo === 'resultado' && <MessageSquare className="w-4 h-4 text-purple-600 mt-0.5" />}
                        {item.tipo === 'erro' && <XCircle className="w-4 h-4 text-red-600 mt-0.5" />}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <Badge className="text-xs">
                              {item.tipo}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <pre className="text-sm whitespace-pre-wrap font-mono">
                            {item.mensagem}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}