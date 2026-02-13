import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import * as permissionsService from '../components/lib/permissionsService';

export default function DiagnosticoThaisSical() {
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const executarDiagnostico = async () => {
    setCarregando(true);
    try {
      // 1. Buscar usuário Thais (email exato para garantir precisão)
      const todosUsuarios = await base44.entities.User.list('-created_date', 200);
      const thais = todosUsuarios.find(u => 
        (u.email || '').toLowerCase() === 'vendas5@liesch.com.br'
      );

      if (!thais) {
        alert('❌ Usuário Thais não encontrado');
        setCarregando(false);
        return;
      }

      // 2. Buscar contatos "sical" (aumentado para 1000 para garantir que pegue todos)
      const todosContatos = await base44.entities.Contact.list('-created_date', 1000);
      const contatosSical = todosContatos.filter(c => 
        (c.nome || '').toLowerCase().includes('sical') ||
        (c.empresa || '').toLowerCase().includes('sical')
      );

      // 3. Buscar integrações
      const integracoes = await base44.entities.WhatsAppIntegration.list('-created_date', 50);

      // 4. Montar permissões da Thais
      const userPermissions = permissionsService.buildUserPermissions(thais, integracoes);

      // 5. Para cada contato sical, verificar fidelização e threads
      const analise = [];
      for (const contato of contatosSical) {
        // Verificar se Thais está fidelizada
        const isFidelizado = permissionsService.isFidelizadoAoUsuario(userPermissions, contato);
        
        // Buscar threads
        const threads = await base44.entities.MessageThread.filter(
          { contact_id: contato.id },
          '-last_message_at',
          50
        );

        // Diagnosticar cada thread
        const threadsAnalise = threads.map(thread => {
          const diagnostico = permissionsService.diagnosticarVisibilidadeThread(
            userPermissions,
            thread,
            contato
          );

          return {
            thread,
            visible: diagnostico.visible,
            motivo: diagnostico.motivo,
            reason_code: diagnostico.reason_code,
            decision_path: diagnostico.decision_path
          };
        });

        analise.push({
          contato,
          isFidelizado,
          camposFidelizacao: {
            atendente_fidelizado_vendas: contato.atendente_fidelizado_vendas,
            atendente_fidelizado_assistencia: contato.atendente_fidelizado_assistencia,
            atendente_fidelizado_financeiro: contato.atendente_fidelizado_financeiro,
            atendente_fidelizado_fornecedor: contato.atendente_fidelizado_fornecedor,
            is_cliente_fidelizado: contato.is_cliente_fidelizado
          },
          threads: threadsAnalise,
          totalThreads: threads.length,
          threadsVisiveis: threadsAnalise.filter(t => t.visible).length,
          threadsBloqueadas: threadsAnalise.filter(t => !t.visible).length
        });
      }

      setResultado({
        thais,
        userPermissions,
        contatosEncontrados: contatosSical.length,
        analise
      });

    } catch (error) {
      console.error('[DIAGNOSTICO] Erro:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card className="border-2 border-purple-300">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            🔬 Diagnóstico: Por que Thais não vê "Compras Sical"?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Button onClick={executarDiagnostico} disabled={carregando} className="w-full bg-purple-600 hover:bg-purple-700">
            {carregando ? 'Analisando...' : 'Executar Diagnóstico Completo'}
          </Button>

          {resultado && (
            <div className="space-y-4">
              {/* Usuário Thais */}
              <Card className="border-2 border-blue-300">
                <CardHeader className="pb-3 bg-blue-50">
                  <CardTitle className="text-sm">👨‍💼 Usuário: {resultado.thais.full_name}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-white rounded border">
                      <p className="text-slate-600 font-semibold">Email</p>
                      <p className="font-mono text-[10px]">{resultado.thais.email}</p>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <p className="text-slate-600 font-semibold">Role</p>
                      <Badge>{resultado.thais.role}</Badge>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <p className="text-slate-600 font-semibold">Setor</p>
                      <Badge className="bg-orange-100 text-orange-800">
                        {resultado.userPermissions.attendant_sector}
                      </Badge>
                    </div>
                  </div>

                  {/* Integrações permitidas */}
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      📱 Integrações WhatsApp Permitidas:
                    </p>
                    <div className="space-y-1">
                      {Object.entries(resultado.userPermissions.integracoes || {}).map(([id, perm]) => (
                        <div key={id} className="flex items-center justify-between text-xs p-2 bg-white rounded">
                          <span className="text-slate-700 truncate flex-1">{perm.integration_name}</span>
                          <div className="flex gap-1">
                            <Badge className={perm.can_view ? 'bg-green-600' : 'bg-red-600'} variant="secondary">
                              {perm.can_view ? '✅ Ver' : '❌ Ver'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumo */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h3 className="font-bold text-amber-900 mb-2">📊 Resumo</h3>
                <p className="text-sm">✅ <strong>{resultado.contatosEncontrados}</strong> contatos com "sical"</p>
              </div>

              {/* Análise de cada contato */}
              {resultado.analise.map((item, idx) => (
                <Card key={idx} className={`border-2 ${item.isFidelizado ? 'border-green-400' : 'border-red-400'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        👤 {item.contato.nome}
                        {item.isFidelizado ? (
                          <Badge className="bg-green-600">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            FIDELIZADO À THAIS
                          </Badge>
                        ) : (
                          <Badge className="bg-red-600">
                            <XCircle className="w-3 h-3 mr-1" />
                            NÃO FIDELIZADO
                          </Badge>
                        )}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Info do contato */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-600 font-semibold">ID</p>
                        <p className="font-mono text-[10px]">{item.contato.id.substring(0, 12)}...</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-600 font-semibold">Telefone</p>
                        <p>{item.contato.telefone || '❌ Sem telefone'}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-600 font-semibold">Empresa</p>
                        <p>{item.contato.empresa || '—'}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-600 font-semibold">Tipo</p>
                        <Badge>{item.contato.tipo_contato || 'novo'}</Badge>
                      </div>
                    </div>

                    {/* Campos de fidelização */}
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-800 mb-2">🔐 Campos de Fidelização:</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between p-1 bg-white rounded">
                          <span>atendente_fidelizado_vendas:</span>
                          <span className="font-mono">{item.camposFidelizacao.atendente_fidelizado_vendas || '❌'}</span>
                        </div>
                        <div className="flex justify-between p-1 bg-white rounded">
                          <span>atendente_fidelizado_assistencia:</span>
                          <span className="font-mono">{item.camposFidelizacao.atendente_fidelizado_assistencia || '❌'}</span>
                        </div>
                        <div className="flex justify-between p-1 bg-white rounded">
                          <span>atendente_fidelizado_financeiro:</span>
                          <span className="font-mono">{item.camposFidelizacao.atendente_fidelizado_financeiro || '❌'}</span>
                        </div>
                        <div className="flex justify-between p-1 bg-white rounded">
                          <span>atendente_fidelizado_fornecedor:</span>
                          <span className="font-mono">{item.camposFidelizacao.atendente_fidelizado_fornecedor || '❌'}</span>
                        </div>
                        <div className="flex justify-between p-1 bg-white rounded">
                          <span>is_cliente_fidelizado:</span>
                          <Badge className={item.camposFidelizacao.is_cliente_fidelizado ? 'bg-green-600' : 'bg-red-600'}>
                            {item.camposFidelizacao.is_cliente_fidelizado ? '✅ true' : '❌ false'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Threads */}
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-700">🧵 Threads:</p>
                        <div className="flex gap-2">
                          <Badge className="bg-green-600 text-xs">{item.threadsVisiveis} visíveis</Badge>
                          <Badge className="bg-red-600 text-xs">{item.threadsBloqueadas} bloqueadas</Badge>
                        </div>
                      </div>

                      {item.threads.length === 0 && (
                        <div className="p-3 bg-yellow-50 rounded border border-yellow-300 text-center">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 mx-auto mb-1" />
                          <p className="text-xs text-yellow-800">Este contato não tem threads</p>
                        </div>
                      )}

                      {item.threads.map((tAnalise, ti) => (
                        <Card key={ti} className={`mt-2 border-2 ${tAnalise.visible ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono">{tAnalise.thread.id.substring(0, 8)}...</span>
                              {tAnalise.visible ? (
                                <Badge className="bg-green-600">✅ VISÍVEL</Badge>
                              ) : (
                                <Badge className="bg-red-600">❌ BLOQUEADA</Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {/* Motivo */}
                            <div className={`p-2 rounded text-xs ${tAnalise.visible ? 'bg-green-100' : 'bg-red-100'}`}>
                              <p className="font-semibold mb-1">
                                {tAnalise.visible ? '✅ Liberada por:' : '🔒 Bloqueada por:'}
                              </p>
                              <p>{tAnalise.motivo}</p>
                              <Badge className="mt-1 text-[10px]">{tAnalise.reason_code}</Badge>
                            </div>

                            {/* Detalhes da thread */}
                            <div className="grid grid-cols-3 gap-1 text-[10px]">
                              <div className="p-1 bg-white rounded">
                                <p className="text-slate-600">Status</p>
                                <Badge className="text-[9px]">{tAnalise.thread.status}</Badge>
                              </div>
                              <div className="p-1 bg-white rounded">
                                <p className="text-slate-600">Atribuída</p>
                                <span>{tAnalise.thread.assigned_user_id ? '✅' : '❌'}</span>
                              </div>
                              <div className="p-1 bg-white rounded">
                                <p className="text-slate-600">Setor</p>
                                <span>{tAnalise.thread.sector_id || '—'}</span>
                              </div>
                            </div>

                            {/* Decision Path */}
                            {tAnalise.decision_path && tAnalise.decision_path.length > 0 && (
                              <div className="p-2 bg-white rounded border text-[10px]">
                                <p className="font-semibold mb-1">🔍 Caminho da Decisão:</p>
                                <div className="space-y-0.5">
                                  {tAnalise.decision_path.map((step, i) => (
                                    <div key={i} className="flex items-start gap-1">
                                      {step.startsWith('ALLOW:') ? (
                                        <CheckCircle2 className="w-2.5 h-2.5 text-green-600 mt-0.5 flex-shrink-0" />
                                      ) : (
                                        <XCircle className="w-2.5 h-2.5 text-red-600 mt-0.5 flex-shrink-0" />
                                      )}
                                      <span className={step.startsWith('ALLOW:') ? 'text-green-700' : 'text-red-700'}>
                                        {step.replace(/^(ALLOW|DENY):/, '')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}