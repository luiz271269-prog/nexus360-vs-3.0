import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search } from "lucide-react";

export default function TesteOndeEstaaThread() {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const testar = async () => {
    setTestando(true);

    try {
      const threadId = '693306f0ffbdced31cc623e3'; // Thread do Luiz

      // Buscar a thread
      const threads = await base44.entities.MessageThread.filter({ id: threadId });
      const thread = threads[0];

      if (!thread) {
        setResultado({ erro: 'Thread não encontrada' });
        setTestando(false);
        return;
      }

      // Buscar contato
      const contatos = await base44.entities.Contact.filter({ id: thread.contact_id });
      const contato = contatos[0];

      // Verificar por que NÃO aparece em "Não Atribuídas"
      const resultado_teste = {
        thread: {
          id: thread.id,
          contact: contato?.nome,
          unread: thread.unread_count,
          assigned_user_id: thread.assigned_user_id,
          sector_id: thread.sector_id,
          bloqueado: thread.bloqueado,
          last_message_at: thread.last_message_at
        },

        analise: {}
      };

      // 1️⃣ Se está atribuída, NÃO entra em "Não Atribuídas"
      if (thread.assigned_user_id) {
        resultado_teste.analise.nao_atribuidas = {
          aparece: false,
          razao: `❌ THREAD ESTÁ ATRIBUÍDA a ${thread.assigned_user_id}`,
          solucao: 'Desatribuir a thread para que apareça em "Não Atribuídas"'
        };
      } else {
        resultado_teste.analise.nao_atribuidas = {
          aparece: true,
          razao: '✅ Thread NÃO atribuída - deveria estar em "Não Atribuídas"',
          solucao: 'Se não aparece, há filtro ativo'
        };
      }

      // 2️⃣ Verificar setor
      if (!thread.sector_id) {
        resultado_teste.analise.setor = {
          categoria: '(Sem Setor Definido)',
          aparece: true,
          razao: '✅ Deveria estar em "Por Setor > (Sem Setor Definido)"'
        };
      } else {
        resultado_teste.analise.setor = {
          categoria: thread.sector_id,
          aparece: true,
          razao: `✅ Deveria estar em "Por Setor > ${thread.sector_id}"`
        };
      }

      // 3️⃣ Verificar integração
      if (thread.whatsapp_integration_id) {
        resultado_teste.analise.integracao = {
          id: thread.whatsapp_integration_id,
          aparece: true,
          razao: '✅ Deveria estar em "Por Conexão WhatsApp"'
        };
      }

      // 4️⃣ Verificar bloqueios
      if (thread.bloqueado || contato?.bloqueado) {
        resultado_teste.analise.bloqueio = {
          bloqueado: true,
          razao: `❌ ${thread.bloqueado ? 'THREAD' : 'CONTATO'} BLOQUEADO`,
          solucao: 'Desbloquear para que a thread apareça'
        };
      }

      // 5️⃣ Verificar se tem last_message_at
      if (!thread.last_message_at) {
        resultado_teste.analise.last_message = {
          tem: false,
          razao: '❌ CRÍTICO: Sem last_message_at - não aparece em lugar nenhum',
          solucao: 'Há bug no webhook ao salvar a thread'
        };
      } else {
        resultado_teste.analise.last_message = {
          tem: true,
          razao: '✅ Tem last_message_at',
          valor: new Date(thread.last_message_at).toLocaleTimeString('pt-BR')
        };
      }

      setResultado(resultado_teste);

    } catch (error) {
      setResultado({ erro: error.message });
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <Card className="p-4 bg-indigo-50 border-indigo-200">
        <h1 className="text-2xl font-bold text-indigo-900 mb-2">🔎 Onde está a thread do Luiz?</h1>
        <p className="text-sm text-indigo-700 mb-4">
          Analisa por que ela não aparece em "Conversas Requerendo Atenção"
        </p>
        <Button onClick={testar} disabled={testando} className="w-full bg-indigo-600">
          {testando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Buscar Thread
        </Button>
      </Card>

      {resultado && resultado.erro && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-700">{resultado.erro}</AlertDescription>
        </Alert>
      )}

      {resultado && !resultado.erro && (
        <div className="space-y-4">
          {/* DADOS DA THREAD */}
          <Card className="p-4 bg-slate-50">
            <h2 className="font-bold mb-3">📋 Thread: {resultado.thread.contact}</h2>
            <div className="text-sm space-y-1">
              <p>🔴 Não lidas: <strong className="text-red-600">{resultado.thread.unread}</strong></p>
              <p>Atribuída a: <strong>{resultado.thread.assigned_user_id ? resultado.thread.assigned_user_id.substring(0, 8) : 'NINGUÉM'}</strong></p>
              <p>Setor: <strong>{resultado.thread.sector_id || '(Sem setor)'}</strong></p>
              <p>Bloqueada: {resultado.thread.bloqueado ? '🔒 SIM' : '✅ NÃO'}</p>
              <p>Última msg: <strong>{resultado.thread.last_message_at ? new Date(resultado.thread.last_message_at).toLocaleTimeString('pt-BR') : 'NENHUMA'}</strong></p>
            </div>
          </Card>

          {/* ANÁLISE */}
          <div className="space-y-3">
            {resultado.analise.nao_atribuidas && (
              <Card className={`p-4 ${resultado.analise.nao_atribuidas.aparece ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <h3 className="font-bold mb-2">📍 "Não Atribuídas"</h3>
                <p className="text-sm mb-2">{resultado.analise.nao_atribuidas.razao}</p>
                {resultado.analise.nao_atribuidas.solucao && (
                  <p className="text-xs bg-white p-2 rounded border">💡 {resultado.analise.nao_atribuidas.solucao}</p>
                )}
              </Card>
            )}

            {resultado.analise.setor && (
              <Card className="p-4 bg-green-50 border-green-200">
                <h3 className="font-bold mb-2">📍 "Por Setor"</h3>
                <p className="text-sm">{resultado.analise.setor.razao}</p>
                <p className="text-xs text-slate-600 mt-2">Categoria: <strong>{resultado.analise.setor.categoria}</strong></p>
              </Card>
            )}

            {resultado.analise.integracao && (
              <Card className="p-4 bg-green-50 border-green-200">
                <h3 className="font-bold mb-2">📍 "Por Conexão WhatsApp"</h3>
                <p className="text-sm">{resultado.analise.integracao.razao}</p>
              </Card>
            )}

            {resultado.analise.bloqueio && (
              <Card className="p-4 bg-red-50 border-red-200">
                <h3 className="font-bold text-red-900 mb-2">🔒 Bloqueio</h3>
                <p className="text-sm text-red-700">{resultado.analise.bloqueio.razao}</p>
                <p className="text-xs text-red-600 mt-2">✏️ {resultado.analise.bloqueio.solucao}</p>
              </Card>
            )}

            {resultado.analise.last_message && !resultado.analise.last_message.tem && (
              <Card className="p-4 bg-red-50 border-red-200">
                <h3 className="font-bold text-red-900 mb-2">⚠️ Problema Crítico</h3>
                <p className="text-sm text-red-700">{resultado.analise.last_message.razao}</p>
                <p className="text-xs text-red-600 mt-2">✏️ {resultado.analise.last_message.solucao}</p>
              </Card>
            )}
          </div>

          {/* RESUMO */}
          <Card className="p-4 border-blue-200 bg-blue-50">
            <h3 className="font-bold text-blue-900 mb-2">📌 Resumo</h3>
            <p className="text-sm text-blue-700">
              A thread {resultado.analise.nao_atribuidas?.aparece ? '**deveria aparecer**' : '**não deveria aparecer**'} em "Não Atribuídas".
              <br/>
              Ela {resultado.analise.setor?.aparece ? '**deveria aparecer**' : '**não deveria aparecer**'} em "Por Setor - {resultado.analise.setor?.categoria}".
              {resultado.analise.bloqueio && <br/>}
              {resultado.analise.bloqueio && 'Mas está **bloqueada**, então não aparece em lugar nenhum.'}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}