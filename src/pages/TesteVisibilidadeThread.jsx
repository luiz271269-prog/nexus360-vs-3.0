import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";

export default function TesteVisibilidadeThread() {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    carregarUsuario();
  }, []);

  const carregarUsuario = async () => {
    const user = await base44.auth.me();
    setUsuario(user);
  };

  const testar = async () => {
    setTestando(true);

    try {
      // Thread do Luiz que não está aparecendo
      const threadId = '693306f0ffbdced31cc623e3';

      // 1️⃣ Carregar a thread
      const threads = await base44.entities.MessageThread.filter({ id: threadId });
      const thread = threads[0];

      if (!thread) {
        setResultado({
          status: 'erro',
          msg: 'Thread não existe no banco',
          threadId
        });
        return;
      }

      // 2️⃣ Carregar TODAS as threads (sem filtro) para comparar
      const todasThreads = await base44.entities.MessageThread.list('-last_message_at', 100);

      // 3️⃣ Verificar se a thread aparece na lista
      const apareceNaLista = todasThreads.some(t => t.id === threadId);

      // 4️⃣ Buscar contato
      const contatos = await base44.entities.Contact.filter({ id: thread.contact_id });
      const contato = contatos[0];

      // 5️⃣ Buscar mensagens
      const msgs = await base44.entities.Message.filter(
        { thread_id: threadId },
        '-created_date',
        10
      );

      const resultado_analise = {
        status: 'ok',
        thread: {
          id: thread.id,
          contact_id: thread.contact_id,
          assigned_user_id: thread.assigned_user_id,
          sector_id: thread.sector_id,
          last_message_at: thread.last_message_at,
          unread_count: thread.unread_count,
          bloqueado: thread.bloqueado
        },
        contato: contato ? {
          nome: contato.nome,
          telefone: contato.telefone,
          bloqueado: contato.bloqueado
        } : null,
        messages: msgs.length,
        ultima_msg: msgs[0] ? msgs[0].content?.substring(0, 50) : null,

        visibilidade: {
          thread_existe: !!thread,
          aparece_em_todas_threads: apareceNaLista,
          posicao_na_lista: todasThreads.findIndex(t => t.id === threadId) + 1,
          total_threads: todasThreads.length
        },

        usuario_atual: {
          nome: usuario?.full_name,
          setor: usuario?.attendant_sector || 'N/A',
          role: usuario?.role,
          id: usuario?.id
        },

        diagnostico: []
      };

      // Análise
      if (!thread.last_message_at) {
        resultado_analise.diagnostico.push('❌ CRÍTICO: Thread SEM last_message_at - não aparecerá na lista');
      }

      if (!apareceNaLista) {
        resultado_analise.diagnostico.push('❌ PROBLEMA: Thread NÃO aparece em base44.entities.MessageThread.list()');
      }

      if (thread.bloqueado) {
        resultado_analise.diagnostico.push('🔒 Thread BLOQUEADA');
      }

      if (contato?.bloqueado) {
        resultado_analise.diagnostico.push('🔒 Contato BLOQUEADO');
      }

      if (thread.sector_id && thread.sector_id !== usuario?.attendant_sector && usuario?.role !== 'admin') {
        resultado_analise.diagnostico.push(`⚠️ Setor diferente: thread=${thread.sector_id}, user=${usuario?.attendant_sector}`);
      }

      if (!thread.assigned_user_id && usuario?.role !== 'admin') {
        resultado_analise.diagnostico.push('⚠️ Thread não atribuída - pode não ser visível para atendente comum');
      }

      if (resultado_analise.diagnostico.length === 0) {
        resultado_analise.diagnostico.push('✅ Sem bloqueios detectados - thread deveria estar visível');
      }

      setResultado(resultado_analise);

    } catch (error) {
      setResultado({
        status: 'erro',
        msg: error.message
      });
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h1 className="text-2xl font-bold text-blue-900 mb-2">🔍 Teste Direto: Thread do Luiz</h1>
        <p className="text-sm text-blue-700 mb-4">
          Carrega a thread que não está aparecendo e testa se ela existe e por que não aparece.
        </p>
        <Button onClick={testar} disabled={testando} className="w-full bg-blue-600">
          {testando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
          Testar Agora
        </Button>
      </Card>

      {resultado && resultado.status === 'erro' && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {resultado.msg}
          </AlertDescription>
        </Alert>
      )}

      {resultado && resultado.status === 'ok' && (
        <div className="space-y-4">
          {/* VISIBILIDADE */}
          <Card className={`p-4 ${resultado.visibilidade.aparece_em_todas_threads ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <h2 className="font-bold mb-3 flex items-center gap-2">
              {resultado.visibilidade.aparece_em_todas_threads ? 
                <Eye className="w-5 h-5 text-green-600" /> : 
                <EyeOff className="w-5 h-5 text-red-600" />
              }
              {resultado.visibilidade.aparece_em_todas_threads ? '✅ VISÍVEL' : '❌ NÃO VISÍVEL'}
            </h2>
            <div className="text-sm space-y-1">
              <p>Thread existe: {resultado.visibilidade.thread_existe ? '✅ SIM' : '❌ NÃO'}</p>
              <p>Aparece na lista: {resultado.visibilidade.aparece_em_todas_threads ? '✅ SIM' : '❌ NÃO'}</p>
              {resultado.visibilidade.aparece_em_todas_threads && (
                <p>Posição: <strong>#{resultado.visibilidade.posicao_na_lista}</strong> de {resultado.visibilidade.total_threads}</p>
              )}
            </div>
          </Card>

          {/* DADOS DA THREAD */}
          <Card className="p-4">
            <h2 className="font-bold mb-3">📋 Dados da Thread</h2>
            <div className="text-sm space-y-1 bg-slate-50 p-3 rounded">
              <p>Contato: <strong>{resultado.contato?.nome}</strong> ({resultado.contato?.telefone})</p>
              <p>Mensagens: <strong>{resultado.messages}</strong></p>
              <p>Não lidas: <strong className="text-orange-600">{resultado.thread.unread_count}</strong></p>
              <p>Última: <strong>{new Date(resultado.thread.last_message_at).toLocaleTimeString('pt-BR')}</strong></p>
              <p>Atribuída a: <strong>{resultado.thread.assigned_user_id ? resultado.thread.assigned_user_id.substring(0, 8) + '...' : 'Ninguém'}</strong></p>
              <p>Setor: <strong>{resultado.thread.sector_id || 'N/A'}</strong></p>
            </div>
          </Card>

          {/* DIAGNÓSTICO */}
          <Card className={`p-4 ${resultado.diagnostico.some(d => d.startsWith('❌')) ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <h2 className="font-bold mb-3">🔎 Diagnóstico</h2>
            <div className="space-y-2">
              {resultado.diagnostico.map((diag, idx) => (
                <p key={idx} className="text-sm">
                  {diag.startsWith('✅') ? '✅' : diag.startsWith('❌') ? '❌' : '⚠️'} {diag}
                </p>
              ))}
            </div>
          </Card>

          {/* SOLUÇÃO */}
          {!resultado.visibilidade.aparece_em_todas_threads && (
            <Card className="p-4 border-yellow-200 bg-yellow-50">
              <h2 className="font-bold text-yellow-900 mb-2">💡 Próximos Passos</h2>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>1. Verifique se há filtros ativos na Central de Comunicação (escopo, atendente, setor)</li>
                <li>2. Limpe o cache do navegador (F12 → Storage → Clear All)</li>
                <li>3. Recarregue a página</li>
                <li>4. Se ainda não aparecer, entre em contato com o administrador</li>
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}