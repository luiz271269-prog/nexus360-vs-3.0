import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Circle,
  ChevronRight,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function AssistenteFase1() {
  const [etapaAtiva, setEtapaAtiva] = useState('A1');
  const [integracoes, setIntegracoes] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validacoes, setValidacoes] = useState({
    A1_credenciais_corretas: false,
    A2_thread_valida: false,
    A3_envio_sucesso: false,
    A4_recebimento_sucesso: false
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [integracoesData, threadsData] = await Promise.all([
        base44.entities.WhatsAppIntegration.list(),
        base44.entities.MessageThread.list('-updated_date', 10)
      ]);

      setIntegracoes(integracoesData);
      setThreads(threadsData);

      // Validação automática
      validarA1(integracoesData);
      validarA2(threadsData);
    } catch (error) {
      console.error('[FASE1] Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do sistema');
    }
    setLoading(false);
  };

  const validarA1 = (integracoesData) => {
    const integracaoValida = integracoesData.some(i => {
      const hasInstanceId = i.instance_id_provider && i.instance_id_provider.length > 10;
      const hasToken = i.api_key_provider && i.api_key_provider.length > 10;
      const hasClientToken = i.security_client_token_header && i.security_client_token_header.length > 3;
      const isDifferent = i.instance_id_provider !== i.api_key_provider;
      
      return hasInstanceId && hasToken && hasClientToken && isDifferent;
    });

    setValidacoes(prev => ({ ...prev, A1_credenciais_corretas: integracaoValida }));
  };

  const validarA2 = (threadsData) => {
    const threadValida = threadsData.some(t => t.whatsapp_integration_id);
    setValidacoes(prev => ({ ...prev, A2_thread_valida: threadValida }));
  };

  const copiarTexto = (texto, label) => {
    navigator.clipboard.writeText(texto);
    toast.success(`${label} copiado!`);
  };

  const etapas = [
    {
      id: 'A1',
      titulo: 'A1. Corrigir Credenciais',
      prioridade: 'CRÍTICA',
      status: validacoes.A1_credenciais_corretas ? 'concluido' : 'pendente',
      descricao: 'Verificar e corrigir as credenciais da integração Z-API'
    },
    {
      id: 'A2',
      titulo: 'A2. Corrigir Thread',
      prioridade: 'CRÍTICA',
      status: validacoes.A2_thread_valida ? 'concluido' : 'pendente',
      descricao: 'Garantir que threads possuem whatsapp_integration_id'
    },
    {
      id: 'A3',
      titulo: 'A3. Teste de Envio',
      prioridade: 'ALTA',
      status: validacoes.A3_envio_sucesso ? 'concluido' : 'pendente',
      descricao: 'Enviar mensagem de teste via sistema'
    },
    {
      id: 'A4',
      titulo: 'A4. Teste de Recebimento',
      prioridade: 'ALTA',
      status: validacoes.A4_recebimento_sucesso ? 'concluido' : 'pendente',
      descricao: 'Receber mensagem de teste do celular'
    }
  ];

  const renderA1 = () => (
    <div className="space-y-6">
      {/* Status Atual */}
      {validacoes.A1_credenciais_corretas ? (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>✅ Credenciais validadas!</strong> Pelo menos uma integração está configurada corretamente.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>❌ Problema detectado:</strong> Nenhuma integração com credenciais válidas encontrada.
          </AlertDescription>
        </Alert>
      )}

      {/* Instruções */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">📋 Onde encontrar as credenciais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900">
                Acesse o painel da Z-API:
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => window.open('https://painel.z-api.io', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir Painel Z-API
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <p className="text-sm text-blue-900 flex-1">
              Vá em: <strong>Instâncias → [Sua Instância] → Documentação</strong>
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 mb-3">
                Você precisa de <strong>3 valores diferentes</strong>:
              </p>
              <div className="space-y-2 ml-2">
                <div className="bg-white p-3 rounded border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-slate-600">instance_id_provider</span>
                    <Badge className="bg-green-100 text-green-800 text-xs">ID da Instância</Badge>
                  </div>
                  <p className="text-xs text-slate-600">Exemplo: 3E5D2BD1BF421127B24ECEF0269361A3</p>
                </div>

                <div className="bg-white p-3 rounded border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-slate-600">api_key_provider</span>
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">Token (DIFERENTE!)</Badge>
                  </div>
                  <p className="text-xs text-slate-600">Exemplo: F91DB8300CE1967F7F6403F6</p>
                </div>

                <div className="bg-white p-3 rounded border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-slate-600">security_client_token_header</span>
                    <Badge className="bg-purple-100 text-purple-800 text-xs">Client-Token</Badge>
                  </div>
                  <p className="text-xs text-slate-600">Exemplo: F16*** (Token de Segurança da Conta)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Integrações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>🔍 Integrações Cadastradas</span>
            <Button
              variant="outline"
              size="sm"
              onClick={carregarDados}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {integracoes.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma integração WhatsApp cadastrada. Vá em <strong>Comunicação → Configuração</strong> para criar uma.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {integracoes.map((integracao) => {
                const hasInstanceId = integracao.instance_id_provider && integracao.instance_id_provider.length > 10;
                const hasToken = integracao.api_key_provider && integracao.api_key_provider.length > 10;
                const hasClientToken = integracao.security_client_token_header && integracao.security_client_token_header.length > 3;
                const isDifferent = integracao.instance_id_provider !== integracao.api_key_provider;
                const isValid = hasInstanceId && hasToken && hasClientToken && isDifferent;

                return (
                  <Card key={integracao.id} className={isValid ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{integracao.nome_instancia}</h4>
                          <p className="text-sm text-slate-600">{integracao.numero_telefone}</p>
                        </div>
                        {isValid ? (
                          <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Válida</Badge>
                        ) : (
                          <Badge className="bg-red-600"><AlertTriangle className="w-3 h-3 mr-1" />Inválida</Badge>
                        )}
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          {hasInstanceId ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-red-600" />}
                          <span>Instance ID: {hasInstanceId ? '✓ Preenchido' : '✗ Vazio ou inválido'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasToken ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-red-600" />}
                          <span>Token Instância: {hasToken ? '✓ Preenchido' : '✗ Vazio ou inválido'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasClientToken ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-red-600" />}
                          <span>Client-Token: {hasClientToken ? '✓ Preenchido' : '✗ Vazio ou inválido'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isDifferent ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-red-600" />}
                          <span>Valores diferentes: {isDifferent ? '✓ Sim' : '✗ Instance ID = Token (ERRO!)'}</span>
                        </div>
                      </div>

                      {!isValid && (
                        <Alert className="mt-3 bg-red-100 border-red-300">
                          <AlertTriangle className="h-4 h-4 text-red-600" />
                          <AlertDescription className="text-xs text-red-800">
                            <strong>Ação necessária:</strong> Edite esta integração em Comunicação → Configuração e corrija os campos destacados.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ação */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => window.open('/Comunicacao?tab=configuracoes', '_self')}
        >
          Ir para Configurações
        </Button>
        <Button
          onClick={() => {
            carregarDados();
            if (validacoes.A1_credenciais_corretas) {
              setEtapaAtiva('A2');
              toast.success('✅ A1 concluída! Avançando para A2...');
            }
          }}
          disabled={!validacoes.A1_credenciais_corretas}
          className="bg-gradient-to-r from-green-500 to-emerald-600"
        >
          {validacoes.A1_credenciais_corretas ? 'Avançar para A2' : 'Validar Novamente'}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderA2 = () => (
    <div className="space-y-6">
      {/* Status */}
      {validacoes.A2_thread_valida ? (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>✅ Threads validadas!</strong> Encontradas threads com whatsapp_integration_id configurado.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>❌ Problema detectado:</strong> Threads sem whatsapp_integration_id.
          </AlertDescription>
        </Alert>
      )}

      {/* Instruções */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">📋 Como corrigir</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">✅ Opção 1: Criar Nova Conversa (Recomendado)</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 ml-4">
              <li>Vá em: <strong>Comunicação → Central de Mensagens</strong></li>
              <li>Clique no botão <strong>"+ Nova Conversa"</strong></li>
              <li>Selecione um contato existente ou crie um novo</li>
              <li>A thread será criada automaticamente com todos os campos corretos</li>
            </ol>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-blue-900 mb-2">⚙️ Opção 2: Editar Manualmente</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 ml-4">
              <li>Vá em: <strong>Dashboard → Data → MessageThread</strong></li>
              <li>Localize a thread problemática</li>
              <li>Edite e preencha o campo <code className="bg-blue-200 px-1 rounded">whatsapp_integration_id</code></li>
              <li>Use o ID de uma integração válida da etapa A1</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Threads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>📱 Threads Recentes</span>
            <Button
              variant="outline"
              size="sm"
              onClick={carregarDados}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {threads.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nenhuma thread encontrada. Crie sua primeira conversa em <strong>Comunicação → Central de Mensagens</strong>.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {threads.map((thread) => {
                const isValid = !!thread.whatsapp_integration_id;
                
                return (
                  <Card key={thread.id} className={isValid ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {isValid ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                            <span className="font-semibold text-sm">Thread ID: {thread.id.substring(0, 8)}...</span>
                          </div>
                          <p className="text-xs text-slate-600 mb-1">
                            Contato: {thread.contact_id?.substring(0, 8)}...
                          </p>
                          <p className="text-xs text-slate-600">
                            Integração: {thread.whatsapp_integration_id ? `✓ ${thread.whatsapp_integration_id.substring(0, 8)}...` : '✗ Não configurada'}
                          </p>
                        </div>
                        {isValid ? (
                          <Badge className="bg-green-600">OK</Badge>
                        ) : (
                          <Badge className="bg-red-600">Corrigir</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setEtapaAtiva('A1')}
        >
          Voltar para A1
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => window.open('/Comunicacao', '_self')}
          >
            Ir para Comunicação
          </Button>
          <Button
            onClick={() => {
              carregarDados();
              if (validacoes.A2_thread_valida) {
                setEtapaAtiva('A3');
                toast.success('✅ A2 concluída! Avançando para A3...');
              }
            }}
            disabled={!validacoes.A2_thread_valida}
            className="bg-gradient-to-r from-green-500 to-emerald-600"
          >
            {validacoes.A2_thread_valida ? 'Avançar para A3' : 'Validar Novamente'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderA3 = () => (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-800">
          <strong>🧪 Teste de Envio:</strong> Vamos validar que o sistema consegue enviar mensagens via Z-API.
        </AlertDescription>
      </Alert>

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">📋 Procedimento de Teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 mb-2">
                Acesse a Central de Comunicação:
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/Comunicacao', '_self')}
              >
                Abrir Central de Comunicação
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <p className="text-sm text-blue-900 flex-1">
              Selecione uma conversa (thread) que foi corrigida na etapa A2
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 mb-2">
                Digite esta mensagem de teste:
              </p>
              <div className="bg-white p-3 rounded border border-blue-200 flex items-center justify-between">
                <code className="text-sm">Teste de envio VendaPro Pro ✅</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copiarTexto('Teste de envio VendaPro Pro ✅', 'Mensagem de teste')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              4
            </div>
            <p className="text-sm text-blue-900 flex-1">
              Clique no botão <strong>"Enviar"</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-lg text-green-900">✅ Resultado Esperado</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-green-800">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              A mensagem aparece no ChatWindow com status "enviada"
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              A mensagem é recebida no WhatsApp do destinatário
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Nenhum erro aparece na tela
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-lg text-amber-900">🔍 Onde Verificar os Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800 mb-3">
            Caso ocorra erro, verifique os logs do worker <code className="bg-amber-200 px-1 rounded">enviarWhatsApp</code>:
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://base44.com/dashboard', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir Dashboard Base44
          </Button>
          <p className="text-xs text-amber-700 mt-2">
            Vá em: Code → Functions → enviarWhatsApp → Logs
          </p>
        </CardContent>
      </Card>

      {/* Validação Manual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📝 Validação Manual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700">
            Após executar o teste, confirme se foi bem-sucedido:
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setValidacoes(prev => ({ ...prev, A3_envio_sucesso: false }));
                toast.error('Teste marcado como FALHOU. Revise as credenciais e logs.');
              }}
              className="flex-1"
            >
              ❌ Teste Falhou
            </Button>
            <Button
              onClick={() => {
                setValidacoes(prev => ({ ...prev, A3_envio_sucesso: true }));
                toast.success('✅ Teste de envio bem-sucedido!');
                setTimeout(() => setEtapaAtiva('A4'), 1000);
              }}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600"
            >
              ✅ Teste Passou
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setEtapaAtiva('A2')}
        >
          Voltar para A2
        </Button>
        {validacoes.A3_envio_sucesso && (
          <Button
            onClick={() => setEtapaAtiva('A4')}
            className="bg-gradient-to-r from-green-500 to-emerald-600"
          >
            Avançar para A4
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );

  const renderA4 = () => (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-800">
          <strong>🧪 Teste de Recebimento:</strong> Vamos validar que o webhook está funcionando e mensagens chegam ao sistema.
        </AlertDescription>
      </Alert>

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">📋 Procedimento de Teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <p className="text-sm text-blue-900 flex-1">
              Pegue seu celular pessoal
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 mb-2">
                Envie esta mensagem para o número WhatsApp conectado à Z-API:
              </p>
              <div className="bg-white p-3 rounded border border-blue-200 flex items-center justify-between">
                <code className="text-sm">Teste de recebimento VendaPro Pro 📱</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copiarTexto('Teste de recebimento VendaPro Pro 📱', 'Mensagem de teste')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <p className="text-sm text-blue-900 flex-1">
              Aguarde alguns segundos (máximo 10 segundos)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-lg text-green-900">✅ Resultado Esperado</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-green-800">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              A mensagem aparece na Central de Comunicação
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Um novo <code className="bg-green-200 px-1 rounded">Contact</code> é criado (se não existia)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Uma nova <code className="bg-green-200 px-1 rounded">MessageThread</code> é criada (se não existia)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              O contador de mensagens não lidas é incrementado
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-lg text-purple-900">🔍 Logs Esperados (inboundWebhook)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono space-y-1 overflow-x-auto">
            <div>[WEBHOOK] 📨 Webhook recebido: z_api</div>
            <div>[WEBHOOK] 💾 Log criado: id=...</div>
            <div>[WEBHOOK] ✅ Integração encontrada</div>
            <div>[Z-API-HANDLER] 🔄 Processando evento: message-received</div>
            <div>[Z-API-HANDLER] 📱 Número do remetente: +5548999999999</div>
            <div>[Z-API-HANDLER] 👤 Contato: id=... (ou "Novo contato criado")</div>
            <div>[Z-API-HANDLER] 💬 Thread: id=... (ou "Nova thread criada")</div>
            <div>[Z-API-HANDLER] 📝 Conteúdo extraído</div>
            <div>[Z-API-HANDLER] ✅ Mensagem criada: id=...</div>
            <div>[Z-API-HANDLER] 📊 Thread atualizada</div>
            <div>[WEBHOOK] ✅ Processamento concluído</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => window.open('https://base44.com/dashboard', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Ver Logs no Base44
          </Button>
          <p className="text-xs text-purple-700 mt-2">
            Vá em: Code → Functions → inboundWebhook → Logs
          </p>
        </CardContent>
      </Card>

      {/* Validação Manual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📝 Validação Manual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700">
            Após executar o teste, confirme se foi bem-sucedido:
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setValidacoes(prev => ({ ...prev, A4_recebimento_sucesso: false }));
                toast.error('Teste marcado como FALHOU. Verifique o webhook na Z-API.');
              }}
              className="flex-1"
            >
              ❌ Teste Falhou
            </Button>
            <Button
              onClick={() => {
                setValidacoes(prev => ({ ...prev, A4_recebimento_sucesso: true }));
                toast.success('✅ Teste de recebimento bem-sucedido! FASE 1 CONCLUÍDA!', { duration: 5000 });
              }}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600"
            >
              ✅ Teste Passou
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conclusão */}
      {validacoes.A4_recebimento_sucesso && (
        <Alert className="bg-green-50 border-2 border-green-400">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertDescription className="text-green-800">
            <p className="font-bold text-lg mb-2">🎉 FASE 1 CONCLUÍDA COM SUCESSO!</p>
            <p className="text-sm">
              A comunicação bidirecional com a Z-API está 100% funcional. 
              Você está pronto para avançar para a <strong>FASE 2 (SRE e Autonomia)</strong>!
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Ações */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setEtapaAtiva('A3')}
        >
          Voltar para A3
        </Button>
        {validacoes.A4_recebimento_sucesso && (
          <Button
            onClick={() => toast.info('FASE 2 em desenvolvimento. Continue monitorando o sistema!')}
            className="bg-gradient-to-r from-purple-500 to-indigo-600"
          >
            Avançar para FASE 2
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-2">🚀 FASE 1: Estabilização da Comunicação</h1>
        <p className="text-blue-100">
          Assistente interativo para validação passo-a-passo
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
            {etapas.map((etapa, index) => (
              <button
                key={etapa.id}
                onClick={() => setEtapaAtiva(etapa.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  etapaAtiva === etapa.id
                    ? 'border-blue-500 bg-blue-50'
                    : etapa.status === 'concluido'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs">{etapa.id}</span>
                  {etapa.status === 'concluido' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <p className="text-xs text-slate-600 text-left">{etapa.descricao}</p>
                <Badge
                  className={`mt-2 text-xs ${
                    etapa.prioridade === 'CRÍTICA' ? 'bg-red-600' : 'bg-yellow-600'
                  }`}
                >
                  {etapa.prioridade}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {etapas.find(e => e.id === etapaAtiva)?.titulo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {etapaAtiva === 'A1' && renderA1()}
          {etapaAtiva === 'A2' && renderA2()}
          {etapaAtiva === 'A3' && renderA3()}
          {etapaAtiva === 'A4' && renderA4()}
        </CardContent>
      </Card>
    </div>
  );
}