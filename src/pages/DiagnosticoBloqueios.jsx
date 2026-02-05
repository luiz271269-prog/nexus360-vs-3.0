import React from "react";
const { useState, useEffect } = React;
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  ShieldAlert,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  MessageSquare,
  Lock,
  Unlock
} from "lucide-react";
import { toast } from "sonner";
import { normalizarTelefone } from "../components/lib/phoneUtils";

export default function DiagnosticoBloqueios() {
  const [telefone, setTelefone] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    carregarUsuario();
    
    // Carregar telefone da URL se existir
    const urlParams = new URLSearchParams(window.location.search);
    const telUrl = urlParams.get('telefone');
    if (telUrl) {
      setTelefone(telUrl);
      buscarBloqueios(telUrl);
    }
  }, []);

  const carregarUsuario = async () => {
    try {
      const user = await base44.auth.me();
      setUsuario(user);
      
      if (user?.role !== 'admin') {
        toast.error('❌ Apenas administradores podem acessar esta página');
      }
    } catch (error) {
      console.error('[DiagnosticoBloqueios] Erro ao carregar usuário:', error);
    }
  };

  const buscarBloqueios = async (tel = telefone) => {
    if (!tel || tel.trim() === '') {
      toast.error('Digite um telefone');
      return;
    }

    setBuscando(true);
    setResultado(null);

    try {
      // Limpar caracteres especiais do input
      const telLimpo = tel.replace(/\D/g, '');
      
      // Tentar múltiplas variações do telefone
      const variacoes = [
        telLimpo,                                    // 5548988020340
        `+${telLimpo}`,                             // +5548988020340
        telLimpo.startsWith('55') ? telLimpo.substring(2) : telLimpo, // 48988020340
        telLimpo.startsWith('55') ? `+${telLimpo}` : `+55${telLimpo}` // +5548988020340
      ];

      // Buscar contato tentando todas as variações
      let contatos = [];
      for (const variacao of variacoes) {
        const resultado = await base44.entities.Contact.filter({ telefone: variacao });
        if (resultado.length > 0) {
          contatos = resultado;
          break;
        }
      }
      
      if (contatos.length === 0) {
        setResultado({
          encontrado: false,
          telefone: telLimpo,
          variacoesTentadas: variacoes
        });
        toast.error(`Nenhum contato encontrado. Tentamos: ${variacoes.join(', ')}`);
        setBuscando(false);
        return;
      }

      const contato = contatos[0];

      // Buscar threads do contato
      const threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });

      // Verificar bloqueios
      const bloqueios = {
        contato_bloqueado: contato.bloqueado || false,
        motivo_bloqueio_contato: contato.motivo_bloqueio,
        bloqueado_em: contato.bloqueado_em,
        bloqueado_por: contato.bloqueado_por,
        threads_bloqueadas: threads.filter(t => t.bloqueado).length,
        threads_total: threads.length,
        detalhes_threads: threads.map(t => ({
          id: t.id,
          bloqueado: t.bloqueado || false,
          motivo_bloqueio: t.motivo_bloqueio,
          channel: t.channel,
          status: t.status,
          total_mensagens: t.total_mensagens || 0
        }))
      };

      setResultado({
        encontrado: true,
        contato,
        bloqueios,
        telefone: telefoneNormalizado
      });

    } catch (error) {
      console.error('[DiagnosticoBloqueios] Erro na busca:', error);
      toast.error('Erro ao buscar bloqueios: ' + error.message);
    } finally {
      setBuscando(false);
    }
  };

  const removerBloqueios = async () => {
    if (!resultado || !resultado.encontrado) return;

    if (!confirm('⚠️ Tem certeza que deseja remover TODOS os bloqueios deste contato e suas conversas?')) {
      return;
    }

    setProcessando(true);
    const toastId = toast.loading('🔓 Removendo bloqueios...');

    try {
      let acoesRealizadas = [];

      // 1. Desbloquear contato
      if (resultado.bloqueios.contato_bloqueado) {
        await base44.entities.Contact.update(resultado.contato.id, {
          bloqueado: false,
          motivo_bloqueio: null,
          bloqueado_em: null,
          bloqueado_por: null
        });
        acoesRealizadas.push('Contato desbloqueado');
      }

      // 2. Desbloquear todas as threads
      const threadsBloqueadas = resultado.bloqueios.detalhes_threads.filter(t => t.bloqueado);
      
      for (const thread of threadsBloqueadas) {
        await base44.entities.MessageThread.update(thread.id, {
          bloqueado: false,
          motivo_bloqueio: null,
          bloqueado_em: null,
          bloqueado_por: null
        });
        acoesRealizadas.push(`Thread ${thread.channel || 'interno'} desbloqueada`);
      }

      toast.dismiss(toastId);
      toast.success(
        `✅ Bloqueios removidos!\n\n${acoesRealizadas.join('\n')}`,
        { duration: 5000 }
      );

      // Recarregar dados
      await buscarBloqueios(resultado.telefone);

    } catch (error) {
      console.error('[DiagnosticoBloqueios] Erro ao remover bloqueios:', error);
      toast.dismiss(toastId);
      toast.error('❌ Erro ao remover bloqueios: ' + error.message);
    } finally {
      setProcessando(false);
    }
  };

  if (usuario?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2">
            <p className="font-semibold">Acesso Restrito</p>
            <p className="text-sm text-slate-600">Apenas administradores podem acessar esta página.</p>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-600" />
            Diagnóstico de Bloqueios
          </h1>
          <p className="text-slate-600 mt-2">
            Identifique e remova bloqueios de contatos e conversas
          </p>
        </div>

        {/* Busca */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Buscar Contato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Digite o telefone (ex: 48999322400)"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && buscarBloqueios()}
                className="flex-1"
              />
              <Button
                onClick={() => buscarBloqueios()}
                disabled={buscando}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {buscando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultado */}
        {resultado && (
          <>
            {!resultado.encontrado ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <div className="ml-2">
                  <p className="font-semibold">Contato não encontrado</p>
                  <p className="text-sm text-slate-600">
                    Nenhum contato encontrado com o telefone: {resultado.telefone}
                  </p>
                </div>
              </Alert>
            ) : (
              <div className="space-y-4">
                {/* Informações do Contato */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {resultado.contato.nome || resultado.telefone}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {resultado.contato.empresa && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{resultado.contato.empresa}</Badge>
                      </div>
                    )}
                    <div className="text-sm text-slate-600">
                      <p><strong>Telefone:</strong> {resultado.telefone}</p>
                      {resultado.contato.email && <p><strong>Email:</strong> {resultado.contato.email}</p>}
                      <p><strong>Tipo:</strong> {resultado.contato.tipo_contato || 'lead'}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Status de Bloqueio do Contato */}
                <Card className={resultado.bloqueios.contato_bloqueado ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {resultado.bloqueios.contato_bloqueado ? (
                        <>
                          <Lock className="w-5 h-5 text-red-600" />
                          <span className="text-red-900">Contato Bloqueado</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-5 h-5 text-green-600" />
                          <span className="text-green-900">Contato Desbloqueado</span>
                        </>
                      )}
                    </CardTitle>
                  </CardHeader>
                  {resultado.bloqueios.contato_bloqueado && (
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {resultado.bloqueios.motivo_bloqueio_contato && (
                          <p><strong>Motivo:</strong> {resultado.bloqueios.motivo_bloqueio_contato}</p>
                        )}
                        {resultado.bloqueios.bloqueado_em && (
                          <p><strong>Bloqueado em:</strong> {new Date(resultado.bloqueios.bloqueado_em).toLocaleString('pt-BR')}</p>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Status das Threads */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Conversas ({resultado.bloqueios.threads_total})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {resultado.bloqueios.threads_bloqueadas > 0 ? (
                      <Alert className="bg-red-50 border-red-200 mb-4">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <div className="ml-2">
                          <p className="font-semibold text-red-900">
                            {resultado.bloqueios.threads_bloqueadas} thread(s) bloqueada(s)
                          </p>
                        </div>
                      </Alert>
                    ) : (
                      <Alert className="bg-green-50 border-green-200 mb-4">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <div className="ml-2">
                          <p className="font-semibold text-green-900">
                            Todas as conversas estão desbloqueadas
                          </p>
                        </div>
                      </Alert>
                    )}

                    <div className="space-y-2 mt-4">
                      {resultado.bloqueios.detalhes_threads.map(thread => (
                        <div
                          key={thread.id}
                          className={`p-3 rounded-lg border ${
                            thread.bloqueado ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {thread.bloqueado ? (
                                <Lock className="w-4 h-4 text-red-600" />
                              ) : (
                                <Unlock className="w-4 h-4 text-green-600" />
                              )}
                              <div>
                                <p className="font-medium text-sm">
                                  {thread.channel || 'interno'} - {thread.status}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {thread.total_mensagens} mensagens
                                </p>
                              </div>
                            </div>
                            {thread.bloqueado && (
                              <Badge variant="destructive">Bloqueada</Badge>
                            )}
                          </div>
                          {thread.bloqueado && thread.motivo_bloqueio && (
                            <p className="text-xs text-slate-600 mt-2">
                              <strong>Motivo:</strong> {thread.motivo_bloqueio}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Ações */}
                {(resultado.bloqueios.contato_bloqueado || resultado.bloqueios.threads_bloqueadas > 0) && (
                  <Card className="border-orange-300 bg-orange-50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        Ações Disponíveis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={removerBloqueios}
                        disabled={processando}
                        className="w-full bg-red-600 hover:bg-red-700 text-white"
                        size="lg"
                      >
                        {processando ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Removendo bloqueios...
                          </>
                        ) : (
                          <>
                            <Unlock className="w-5 h-5 mr-2" />
                            Remover TODOS os bloqueios
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-center text-slate-500 mt-3">
                        Isso removerá o bloqueio do contato e de todas as {resultado.bloqueios.threads_total} conversas associadas
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}