import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  AlertTriangle,
  Zap,
  MessageSquare,
  RefreshCw,
  Download,
  Eye,
  Clock
} from "lucide-react";
import { toast } from "sonner";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  PÁGINA DE TESTES AUTOMATIZADOS                              ║
 * ║  + Interface para executar testes end-to-end                 ║
 * ║  + Visualização detalhada de resultados                      ║
 * ║  + Histórico de testes                                        ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export default function TestesAutomatizados() {
  const [testando, setTestando] = useState(false);
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState("");
  const [numeroTeste, setNumeroTeste] = useState("");
  const [resultadoAtual, setResultadoAtual] = useState(null);
  const [etapaAtual, setEtapaAtual] = useState(null);

  const { data: integracoes = [], isLoading } = useQuery({
    queryKey: ['whatsapp_integrations'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    initialData: []
  });

  const executarTesteCompleto = async () => {
    if (!integracaoSelecionada) {
      toast.error("Selecione uma integração WhatsApp");
      return;
    }

    if (!numeroTeste) {
      toast.error("Digite um número de teste");
      return;
    }

    setTestando(true);
    setResultadoAtual(null);
    setEtapaAtual("Inicializando...");

    try {
      toast.info("🧪 Iniciando teste end-to-end completo...");

      const response = await base44.functions.invoke('testeEndToEnd', {
        action: 'teste_completo',
        test_phone: numeroTeste,
        integration_id: integracaoSelecionada
      });

      setResultadoAtual(response.data.resultados);
      
      if (response.data.success) {
        toast.success("✅ Teste completo executado com sucesso!");
      } else {
        toast.error("❌ Teste falhou. Verifique os detalhes.");
      }

    } catch (error) {
      console.error('Erro ao executar teste:', error);
      toast.error(`Erro: ${error.message}`);
      setResultadoAtual({
        status_geral: 'erro',
        erro: error.message
      });
    } finally {
      setTestando(false);
      setEtapaAtual(null);
    }
  };

  const executarTesteIndividual = async (tipoTeste) => {
    if (!integracaoSelecionada) {
      toast.error("Selecione uma integração");
      return;
    }

    setTestando(true);

    try {
      const response = await base44.functions.invoke('testeEndToEnd', {
        action: tipoTeste,
        test_phone: numeroTeste,
        integration_id: integracaoSelecionada
      });

      toast.success(`✅ Teste "${tipoTeste}" concluído!`);
      console.log('Resultado:', response.data);

    } catch (error) {
      console.error('Erro:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setTestando(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sucesso':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'falha':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'parcial':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const configs = {
      sucesso: { color: 'bg-green-100 text-green-800', label: 'Sucesso' },
      falha: { color: 'bg-red-100 text-red-800', label: 'Falha' },
      parcial: { color: 'bg-yellow-100 text-yellow-800', label: 'Parcial' },
      falha_completa: { color: 'bg-red-100 text-red-800', label: 'Falha Completa' },
      erro: { color: 'bg-red-100 text-red-800', label: 'Erro' }
    };

    const config = configs[status] || { color: 'bg-gray-100 text-gray-800', label: status };

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">🧪 Testes Automatizados</h1>
          <p className="text-slate-600 mt-1">Valide o funcionamento completo do sistema</p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          disabled={testando}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Configuração do Teste */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Configuração do Teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Integração WhatsApp</Label>
              <Select
                value={integracaoSelecionada}
                onValueChange={setIntegracaoSelecionada}
                disabled={testando}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma integração" />
                </SelectTrigger>
                <SelectContent>
                  {integracoes.map(int => (
                    <SelectItem key={int.id} value={int.id}>
                      {int.nome_instancia} - {int.numero_telefone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Número de Teste (com DDD)</Label>
              <Input
                placeholder="Ex: 5548999999999"
                value={numeroTeste}
                onChange={(e) => setNumeroTeste(e.target.value)}
                disabled={testando}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={executarTesteCompleto}
              disabled={testando || !integracaoSelecionada || !numeroTeste}
              className="bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              {testando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Executar Teste Completo
                </>
              )}
            </Button>

            <Button
              onClick={() => executarTesteIndividual('validar_integracao')}
              disabled={testando || !integracaoSelecionada}
              variant="outline"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Só Validar Conexão
            </Button>
          </div>

          {etapaAtual && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {etapaAtual}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Testes Individuais */}
      <Card>
        <CardHeader>
          <CardTitle>Testes Individuais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              onClick={() => executarTesteIndividual('teste_envio_zapi')}
              disabled={testando || !integracaoSelecionada || !numeroTeste}
              variant="outline"
              className="h-auto py-4 flex-col"
            >
              <MessageSquare className="w-6 h-6 mb-2 text-blue-500" />
              <span className="text-sm font-medium">Envio Z-API</span>
            </Button>

            <Button
              onClick={() => executarTesteIndividual('teste_webhook_recebimento')}
              disabled={testando || !integracaoSelecionada}
              variant="outline"
              className="h-auto py-4 flex-col"
            >
              <Zap className="w-6 h-6 mb-2 text-green-500" />
              <span className="text-sm font-medium">Webhook</span>
            </Button>

            <Button
              onClick={() => executarTesteIndividual('teste_playbook_execucao')}
              disabled={testando || !numeroTeste}
              variant="outline"
              className="h-auto py-4 flex-col"
            >
              <Play className="w-6 h-6 mb-2 text-purple-500" />
              <span className="text-sm font-medium">Playbook</span>
            </Button>

            <Button
              onClick={() => executarTesteIndividual('teste_followup_automatico')}
              disabled={testando || !numeroTeste}
              variant="outline"
              className="h-auto py-4 flex-col"
            >
              <RefreshCw className="w-6 h-6 mb-2 text-orange-500" />
              <span className="text-sm font-medium">Follow-up</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {resultadoAtual && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultados do Teste</span>
              {getStatusBadge(resultadoAtual.status_geral)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Informações Gerais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600">Timestamp</p>
                <p className="font-medium">{new Date(resultadoAtual.timestamp).toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Tempo Total</p>
                <p className="font-medium">{resultadoAtual.tempo_total_ms}ms</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Etapas</p>
                <p className="font-medium">{resultadoAtual.etapas?.length || 0}</p>
              </div>
            </div>

            {/* Etapas Detalhadas */}
            {resultadoAtual.etapas && resultadoAtual.etapas.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Detalhes por Etapa</h3>
                {resultadoAtual.etapas.map((etapa, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(etapa.status)}
                        <span className="font-medium">{etapa.nome}</span>
                      </div>
                      {getStatusBadge(etapa.status)}
                    </div>

                    {etapa.detalhes && (
                      <div className="mt-3 p-3 bg-slate-50 rounded text-sm">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(etapa.detalhes, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Erro Geral */}
            {resultadoAtual.erro && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900 mb-2">Erro:</p>
                <p className="text-sm text-red-800">{resultadoAtual.erro}</p>
              </div>
            )}

          </CardContent>
        </Card>
      )}

    </div>
  );
}