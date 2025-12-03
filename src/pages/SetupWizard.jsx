
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Copy,
  Play,
  Trophy
} from "lucide-react";
import { toast } from "sonner";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  SETUP WIZARD - Configuração Inicial Guiada                 ║
 * ║  + Validação de integração WhatsApp                          ║
 * ║  + Registro de webhook                                        ║
 * ║  + Criação de playbooks de exemplo                           ║
 * ║  + Teste end-to-end completo                                 ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export default function SetupWizard() {
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState({
    whatsapp_instance_id: "",
    whatsapp_api_key: "",
    whatsapp_client_token: "",
    teste_numero: "",
    webhook_url: ""
  });
  const [resultados, setResultados] = useState({
    conexao_whatsapp: null,
    webhook_registrado: null,
    playbooks_criados: null,
    teste_mensagem: null
  });

  const webhookURL = `${window.location.origin}/functions/inboundWebhook`;

  const etapas = [
    { numero: 1, titulo: "Conexão WhatsApp", icon: MessageSquare },
    { numero: 2, titulo: "Configurar Webhook", icon: Zap },
    { numero: 3, titulo: "Criar Playbooks", icon: Sparkles },
    { numero: 4, titulo: "Teste Final", icon: Play }
  ];

  // ═══════════════════════════════════════════════════════════
  // ETAPA 1: Testar Conexão WhatsApp
  // ═══════════════════════════════════════════════════════════
  const testarConexaoWhatsApp = async () => {
    setLoading(true);
    try {
      // 1. Criar ou atualizar WhatsAppIntegration
      const integracao = await base44.entities.WhatsAppIntegration.create({
        nome_instancia: "Principal",
        numero_telefone: "+5500000000000", // Será atualizado pelo teste
        api_provider: "z_api",
        instance_id_provider: dados.whatsapp_instance_id,
        api_key_provider: dados.whatsapp_api_key,
        security_client_token_header: dados.whatsapp_client_token,
        base_url_provider: "https://api.z-api.io",
        status: "pendente_qrcode"
      });

      // 2. Testar conexão real
      const response = await base44.functions.invoke('testarConexaoWhatsApp', {
        integration_id: integracao.id
      });

      if (response.data.success) {
        setResultados(prev => ({
          ...prev,
          conexao_whatsapp: {
            status: 'sucesso',
            mensagem: 'Conexão estabelecida com sucesso!',
            detalhes: response.data
          }
        }));

        toast.success("✅ WhatsApp conectado!");
        setEtapaAtual(2);
      } else {
        throw new Error(response.data.error || 'Falha na conexão');
      }

    } catch (error) {
      setResultados(prev => ({
        ...prev,
        conexao_whatsapp: {
          status: 'erro',
          mensagem: error.message
        }
      }));
      toast.error(`❌ Erro: ${error.message}`);
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════
  // ETAPA 2: Configurar Webhook na Z-API
  // ═══════════════════════════════════════════════════════════
  const configurarWebhook = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.z-api.io/instances/${dados.whatsapp_instance_id}/token/${dados.whatsapp_api_key}/webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': dados.whatsapp_client_token
          },
          body: JSON.stringify({
            url: webhookURL,
            enabled: true,
            webhookEvents: [
              'message-received',
              'message-status',
              'connection-change'
            ]
          })
        }
      );

      const result = await response.json();

      if (response.ok) {
        setResultados(prev => ({
          ...prev,
          webhook_registrado: {
            status: 'sucesso',
            mensagem: 'Webhook configurado na Z-API!',
            url: webhookURL
          }
        }));

        toast.success("✅ Webhook configurado!");
        setEtapaAtual(3);
      } else {
        throw new Error(result.error || 'Falha ao configurar webhook');
      }

    } catch (error) {
      setResultados(prev => ({
        ...prev,
        webhook_registrado: {
          status: 'erro',
          mensagem: error.message
        }
      }));
      toast.error(`❌ Erro: ${error.message}`);
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════
  // ETAPA 3: Criar Playbooks de Exemplo
  // ═══════════════════════════════════════════════════════════
  const criarPlaybooksExemplo = async () => {
    setLoading(true);
    try {
      const playbooks = [
        {
          nome: "Follow-up Pós-Orçamento",
          descricao: "Sequência automática de acompanhamento após envio de orçamento",
          categoria: "vendas",
          tipo_fluxo: "follow_up_vendas",
          gatilhos: ["orcamento_enviado", "proposta"],
          prioridade: 5,
          steps: [
            {
              type: "message",
              texto: "Olá {{nome_cliente}}! 👋\n\nRecebeu nosso orçamento? Tem alguma dúvida?",
              delay_days: 1
            },
            {
              type: "wait_response",
              timeout_hours: 48
            },
            {
              type: "message",
              texto: "Oi {{nome_cliente}}! Tudo bem?\n\nSó passando para ver se precisa de mais informações sobre nossa proposta. Estamos à disposição! 😊",
              delay_days: 3
            },
            {
              type: "wait_response",
              timeout_hours: 72
            },
            {
              type: "message",
              texto: "{{nome_cliente}}, nossa proposta continua válida!\n\nPosso agendar uma call rápida para conversar?",
              delay_days: 7
            },
            {
              type: "end"
            }
          ],
          ativo: true,
          requires_ia: false,
          auto_escalate_to_human: true
        },
        {
          nome: "Qualificação de Lead Inicial",
          descricao: "Qualifica novos leads automaticamente",
          categoria: "vendas",
          tipo_fluxo: "qualificacao",
          gatilhos: ["novo_lead", "primeiro_contato"],
          prioridade: 8,
          steps: [
            {
              type: "message",
              texto: "Olá! Bem-vindo(a)! 🎉\n\nPara te atender melhor, qual é seu nome?"
            },
            {
              type: "input",
              campo: "nome",
              tipo_input: "text",
              validacao: { minLength: 2 }
            },
            {
              type: "message",
              texto: "Prazer, {{nome}}! 😊\n\nQual é o principal interesse:\n1️⃣ Conhecer produtos\n2️⃣ Solicitar orçamento\n3️⃣ Suporte técnico\n4️⃣ Outros"
            },
            {
              type: "input",
              campo: "interesse",
              tipo_input: "text",
              opcoes: ["1", "2", "3", "4"]
            },
            {
              type: "ia_classify",
              campo: "classificacao_lead"
            },
            {
              type: "action",
              acao: "atribuir_vendedor"
            },
            {
              type: "message",
              texto: "Perfeito! Em breve um especialista entrará em contato. Obrigado! 🚀"
            },
            {
              type: "end"
            }
          ],
          ativo: true,
          requires_ia: true
        },
        {
          nome: "Pesquisa de Satisfação Pós-Venda",
          descricao: "Coleta feedback após fechamento de venda",
          categoria: "pos_venda",
          tipo_fluxo: "ativacao_cliente",
          gatilhos: ["venda_fechada", "pos_venda"],
          prioridade: 3,
          steps: [
            {
              type: "message",
              texto: "Oi {{nome_cliente}}! 😊\n\nComo foi sua experiência conosco? De 1 a 5, qual nota você dá?",
              delay_days: 3
            },
            {
              type: "input",
              campo: "nota",
              tipo_input: "number",
              validacao: { min: 1, max: 5 }
            },
            {
              type: "message",
              texto: "Obrigado pelo feedback! Tem alguma sugestão de melhoria?"
            },
            {
              type: "input",
              campo: "sugestao",
              tipo_input: "text"
            },
            {
              type: "message",
              texto: "Sua opinião é muito importante! Agradecemos pela confiança. 🙏"
            },
            {
              type: "end"
            }
          ],
          ativo: true
        }
      ];

      const criados = [];
      for (const playbook of playbooks) {
        const criado = await base44.entities.FlowTemplate.create(playbook);
        criados.push(criado);
      }

      setResultados(prev => ({
        ...prev,
        playbooks_criados: {
          status: 'sucesso',
          mensagem: `${criados.length} playbooks criados!`,
          playbooks: criados
        }
      }));

      toast.success(`✅ ${criados.length} playbooks prontos para uso!`);
      setEtapaAtual(4);

    } catch (error) {
      setResultados(prev => ({
        ...prev,
        playbooks_criados: {
          status: 'erro',
          mensagem: error.message
        }
      }));
      toast.error(`❌ Erro: ${error.message}`);
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════
  // ETAPA 4: Teste End-to-End
  // ═══════════════════════════════════════════════════════════
  const executarTesteCompleto = async () => {
    setLoading(true);
    try {
      // 1. Criar contato de teste
      const contato = await base44.entities.Contact.create({
        nome: "Teste Automático",
        telefone: dados.teste_numero,
        tipo_contato: "lead",
        tags: ["teste_setup"]
      });

      // 2. Enviar mensagem de teste
      const response = await base44.functions.invoke('enviarWhatsApp', {
        contact_id: contato.id,
        message: "🎉 Setup concluído! Sistema funcionando perfeitamente!"
      });

      if (response.data.success) {
        setResultados(prev => ({
          ...prev,
          teste_mensagem: {
            status: 'sucesso',
            mensagem: 'Mensagem de teste enviada! Verifique seu WhatsApp.',
            contact_id: contato.id
          }
        }));

        toast.success("✅ Teste concluído! Sistema pronto para uso!");
      } else {
        throw new Error(response.data.error || 'Falha no envio');
      }

    } catch (error) {
      setResultados(prev => ({
        ...prev,
        teste_mensagem: {
          status: 'erro',
          mensagem: error.message
        }
      }));
      toast.error(`❌ Erro: ${error.message}`);
    }
    setLoading(false);
  };

  const progressoGeral = (etapaAtual / etapas.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-full shadow-lg mb-4">
            <Zap className="w-6 h-6" />
            <h1 className="text-2xl font-bold">Setup Wizard - Nexus360</h1>
          </div>
          <p className="text-slate-600">
            Vamos configurar seu sistema em 4 passos simples
          </p>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="pt-6">
            <Progress value={progressoGeral} className="h-3 mb-4" />
            <div className="flex justify-between">
              {etapas.map((etapa) => {
                const Icon = etapa.icon;
                const concluida = etapaAtual > etapa.numero;
                const atual = etapaAtual === etapa.numero;
                
                return (
                  <div key={etapa.numero} className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                      concluida ? 'bg-green-500 text-white' :
                      atual ? 'bg-purple-600 text-white animate-pulse' :
                      'bg-slate-200 text-slate-400'
                    }`}>
                      {concluida ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <span className={`text-xs font-medium ${atual ? 'text-purple-600' : 'text-slate-600'}`}>
                      {etapa.titulo}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Etapa 1: Conexão WhatsApp */}
        {etapaAtual === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-600" />
                Etapa 1: Conectar WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Instance ID</Label>
                <Input
                  value={dados.whatsapp_instance_id}
                  onChange={(e) => setDados({...dados, whatsapp_instance_id: e.target.value})}
                  placeholder="Ex: 3E5D2BD1BF421127B24ECEF0269361A3"
                />
              </div>
              <div>
                <Label>API Key (Token)</Label>
                <Input
                  value={dados.whatsapp_api_key}
                  onChange={(e) => setDados({...dados, whatsapp_api_key: e.target.value})}
                  placeholder="Ex: F91DB8300CE1967F7F6403F6"
                />
              </div>
              <div>
                <Label>Client Token (Segurança)</Label>
                <Input
                  value={dados.whatsapp_client_token}
                  onChange={(e) => setDados({...dados, whatsapp_client_token: e.target.value})}
                  placeholder="Ex: F16..."
                  type="password"
                />
              </div>

              {resultados.conexao_whatsapp?.status === 'erro' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Erro na conexão</p>
                    <p className="text-sm text-red-700">{resultados.conexao_whatsapp.mensagem}</p>
                  </div>
                </div>
              )}

              <Button
                onClick={testarConexaoWhatsApp}
                disabled={loading || !dados.whatsapp_instance_id || !dados.whatsapp_api_key}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Testando...</>
                ) : (
                  <>Testar Conexão <ArrowRight className="w-5 h-5 ml-2" /></>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Etapa 2: Webhook */}
        {etapaAtual === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Etapa 2: Configurar Webhook
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-900 mb-2">
                  <strong>URL do Webhook:</strong>
                </p>
                <div className="flex gap-2">
                  <Input value={webhookURL} readOnly className="bg-white" />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookURL);
                      toast.success("URL copiada!");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  ℹ️ O sistema irá configurar automaticamente o webhook na Z-API.
                  Se preferir fazer manualmente, acesse o painel da Z-API e cole a URL acima.
                </p>
              </div>

              {resultados.webhook_registrado?.status === 'erro' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Erro ao configurar webhook</p>
                    <p className="text-sm text-red-700">{resultados.webhook_registrado.mensagem}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setEtapaAtual(1)}
                >
                  Voltar
                </Button>
                <Button
                  onClick={configurarWebhook}
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Configurando...</>
                  ) : (
                    <>Configurar Webhook <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etapa 3: Playbooks */}
        {etapaAtual === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                Etapa 3: Criar Playbooks de Exemplo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-600">
                Vamos criar 3 playbooks prontos para você começar a usar:
              </p>

              <div className="space-y-3">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-1">📊 Follow-up Pós-Orçamento</h4>
                  <p className="text-sm text-green-700">
                    Sequência automática: 24h → 3 dias → 7 dias após envio de orçamento
                  </p>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-1">🎯 Qualificação de Lead</h4>
                  <p className="text-sm text-blue-700">
                    Coleta informações e qualifica automaticamente novos leads
                  </p>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-1">⭐ Pesquisa de Satisfação</h4>
                  <p className="text-sm text-purple-700">
                    Coleta feedback 3 dias após fechamento de venda
                  </p>
                </div>
              </div>

              {resultados.playbooks_criados?.status === 'erro' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Erro ao criar playbooks</p>
                    <p className="text-sm text-red-700">{resultados.playbooks_criados.mensagem}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setEtapaAtual(2)}
                >
                  Voltar
                </Button>
                <Button
                  onClick={criarPlaybooksExemplo}
                  disabled={loading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Criando...</>
                  ) : (
                    <>Criar Playbooks <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etapa 4: Teste Final */}
        {etapaAtual === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-green-600" />
                Etapa 4: Teste Final
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-600">
                Vamos enviar uma mensagem de teste para confirmar que tudo está funcionando:
              </p>

              <div>
                <Label>Seu Número de WhatsApp (com DDD)</Label>
                <Input
                  value={dados.teste_numero}
                  onChange={(e) => setDados({...dados, teste_numero: e.target.value})}
                  placeholder="Ex: +5548999999999"
                />
              </div>

              {resultados.teste_mensagem?.status === 'sucesso' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900">✅ Teste concluído com sucesso!</p>
                    <p className="text-sm text-green-700">
                      Verifique seu WhatsApp. Você deve ter recebido uma mensagem.
                    </p>
                  </div>
                </div>
              )}

              {resultados.teste_mensagem?.status === 'erro' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Erro no teste</p>
                    <p className="text-sm text-red-700">{resultados.teste_mensagem.mensagem}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setEtapaAtual(3)}
                >
                  Voltar
                </Button>
                <Button
                  onClick={executarTesteCompleto}
                  disabled={loading || !dados.teste_numero}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <>Executar Teste <Play className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </div>

              {resultados.teste_mensagem?.status === 'sucesso' && (
                <Button
                  onClick={() => window.location.href = createPageUrl('NexusCommandCenter')}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  <Trophy className="w-5 h-5 mr-2" />
                  Finalizar e Ir para o Command Center
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
