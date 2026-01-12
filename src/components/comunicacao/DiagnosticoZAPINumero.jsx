import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  AlertCircle, CheckCircle2, Clock, XCircle, Loader2, 
  Phone, Shield, Send, MessageSquare, Zap
} from "lucide-react";
import { toast } from "sonner";
import { normalizarTelefone } from "../lib/phoneUtils";

export default function DiagnosticoZAPINumero() {
  const [numeroTeste, setNumeroTeste] = useState("");
  const [diagnosticando, setDiagnosticando] = useState(false);
  const [resultados, setResultados] = useState(null);

  const executarDiagnostico = async () => {
    const numNorm = normalizarTelefone(numeroTeste);
    
    if (!numNorm) {
      toast.error("❌ Número inválido. Digite um número brasileiro válido.");
      return;
    }

    setDiagnosticando(true);
    setResultados(null);

    try {
      // Buscar integração Z-API ativa
      const integracoes = await base44.entities.WhatsAppIntegration.filter({
        api_provider: 'z_api',
        status: 'conectado'
      });

      if (!integracoes.length) {
        setResultados({
          erro: "Nenhuma integração Z-API conectada encontrada"
        });
        return;
      }

      const integracao = integracoes[0];

      // 1️⃣ Verificar se contato existe
      const contatos = await base44.entities.Contact.filter({
        telefone: numNorm
      });

      // 2️⃣ Buscar threads deste número
      const threads = await base44.entities.MessageThread.filter({
        contact_id: contatos[0]?.id || 'inexistente'
      });

      // 3️⃣ Buscar últimas mensagens
      let ultimaMensagem = null;
      let ultimoStatus = null;

      if (contatos[0]) {
        const mensagens = await base44.entities.Message.filter({
          sender_id: contatos[0].id
        }, '-created_date', 1);

        if (mensagens.length) {
          ultimaMensagem = mensagens[0];
          ultimoStatus = ultimaMensagem.status;
        }
      }

      // 4️⃣ Verificar bloqueios
      const bloqueado = contatos[0]?.bloqueado || false;
      const motivoBloqueio = contatos[0]?.motivo_bloqueio || null;

      // 5️⃣ Verificar se há logs de erro
      const logsErro = await base44.entities.WebhookLog.filter({
        source: 'z_api',
        nivel: 'erro'
      }, '-created_date', 5);

      const errosEsteNumero = logsErro.filter(log =>
        log.telefone === numNorm || log.payload?.phone === numNorm
      );

      setResultados({
        numero: numNorm,
        integracao: {
          id: integracao.id,
          nome: integracao.nome_instancia,
          numero_canal: integracao.numero_telefone,
          status: integracao.status
        },
        contato: contatos[0] ? {
          id: contatos[0].id,
          nome: contatos[0].nome,
          empresa: contatos[0].empresa,
          tipo: contatos[0].tipo_contato,
          criado_em: contatos[0].created_date
        } : null,
        threads: threads.length,
        ultimaMensagem,
        ultimoStatus,
        bloqueado,
        motivoBloqueio,
        errosRecentes: errosEsteNumero,
        diagnosticoCompleto: true
      });

    } catch (error) {
      console.error("[DiagnosticoZAPI]", error);
      setResultados({
        erro: error.message || "Erro ao executar diagnóstico"
      });
    } finally {
      setDiagnosticando(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          🔍 Diagnóstico Z-API por Número
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-2">
              Número de Contato (com ou sem +)
            </label>
            <Input
              placeholder="Exemplo: 554821025101 ou +554821025101"
              value={numeroTeste}
              onChange={(e) => setNumeroTeste(e.target.value)}
              className="font-mono"
            />
          </div>

          <Button
            onClick={executarDiagnostico}
            disabled={!numeroTeste.trim() || diagnosticando}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {diagnosticando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Diagnosticando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Executar Diagnóstico
              </>
            )}
          </Button>
        </div>
      </Card>

      {resultados && (
        <div className="space-y-3">
          {resultados.erro ? (
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-900">Erro no Diagnóstico</p>
                  <p className="text-sm text-red-700 mt-1">{resultados.erro}</p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* Integração */}
              <Card className="p-4 border-slate-200">
                <div className="flex items-start gap-3">
                  {resultados.integracao.status === 'conectado' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Integração Z-API</p>
                    <div className="mt-2 text-sm space-y-1 text-slate-600">
                      <p><strong>Nome:</strong> {resultados.integracao.nome}</p>
                      <p><strong>Canal:</strong> {resultados.integracao.numero_canal}</p>
                      <p>
                        <strong>Status:</strong>{" "}
                        <span className={
                          resultados.integracao.status === 'conectado'
                            ? 'text-green-600 font-semibold'
                            : 'text-red-600 font-semibold'
                        }>
                          {resultados.integracao.status === 'conectado' ? '🟢 Conectado' : '🔴 Desconectado'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Contato */}
              <Card className="p-4 border-slate-200">
                <div className="flex items-start gap-3">
                  {resultados.contato ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {resultados.numero}
                    </p>
                    
                    {resultados.contato ? (
                      <div className="mt-2 text-sm space-y-1 text-slate-600">
                        <p><strong>Nome:</strong> {resultados.contato.nome}</p>
                        <p><strong>Empresa:</strong> {resultados.contato.empresa || "Não informada"}</p>
                        <p><strong>Tipo:</strong> {resultados.contato.tipo}</p>
                        <p><strong>Cadastro:</strong> {new Date(resultados.contato.criado_em).toLocaleDateString('pt-BR')}</p>
                        <p>
                          <strong>Threads:</strong>{" "}
                          <span className="font-semibold text-blue-600">{resultados.threads}</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-orange-600 mt-2">
                        ⚠️ Contato não encontrado no sistema
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Última Mensagem */}
              {resultados.ultimaMensagem && (
                <Card className="p-4 border-slate-200">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">Última Mensagem</p>
                      <div className="mt-2 text-sm space-y-1 text-slate-600">
                        <p><strong>Status:</strong> {resultados.ultimoStatus}</p>
                        <p><strong>Data:</strong> {new Date(resultados.ultimaMensagem.created_date).toLocaleString('pt-BR')}</p>
                        <p className="mt-2 p-2 bg-slate-100 rounded text-slate-700 font-mono text-xs break-words">
                          {resultados.ultimaMensagem.content?.substring(0, 200)}
                          {resultados.ultimaMensagem.content?.length > 200 ? '...' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Bloqueio */}
              {resultados.bloqueado && (
                <Card className="p-4 border-red-200 bg-red-50">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-900">🚫 Contato Bloqueado</p>
                      <p className="text-sm text-red-700 mt-1">
                        {resultados.motivoBloqueio || "Motivo não especificado"}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Erros Recentes */}
              {resultados.errosRecentes.length > 0 && (
                <Card className="p-4 border-red-200 bg-red-50">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-900">❌ Erros Recentes</p>
                      <div className="mt-2 space-y-2">
                        {resultados.errosRecentes.map((erro, idx) => (
                          <div key={idx} className="text-sm bg-red-100 p-2 rounded border border-red-200">
                            <p className="font-mono text-xs text-red-700">{erro.mensagem || erro.payload?.error || "Erro desconhecido"}</p>
                            <p className="text-[10px] text-red-600 mt-1">
                              {new Date(erro.created_date).toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Recomendações */}
              <Card className="p-4 border-blue-200 bg-blue-50">
                <p className="font-semibold text-blue-900 mb-3">💡 Recomendações</p>
                <ul className="text-sm text-blue-800 space-y-2">
                  {!resultados.contato && (
                    <li>✅ Crie um novo contato para este número</li>
                  )}
                  {resultados.integracao.status !== 'conectado' && (
                    <li>⚠️ Z-API desconectado - reconecte em Configurações</li>
                  )}
                  {resultados.bloqueado && (
                    <li>🔓 Desbloqueie o contato para permitir comunicação</li>
                  )}
                  {resultados.errosRecentes.length > 0 && (
                    <li>🔍 Verifique os erros acima e tente novamente</li>
                  )}
                  {resultados.threads === 0 && resultados.contato && (
                    <li>📝 Nenhuma conversa com este contato - tente enviar uma mensagem</li>
                  )}
                </ul>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}