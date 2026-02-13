import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, XCircle, AlertTriangle, Info, User, Shield, Phone } from 'lucide-react';
import { toast } from 'sonner';
import * as permissionsService from '../lib/permissionsService';

/**
 * 🔬 DIAGNÓSTICO CIRÚRGICO DE VISIBILIDADE
 * Mostra EXATAMENTE por que um contato está bloqueado para um usuário específico
 */
export default function DiagnosticoVisibilidadeContato({ integracoes = [] }) {
  const [telefoneContato, setTelefoneContato] = useState('');
  const [emailUsuario, setEmailUsuario] = useState('');
  const [diagnostico, setDiagnostico] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const executarDiagnostico = async () => {
    if (!telefoneContato.trim() || !emailUsuario.trim()) {
      toast.error('Preencha telefone do contato E email do usuário');
      return;
    }

    setCarregando(true);
    try {
      // 1. Buscar contato por telefone
      const telNorm = telefoneContato.replace(/\D/g, '');
      const todosContatos = await base44.entities.Contact.list('-created_date', 500);
      const contato = todosContatos.find(c => {
        const tel = (c.telefone || '').replace(/\D/g, '');
        return tel.includes(telNorm) || telNorm.includes(tel);
      });

      if (!contato) {
        toast.error(`❌ Contato com telefone "${telefoneContato}" não encontrado`);
        setCarregando(false);
        return;
      }

      // 2. Buscar usuário por email
      const todosUsuarios = await base44.entities.User.list('-created_date', 200);
      const usuario = todosUsuarios.find(u => 
        (u.email || '').toLowerCase().trim() === emailUsuario.toLowerCase().trim()
      );

      if (!usuario) {
        toast.error(`❌ Usuário "${emailUsuario}" não encontrado`);
        setCarregando(false);
        return;
      }

      // 3. Buscar thread(s) do contato
      const threads = await base44.entities.MessageThread.filter(
        { contact_id: contato.id },
        '-last_message_at',
        10
      );

      if (threads.length === 0) {
        setDiagnostico({
          contato,
          usuario,
          threads: [],
          semThread: true,
          motivo: 'Contato não possui thread (conversa) criada ainda'
        });
        setCarregando(false);
        return;
      }

      // 4. Construir permissões do usuário (igual Comunicacao.jsx)
      const userPermissions = permissionsService.buildUserPermissions(usuario, integracoes);

      // 5. Diagnosticar cada thread
      const diagnosticosThreads = threads.map(thread => {
        const resultado = permissionsService.diagnosticarVisibilidadeThread(
          userPermissions, 
          thread, 
          contato
        );

        // Buscar integração
        const integracao = integracoes.find(i => i.id === thread.whatsapp_integration_id);

        return {
          ...resultado,
          thread,
          integracao: integracao || null,
          assigned_user_id: thread.assigned_user_id,
          sector_id: thread.sector_id,
          status: thread.status,
          unread_count: thread.unread_count
        };
      });

      setDiagnostico({
        contato,
        usuario,
        userPermissions,
        threads: diagnosticosThreads,
        semThread: false
      });

      setCarregando(false);
      toast.success('✅ Diagnóstico concluído!');

    } catch (error) {
      console.error('[DIAGNOSTICO] Erro:', error);
      toast.error(`Erro: ${error.message}`);
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <Shield className="w-5 h-5" />
            🔬 Diagnóstico de Visibilidade - Por que o contato não aparece?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">
                <Phone className="w-4 h-4 inline mr-1" />
                Telefone do Contato
              </label>
              <input
                type="text"
                value={telefoneContato}
                onChange={(e) => setTelefoneContato(e.target.value)}
                placeholder="Ex: 48999322400"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">
                <User className="w-4 h-4 inline mr-1" />
                Email do Usuário
              </label>
              <input
                type="email"
                value={emailUsuario}
                onChange={(e) => setEmailUsuario(e.target.value)}
                placeholder="Ex: thais@liesch.com.br"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <Button
            onClick={executarDiagnostico}
            disabled={carregando}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {carregando ? 'Analisando...' : 'Executar Diagnóstico'}
            <Search className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {diagnostico && (
        <Card className="border-2 border-blue-300">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-blue-900">
              📋 Resultado do Diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Informações Básicas */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">👤 CONTATO</p>
                <p className="font-bold text-slate-800">{diagnostico.contato.nome}</p>
                <p className="text-xs text-slate-600">{diagnostico.contato.telefone}</p>
                <Badge className="mt-1 bg-blue-100 text-blue-800">
                  {diagnostico.contato.tipo_contato || 'novo'}
                </Badge>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">👨‍💼 USUÁRIO</p>
                <p className="font-bold text-slate-800">{diagnostico.usuario.full_name}</p>
                <p className="text-xs text-slate-600">{diagnostico.usuario.email}</p>
                <div className="flex gap-1 mt-1">
                  <Badge className="bg-purple-100 text-purple-800">
                    {diagnostico.usuario.role}
                  </Badge>
                  <Badge className="bg-orange-100 text-orange-800">
                    {diagnostico.usuario.attendant_sector || 'geral'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Sem Thread */}
            {diagnostico.semThread && (
              <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <p className="font-bold text-yellow-800">Contato sem conversa ativa</p>
                </div>
                <p className="text-sm text-yellow-700">{diagnostico.motivo}</p>
              </div>
            )}

            {/* Análise de Threads */}
            {diagnostico.threads && diagnostico.threads.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  {diagnostico.threads.length} Thread(s) Encontrada(s)
                </h3>

                {diagnostico.threads.map((diag, idx) => (
                  <Card key={idx} className={`border-2 ${diag.visible ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {diag.visible ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          Thread #{idx + 1} - {diag.visible ? 'VISÍVEL' : 'BLOQUEADA'}
                        </CardTitle>
                        <Badge className={diag.visible ? 'bg-green-600' : 'bg-red-600'}>
                          {diag.reason_code}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Motivo Principal */}
                      <div className={`p-3 rounded-lg ${diag.visible ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                        <p className="text-sm font-semibold mb-1">
                          {diag.visible ? '✅ Motivo da Liberação:' : '🔒 Motivo do Bloqueio:'}
                        </p>
                        <p className="text-sm">{diag.motivo}</p>
                      </div>

                      {/* Detalhes da Thread */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <p className="font-semibold text-slate-600 mb-1">ID da Thread</p>
                          <p className="text-slate-800 font-mono">{diag.thread.id.substring(0, 8)}...</p>
                        </div>

                        <div className="p-2 bg-white rounded border border-slate-200">
                          <p className="font-semibold text-slate-600 mb-1">Status</p>
                          <Badge className="text-xs">{diag.status}</Badge>
                        </div>

                        <div className="p-2 bg-white rounded border border-slate-200">
                          <p className="font-semibold text-slate-600 mb-1">Atribuída a</p>
                          <p className="text-slate-800 truncate">
                            {diag.assigned_user_id 
                              ? `${diag.assigned_user_id.substring(0, 8)}...`
                              : '❌ Não atribuída'}
                          </p>
                        </div>

                        <div className="p-2 bg-white rounded border border-slate-200">
                          <p className="font-semibold text-slate-600 mb-1">Setor</p>
                          <p className="text-slate-800">{diag.sector_id || '❌ Sem setor'}</p>
                        </div>

                        <div className="p-2 bg-white rounded border border-slate-200">
                          <p className="font-semibold text-slate-600 mb-1">Integração</p>
                          <p className="text-slate-800 text-xs truncate">
                            {diag.integracao?.nome_instancia || '❌ Sem integração'}
                          </p>
                        </div>

                        <div className="p-2 bg-white rounded border border-slate-200">
                          <p className="font-semibold text-slate-600 mb-1">Não lidas</p>
                          <Badge className={diag.unread_count > 0 ? 'bg-red-500' : 'bg-green-500'}>
                            {diag.unread_count || 0}
                          </Badge>
                        </div>
                      </div>

                      {/* Decision Path (Caminho da Decisão) */}
                      {diag.decision_path && diag.decision_path.length > 0 && (
                        <div className="p-3 bg-slate-100 rounded-lg border border-slate-300">
                          <p className="text-xs font-semibold text-slate-700 mb-2">
                            🔍 Caminho da Decisão:
                          </p>
                          <div className="space-y-1">
                            {diag.decision_path.map((step, i) => {
                              const isAllow = step.startsWith('ALLOW:');
                              const isDeny = step.startsWith('DENY:');
                              const label = step.replace(/^(ALLOW|DENY):/, '');
                              
                              return (
                                <div key={i} className="flex items-center gap-2">
                                  {isAllow && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                                  {isDeny && <XCircle className="w-3 h-3 text-red-600" />}
                                  <span className={`text-xs font-mono ${isAllow ? 'text-green-700' : 'text-red-700'}`}>
                                    {i + 1}. {label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Metadados Adicionais */}
                      {diag.metadata && Object.keys(diag.metadata).length > 0 && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs font-semibold text-blue-800 mb-2">
                            📊 Informações Adicionais:
                          </p>
                          <pre className="text-xs text-blue-700 whitespace-pre-wrap font-mono">
                            {JSON.stringify(diag.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Permissões do Usuário */}
            {diagnostico.userPermissions && (
              <Card className="border-2 border-indigo-300">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
                  <CardTitle className="text-sm text-indigo-900">
                    🔐 Permissões do Usuário
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-white rounded border">
                      <p className="text-xs text-slate-600">Role</p>
                      <Badge className="mt-1">{diagnostico.userPermissions.role}</Badge>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <p className="text-xs text-slate-600">Nível</p>
                      <Badge className="mt-1 bg-orange-100 text-orange-800">
                        {diagnostico.userPermissions.attendant_role}
                      </Badge>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <p className="text-xs text-slate-600">Setor</p>
                      <Badge className="mt-1 bg-blue-100 text-blue-800">
                        {diagnostico.userPermissions.attendant_sector}
                      </Badge>
                    </div>
                  </div>

                  {/* Integrações Permitidas */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      📱 Integrações WhatsApp Permitidas:
                    </p>
                    <div className="space-y-1">
                      {Object.entries(diagnostico.userPermissions.integracoes || {}).map(([integId, perm]) => (
                        <div key={integId} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 truncate flex-1">
                            {perm.integration_name}
                          </span>
                          <div className="flex gap-1 ml-2">
                            <Badge className={perm.can_view ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {perm.can_view ? '👁️ Ver' : '🚫 Ver'}
                            </Badge>
                            <Badge className={perm.can_send ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {perm.can_send ? '✉️ Enviar' : '🚫 Enviar'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Setores Bloqueados */}
                  {diagnostico.userPermissions.setoresBloqueados?.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-800 mb-1">
                        🚫 Setores Bloqueados:
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {diagnostico.userPermissions.setoresBloqueados.map(setor => (
                          <Badge key={setor} className="bg-red-200 text-red-800 text-xs">
                            {setor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Resumo Final */}
            {diagnostico && !diagnostico.semThread && (
              <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
                <CardHeader>
                  <CardTitle className="text-amber-900 text-sm">
                    💡 Resumo e Solução
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {diagnostico.threads.some(t => t.visible) ? (
                    <div className="space-y-2">
                      <p className="text-sm text-green-700 font-semibold">
                        ✅ O usuário PODE ver pelo menos uma thread deste contato!
                      </p>
                      <p className="text-xs text-slate-600">
                        {diagnostico.threads.filter(t => t.visible).length} de {diagnostico.threads.length} thread(s) visível(is).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-red-700 font-semibold">
                        ❌ O usuário NÃO pode ver nenhuma thread deste contato.
                      </p>
                      
                      <div className="p-3 bg-white rounded-lg border border-amber-300">
                        <p className="text-xs font-semibold text-amber-800 mb-2">🔧 Soluções possíveis:</p>
                        <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                          {diagnostico.threads[0]?.reason_code === 'INTEGRATION_BLOCKED' && (
                            <li>Liberar acesso à integração <strong>{diagnostico.threads[0]?.integracao?.nome_instancia}</strong> nas permissões do usuário</li>
                          )}
                          {diagnostico.threads[0]?.reason_code === 'ASSIGNED_TO_ANOTHER' && (
                            <li>Transferir a conversa para este usuário OU ativar modo "Todas as Conversas" para gerentes</li>
                          )}
                          {diagnostico.threads[0]?.reason_code === 'SECTOR_BLOCKED' && (
                            <li>Remover bloqueio do setor <strong>{diagnostico.threads[0]?.metadata?.setor}</strong> ou mudar setor do usuário</li>
                          )}
                          {diagnostico.threads[0]?.reason_code === 'LOYAL_TO_ANOTHER' && (
                            <li>Contato fidelizado a outro atendente - remover fidelização ou mudar para este usuário</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}