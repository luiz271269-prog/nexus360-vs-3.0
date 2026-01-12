import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Phone, MessageCircle, AlertCircle, CheckCircle } from "lucide-react";
import { normalizarTelefone } from "@/components/lib/phoneUtils";

export default function DiagnosticoContato() {
  const [telefone, setTelefone] = useState('5547996744257');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const analisar = async () => {
    setCarregando(true);
    setResultado(null);

    try {
      const telefonNormalizado = normalizarTelefone(telefone);
      if (!telefonNormalizado) {
        setResultado({ erro: 'Telefone inválido' });
        setCarregando(false);
        return;
      }

      // 1️⃣ Buscar TODOS os contatos com este telefone
      const contatosComTelefone = await base44.entities.Contact.filter({ 
        telefone: telefonNormalizado 
      });

      // 2️⃣ Buscar mensagens de hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      // Buscar todas as mensagens do dia
      const todasMensagensHoje = await base44.entities.Message.filter({});
      
      const mensagensHoje = todasMensagensHoje.filter(msg => {
        const dataMgs = new Date(msg.sent_at || msg.created_date);
        return dataMgs >= hoje && dataMgs < amanha;
      }).filter(msg => {
        // Verificar se é do contato ou da thread
        if (contatosComTelefone.length > 0) {
          return contatosComTelefone.some(c => c.id === msg.sender_id);
        }
        return false;
      });

      // 3️⃣ Buscar threads do contato
      const threadsDoPrimeiro = contatosComTelefone.length > 0 
        ? await base44.entities.MessageThread.filter({ 
            contact_id: contatosComTelefone[0].id 
          })
        : [];

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
        mensagensHoje: {
          total: mensagensHoje.length,
          mensagens: mensagensHoje.map(m => ({
            id: m.id,
            conteudo: m.content?.substring(0, 100) || '(sem texto)',
            tipo: m.media_type,
            horario: new Date(m.sent_at || m.created_date).toLocaleTimeString('pt-BR'),
            status: m.status
          }))
        },
        threads: threadsDoPrimeiro.map(t => ({
          id: t.id,
          ultima_mensagem: new Date(t.last_message_at).toLocaleTimeString('pt-BR'),
          nao_lidas: t.unread_count,
          atribuida: t.assigned_user_id ? 'Sim' : 'Não'
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
            placeholder="Telefone (ex: 5547996744257)"
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

          {/* MENSAGENS HOJE */}
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3 mb-3">
              <MessageCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-amber-900">
                  📨 {resultado.mensagensHoje.total} mensagens recebidas HOJE
                </h2>
              </div>
            </div>

            {resultado.mensagensHoje.total === 0 ? (
              <p className="text-sm text-amber-700">Nenhuma mensagem recebida hoje</p>
            ) : (
              <div className="space-y-2">
                {resultado.mensagensHoje.mensagens.map(m => (
                  <div key={m.id} className="bg-white p-3 rounded border text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <strong>{m.horario}</strong>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        m.status === 'recebida' ? 'bg-green-100 text-green-700' :
                        m.status === 'entregue' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                    <p className="text-slate-700">{m.conteudo}</p>
                    {m.tipo !== 'none' && (
                      <p className="text-xs text-slate-500 mt-1">📎 {m.tipo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* THREADS */}
          <Card className="p-4 bg-violet-50 border-violet-200">
            <h2 className="font-bold text-violet-900 mb-3">🧵 {resultado.threads.length} threads ativas</h2>
            
            {resultado.threads.length === 0 ? (
              <p className="text-sm text-violet-700">Nenhuma thread encontrada</p>
            ) : (
              <div className="space-y-2">
                {resultado.threads.map(t => (
                  <div key={t.id} className="bg-white p-3 rounded border text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-xs text-slate-600">{t.id.substring(0, 12)}...</p>
                        <p className="text-xs text-slate-600 mt-1">Última msg: <strong>{t.ultima_mensagem}</strong></p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-600">{t.nao_lidas} 🔴</p>
                        <p className="text-xs text-slate-600">Atribuída: {t.atribuida}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}