import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Phone, MessageCircle, AlertCircle, CheckCircle } from "lucide-react";
import { normalizarTelefone } from "@/components/lib/phoneUtils";
import DiagnosticoVisibilidadeRealtime from "../components/comunicacao/DiagnosticoVisibilidadeRealtime";

export default function DiagnosticoContato() {
  const [telefone, setTelefone] = useState('5547996744257');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const analisar = async () => {
    setCarregando(true);
    setResultado(null);

    try {
      let contatosComTelefone = [];

      // ✅ DETECTAR SE É ID DE CONTATO OU TELEFONE
      const inputLimpo = telefone.trim();
      const ehUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputLimpo);

      if (ehUUID) {
        // 🆔 BUSCAR POR ID ÚNICO
        console.log(`[DiagnosticoContato] Buscando por ID: ${inputLimpo}`);
        try {
          const contato = await base44.entities.Contact.filter({ id: inputLimpo });
          contatosComTelefone = contato ? [contato].flat() : [];
          
          // Buscar outros contatos com mesmo telefone para análise de duplicidade
          if (contatosComTelefone.length > 0 && contatosComTelefone[0].telefone) {
            const { buscarContatosPorTelefone } = await import('../components/lib/deduplicationEngine');
            const todosComMesmoTelefone = await buscarContatosPorTelefone(base44, contatosComTelefone[0].telefone);
            // Mesclar, priorizando o contato buscado
            contatosComTelefone = todosComMesmoTelefone;
          }
        } catch (err) {
          console.error('[DiagnosticoContato] Erro ao buscar por ID:', err);
          setResultado({ erro: 'Contato não encontrado com este ID' });
          setCarregando(false);
          return;
        }
      } else {
        // 📱 BUSCAR POR TELEFONE (agnóstico de provedor)
        const { buscarContatosPorTelefone } = await import('../components/lib/deduplicationEngine');
        const telefonNormalizado = normalizarTelefone(inputLimpo);
        
        if (!telefonNormalizado) {
          setResultado({ erro: 'Telefone inválido' });
          setCarregando(false);
          return;
        }

        contatosComTelefone = await buscarContatosPorTelefone(base44, telefonNormalizado);
      }

      // 2️⃣ Determinar range de hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeISO = hoje.toISOString();
      
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      amanha.setHours(0, 0, 0, 0);
      const amanhaISO = amanha.toISOString();

      // 3️⃣ Para cada contato: buscar threads e mensagens separadamente
      const contatosAnalise = await Promise.all(
        contatosComTelefone.map(async (contato) => {
          // Threads do contato
          const threads = await base44.entities.MessageThread.filter({ 
            contact_id: contato.id 
          });

          // Mensagens RECEBIDAS (sender_type: 'contact') - SEM filtro de data no servidor, faz em memória
          const msgsRecebidas = await base44.entities.Message.filter(
            { sender_id: contato.id, sender_type: 'contact' },
            '-sent_at',
            200
          );
          const msgsRecebidashoje = msgsRecebidas.filter(msg => {
            const data = new Date(msg.sent_at || msg.created_date);
            return data >= hoje && data < amanha;
          });

          // Mensagens ENVIADAS (sender_type: 'agent') - por conta_id
          const msgsEnviadas = await base44.entities.Message.filter(
            { recipient_id: contato.id, sender_type: 'agent' },
            '-sent_at',
            200
          );
          const msgsEnviadasHoje = msgsEnviadas.filter(msg => {
            const data = new Date(msg.sent_at || msg.created_date);
            return data >= hoje && data < amanha;
          });

          return {
            contato,
            threads,
            msgsRecebidashoje,
            msgsEnviadasHoje
          };
        })
      );

      setResultado({
        telefone: telefonNormalizado,
        contatosDuplicados: {
          total: contatosComTelefone.length,
          contatos: contatosComTelefone.map(c => ({
            id: c.id,
            nome: c.nome,
            tipo: c.tipo_contato,
            bloqueado: c.bloqueado,
            created_date: c.created_date
          }))
        },
        analiseDetalhadaPorContato: contatosAnalise.map(analise => ({
          contato: {
            id: analise.contato.id,
            nome: analise.contato.nome,
            tipo: analise.contato.tipo_contato
          },
          threads: analise.threads.map(t => ({
            id: t.id,
            ultima_mensagem: t.last_message_at ? new Date(t.last_message_at).toLocaleTimeString('pt-BR') : 'N/A',
            nao_lidas: t.unread_count,
            atribuida: t.assigned_user_id ? 'Sim' : 'Não',
            status: t.status
          })),
          mensagensRecebidashoje: {
            total: analise.msgsRecebidashoje.length,
            lista: analise.msgsRecebidashoje.slice(0, 20).map(m => ({
              id: m.id,
              conteudo: m.content?.substring(0, 80) || '(sem texto)',
              tipo: m.media_type,
              horario: new Date(m.sent_at || m.created_date).toLocaleTimeString('pt-BR'),
              status: m.status
            }))
          },
          mensagensEnviadasHoje: {
            total: analise.msgsEnviadasHoje.length,
            lista: analise.msgsEnviadasHoje.slice(0, 20).map(m => ({
              id: m.id,
              conteudo: m.content?.substring(0, 80) || '(sem texto)',
              tipo: m.media_type,
              horario: new Date(m.sent_at || m.created_date).toLocaleTimeString('pt-BR'),
              status: m.status
            }))
          }
        }))
      });

    } catch (error) {
      console.error('[DiagnosticoContato]', error);
      setResultado({ erro: error.message });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h1 className="text-2xl font-bold text-blue-900 mb-4">📞 Diagnóstico de Contato</h1>
        
        <div className="flex gap-2">
          <Input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="Telefone ou ID do contato"
            className="flex-1"
          />
          <Button onClick={analisar} disabled={carregando} className="bg-blue-600">
            {carregando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
            Analisar
          </Button>
        </div>
      </Card>

      {resultado?.erro && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-700 ml-2">{resultado.erro}</AlertDescription>
        </Alert>
      )}

      {resultado && !resultado.erro && (
        <div className="space-y-4">
          {/* DUPLICATAS */}
          <Card className={`p-4 ${resultado.contatosDuplicados.total > 1 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-start gap-3">
              {resultado.contatosDuplicados.total > 1 ? (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h2 className={`font-bold mb-2 ${resultado.contatosDuplicados.total > 1 ? 'text-red-900' : 'text-green-900'}`}>
                  {resultado.contatosDuplicados.total > 1 
                    ? `⚠️ ${resultado.contatosDuplicados.total} CONTATOS DUPLICADOS` 
                    : `✅ Apenas 1 contato com este telefone`}
                </h2>
                
                <div className="space-y-2">
                  {resultado.contatosDuplicados.contatos.map((c, i) => (
                    <div key={c.id} className="bg-white p-3 rounded border text-sm">
                      <div className="font-semibold">{i + 1}. {c.nome} {c.bloqueado ? '🔒' : ''}</div>
                      <div className="text-xs text-slate-600 space-y-1 mt-1">
                        <p>ID: <code className="bg-slate-100 px-1 rounded">{c.id.substring(0, 8)}...</code></p>
                        <p>Tipo: <strong>{c.tipo}</strong></p>
                        <p>Criado: {new Date(c.created_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* ANÁLISE DETALHADA POR CONTATO */}
          {resultado.analiseDetalhadaPorContato.map((analise, idx) => (
            <div key={analise.contato.id} className="space-y-2 border-l-4 border-indigo-300 pl-4">
              <h3 className="font-bold text-indigo-900">📊 Contato {idx + 1}: {analise.contato.nome}</h3>

              {/* THREADS */}
              <Card className="p-3 bg-violet-50 border-violet-200">
                <p className="text-xs font-bold text-violet-900 mb-2">🧵 {analise.threads.length} threads</p>
                {analise.threads.length === 0 ? (
                  <p className="text-xs text-violet-700">Nenhuma thread</p>
                ) : (
                  <div className="space-y-1">
                    {analise.threads.map(t => (
                      <div key={t.id} className="bg-white p-2 rounded border text-xs">
                        <div className="flex justify-between">
                          <span className="font-mono">{t.id.substring(0, 8)}...</span>
                          <span className="text-red-600 font-bold">{t.nao_lidas} 🔴</span>
                        </div>
                        <p className="text-slate-600">Última: {t.ultima_mensagem} | Atribuída: {t.atribuida}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* MENSAGENS RECEBIDAS */}
              <Card className="p-3 bg-green-50 border-green-200">
                <p className="text-xs font-bold text-green-900 mb-2">📥 {analise.mensagensRecebidashoje.total} mensagens RECEBIDAS hoje</p>
                {analise.mensagensRecebidashoje.total === 0 ? (
                  <p className="text-xs text-green-700">Nenhuma</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {analise.mensagensRecebidashoje.lista.map(m => (
                      <div key={m.id} className="bg-white p-2 rounded border text-xs">
                        <div className="flex justify-between">
                          <strong>{m.horario}</strong>
                          <span className="text-green-600">{m.status}</span>
                        </div>
                        <p className="text-slate-700 truncate">{m.conteudo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* MENSAGENS ENVIADAS */}
              <Card className="p-3 bg-blue-50 border-blue-200">
                <p className="text-xs font-bold text-blue-900 mb-2">📤 {analise.mensagensEnviadasHoje.total} mensagens ENVIADAS hoje</p>
                {analise.mensagensEnviadasHoje.total === 0 ? (
                  <p className="text-xs text-blue-700">Nenhuma</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {analise.mensagensEnviadasHoje.lista.map(m => (
                      <div key={m.id} className="bg-white p-2 rounded border text-xs">
                        <div className="flex justify-between">
                          <strong>{m.horario}</strong>
                          <span className="text-blue-600">{m.status}</span>
                        </div>
                        <p className="text-slate-700 truncate">{m.conteudo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ))}

          {/* DIAGNÓSTICO REALTIME */}
          {resultado.analiseDetalhadaPorContato.length > 0 && resultado.analiseDetalhadaPorContato[0].threads.length > 0 && (
            <Card className="p-4 bg-slate-50 border-slate-300">
              <h3 className="font-bold text-slate-900 mb-3">🔍 Diagnóstico Real-time</h3>
              <DiagnosticoVisibilidadeRealtime
                threadAtiva={resultado.analiseDetalhadaPorContato[0].threads[0].id ? {
                  id: resultado.analiseDetalhadaPorContato[0].threads[0].id
                } : null}
                filterScope="all"
                selectedIntegrationId="all"
                selectedAttendantId={null}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}