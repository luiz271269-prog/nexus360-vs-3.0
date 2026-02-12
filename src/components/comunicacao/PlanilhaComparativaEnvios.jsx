import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, CheckCircle2, XCircle, AlertCircle, Minus, Users } from 'lucide-react';

export default function PlanilhaComparativaEnvios() {
  const [abaAtiva, setAbaAtiva] = useState('regras');

  // ═══════════════════════════════════════════════════════════════
  // DADOS DAS COMPARAÇÕES
  // ═══════════════════════════════════════════════════════════════

  const comparacaoRegras = [
    { regra: 'Chamada de Entrada (UI)', broadcast: 'enviarMensagemMassa (linha 31)', promocao: 'enviarCampanhaLote (modo promocao)', fila: 'Automação (5 min)', detalhe: 'UI: ModalEnvioMassa | Botão "Auto Promoções" | Worker' },
    { regra: 'Função Backend Real', broadcast: '✅ enviarCampanhaLote (modo: broadcast)', promocao: '✅ enviarCampanhaLote (modo: promocao)', fila: '✅ processarFilaPromocoes', detalhe: 'enviarMensagemMassa é wrapper (redireciona)' },
    { regra: 'Placeholders personalização', broadcast: '✅ {{nome}} {{empresa}}', promocao: '✅ Template inteligente', fila: '✅ formatPromotionMessage', detalhe: 'UI mostra preview (linha 118-121)' },
    { regra: 'Cancelamento por resposta', broadcast: '❌', promocao: '❌', fila: '✅', detalhe: 'Linha 52-63 (processarFilaPromocoes)' },
    { regra: 'Cooldown 12 horas', broadcast: '❌', promocao: '✅', fila: '✅', detalhe: 'linha 238-253 (campanha) | via promotionEngine (fila)' },
    { regra: 'Bloqueios (fornecedor/tags)', broadcast: '✅', promocao: '✅', fila: '❌', detalhe: 'linha 148-152 via isBlocked' },
    { regra: 'Rotação inteligente (3 últimas)', broadcast: '❌', promocao: '✅', fila: '✅', detalhe: 'pickPromotion (campanha) | writeLastPromoIds (fila)' },
    { regra: 'Dedupe de fila', broadcast: '❌', promocao: '✅', fila: '❌', detalhe: 'linha 219-236 (verifica WorkQueueItem)' },
    { regra: 'Dedupe saudação 1h', broadcast: '❌', promocao: '✅', fila: '❌', detalhe: 'linha 255-272 (Message.origem_campanha)' },
    { regra: 'Validação telefone', broadcast: '✅', promocao: '✅', fila: '❌', detalhe: 'linha 129-139 (P0)' },
    { regra: 'Cria thread se ausente', broadcast: '✅', promocao: '✅', fila: '❌', detalhe: 'linha 114-126 (P1)' },
    { regra: 'Anti-rate-limit', broadcast: '500ms', promocao: '800ms', fila: '600ms', detalhe: 'linha 369 (campanha) | linha 94 (fila)' },
    { regra: 'Toast de feedback UI', broadcast: '✅ Sucesso + Erros', promocao: '✅ Sucesso + Erros', fila: '❌ Silent', detalhe: 'ModalEnvioMassa linha 38-42' }
  ];

  const comparacaoPersistencia = [
    { entidade: 'Message', campo: 'Saudação/Broadcast', broadcast: '⚠️', promocao: '✅', fila: '✅', obs: 'Broadcast depende do gateway' },
    { entidade: 'Message', campo: 'Promoção', broadcast: '❌', promocao: '❌', fila: '✅', obs: 'Só na fila via sendPromotion' },
    { entidade: 'MessageThread', campo: 'last_message_at', broadcast: '⚠️', promocao: '✅', fila: '❌', obs: 'Broadcast depende gateway | Fila não atualiza' },
    { entidade: 'MessageThread', campo: 'last_message_content', broadcast: '⚠️', promocao: '✅', fila: '❌', obs: 'linha 308 (promocao saudação)' },
    { entidade: 'MessageThread', campo: 'last_outbound_at', broadcast: '⚠️', promocao: '✅', fila: '❌', obs: 'linha 311 (promocao saudação)' },
    { entidade: 'Contact', campo: 'last_any_promo_sent_at', broadcast: '❌', promocao: '❌', fila: '✅', obs: 'GAP P1: não atualiza após saudação' },
    { entidade: 'Contact', campo: 'last_promo_ids (rotação)', broadcast: '❌', promocao: '❌', fila: '✅', obs: 'GAP P1: escolhe mas não persiste' },
    { entidade: 'Contact', campo: 'last_promo_inbound_at', broadcast: '❌', promocao: '❌', fila: '✅', obs: 'linha 80 (só na fila)' },
    { entidade: 'WorkQueueItem', campo: 'CREATE (agendamento)', broadcast: '❌', promocao: '✅', fila: '❌', obs: 'linha 335-354' },
    { entidade: 'WorkQueueItem', campo: 'UPDATE (status)', broadcast: '❌', promocao: '❌', fila: '✅', obs: 'linha 85/54/100' },
    { entidade: 'AutomationLog', campo: 'Registro campanha', broadcast: '✅', promocao: '✅', fila: '❌', obs: 'GAP P2: worker não grava log' }
  ];

  const comparacaoFluxo = [
    { etapa: '1. Gatilho UI', broadcast: '🖱️ Botão "Envio Massa" (ModalEnvioMassa)', promocao: '🖱️ Botão "Auto Promoções" (ContatosRequerendoAtencao)', fila: '⏰ Automação (5 min)' },
    { etapa: '2. Chamada Backend', broadcast: 'enviarMensagemMassa (wrapper)', promocao: 'enviarCampanhaLote (direto)', fila: 'processarFilaPromocoes (scheduled)' },
    { etapa: '3. Redirecionamento', broadcast: '🔄 enviarCampanhaLote (modo: broadcast)', promocao: '➡️ Nenhum (já é a função)', fila: '➡️ Nenhum (worker)' },
    { etapa: '4. Input do usuário', broadcast: '✍️ mensagem + contact_ids + personalizar', promocao: '🤖 contact_ids + delay_minutos', fila: '📋 WorkQueueItem.payload' },
    { etapa: '5. Busca dados', broadcast: '📊 Contact + Thread (lote)', promocao: '📊 Contact + Thread + Promos ativas (lote)', fila: '📊 Contact + Thread + Promo (individual)' },
    { etapa: '6. Validação inicial', broadcast: '✅ telefone + bloqueios + thread', promocao: '✅ telefone + bloqueios + thread', fila: '⚠️ Assume válido' },
    { etapa: '7. Validação cooldown', broadcast: '❌ Não valida', promocao: '✅ 12h universal + dedupe fila + dedupe saudação', fila: '✅ Cancelamento se respondeu' },
    { etapa: '8. Seleção conteúdo', broadcast: '✍️ Personaliza mensagem usuário', promocao: '🤖 Template saudação + filtra promo elegível', fila: '📦 Promoção pré-definida' },
    { etapa: '9. Envio imediato', broadcast: '📤 enviarWhatsApp (gateway)', promocao: '📤 enviarWhatsApp (saudação)', fila: '📤 sendPromotion (promo)' },
    { etapa: '10. Persistência imediata', broadcast: '⚠️ Gateway deve persistir', promocao: '✅ Message + Thread', fila: '✅ Message via sendPromotion' },
    { etapa: '11. Agendamento futuro', broadcast: '❌ N/A', promocao: '✅ WorkQueueItem (+delay_minutos)', fila: '❌ Marca processado' },
    { etapa: '12. Atualização Contact', broadcast: '❌ Não atualiza', promocao: '❌ GAP P1 (não atualiza)', fila: '✅ last_promo_ids + last_any_promo_sent_at' },
    { etapa: '13. Log de auditoria', broadcast: '✅ AutomationLog', promocao: '✅ AutomationLog', fila: '❌ GAP P2' },
    { etapa: '14. Feedback para usuário', broadcast: '✅ Toast com enviados/erros', promocao: '✅ Toast com enviados/erros', fila: '❌ Silent (background)' }
  ];

  const gaps = [
    { 
      prioridade: 'P0', 
      gap: '❌ ERRO DE DEPLOY: enviarCampanhaLote.ts não compila', 
      funcao: 'enviarCampanhaLote.ts', 
      impacto: '🔥 FUNÇÃO QUEBRADA - não está deployada, TODOS os envios em massa estão FALHANDO (UI chama função que não existe)', 
      solucao: 'URGENTE: Corrigir erro TypeScript (provavelmente falta import ou tipo incorreto) - converter para .js ou corrigir tipos' 
    },
    { 
      prioridade: 'P0', 
      gap: 'Broadcast não persiste Message/Thread', 
      funcao: 'enviarCampanhaLote (broadcast)', 
      impacto: 'Mensagens enviadas mas invisíveis na UI - usuário vê modal "Enviando para 3 contatos" mas mensagens não aparecem no histórico', 
      solucao: 'Adicionar persistência explícita (copiar linhas 288-312 do modo promocao)' 
    },
    { 
      prioridade: 'P0', 
      gap: 'enviarMensagemMassa é wrapper desnecessário', 
      funcao: 'enviarMensagemMassa.js', 
      impacto: 'Adiciona latência (2 chamadas HTTP) e dificulta debugging. UI chama wrapper que chama função real.', 
      solucao: 'UI deve chamar enviarCampanhaLote diretamente - remover wrapper deprecated' 
    },
    { 
      prioridade: 'P1', 
      gap: 'Promocao não atualiza Contact após saudação', 
      funcao: 'enviarCampanhaLote (promocao)', 
      impacto: 'Rotação não persiste escolha, cooldown não registrado no momento da saudação', 
      solucao: 'Atualizar Contact.last_any_promo_sent_at e last_promo_ids após linha 312' 
    },
    { 
      prioridade: 'P1', 
      gap: 'Modal não mostra canal de envio', 
      funcao: 'ModalEnvioMassa (UI)', 
      impacto: 'Usuário vê "Enviar por: 📱 Financeiro (554830452079)" mas não controla qual integração usar', 
      solucao: 'Adicionar seletor de integração WhatsApp no modal' 
    },
    { 
      prioridade: 'P2', 
      gap: 'Worker não grava AutomationLog', 
      funcao: 'processarFilaPromocoes', 
      impacto: 'Sem auditoria de execução do worker - usuário não vê "X promoções enviadas" no dashboard', 
      solucao: 'Adicionar AutomationLog no final (após linha 110)' 
    },
    { 
      prioridade: 'P2', 
      gap: 'Modal não mostra preview de todos os contatos', 
      funcao: 'ModalEnvioMassa (UI)', 
      impacto: 'Usuário vê 3 badges (ANA MARIA, alvara sala, Paulo Henrique) mas se selecionar 50, vê apenas "+47 mais"', 
      solucao: 'Adicionar scroll list com todos os contatos ou expandir preview' 
    },
    { 
      prioridade: 'P3', 
      gap: 'Worker não atualiza thread.last_message_at', 
      funcao: 'sendPromotion (promotionEngine)', 
      impacto: 'Conversa não sobe para o topo após promoção - usuário não vê thread atualizada', 
      solucao: 'Adicionar atualização de thread em sendPromotion (após linha 304)' 
    },
    { 
      prioridade: 'P3', 
      gap: 'Contadores de promoção não implementados', 
      funcao: 'Global', 
      impacto: 'Sem métricas de: Promotion.contador_envios, Contact.promocoes_recebidas[id] - dashboard incompleto', 
      solucao: 'Implementar incremento em sendPromotion' 
    }
  ];

  // ═══════════════════════════════════════════════════════════════
  // EXPORTAÇÃO PARA CSV
  // ═══════════════════════════════════════════════════════════════

  const exportarCSV = (dados, nomeArquivo) => {
    const headers = Object.keys(dados[0]);
    const csv = [
      headers.join(','),
      ...dados.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDERIZADORES
  // ═══════════════════════════════════════════════════════════════

  const StatusIcon = ({ status }) => {
    if (status === '✅') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === '❌') return <XCircle className="w-4 h-4 text-red-600" />;
    if (status === '⚠️') return <AlertCircle className="w-4 h-4 text-orange-600" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          📊 Planilha Comparativa - Envios de Mensagens
        </h1>
        <p className="text-slate-600">
          Análise técnica completa dos 3 fluxos de envio do sistema
        </p>
        
        {/* Card de contexto da imagem */}
        <Card className="mt-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-1">🖼️ Fluxo Analisado da UI</h3>
                <p className="text-sm text-orange-800 mb-2">
                  Modal "Envio em Massa" → 3 contatos selecionados → Envio via <code className="bg-orange-100 px-1 rounded font-mono text-xs">enviarMensagemMassa</code> (wrapper) → Redireciona para <code className="bg-orange-100 px-1 rounded font-mono text-xs">enviarCampanhaLote</code> (modo: broadcast)
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-blue-600 text-white">ModalEnvioMassa.jsx</Badge>
                  <Badge className="bg-green-600 text-white">functions/enviarMensagemMassa.js</Badge>
                  <Badge className="bg-purple-600 text-white">functions/enviarCampanhaLote.js</Badge>
                  <Badge variant="outline">Linha 31: base44.functions.invoke</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="regras">Regras & Validações</TabsTrigger>
          <TabsTrigger value="persistencia">Persistência</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo Completo</TabsTrigger>
          <TabsTrigger value="gaps">Gaps Críticos</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ABA 1: REGRAS E VALIDAÇÕES */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="regras">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Comparação de Regras de Negócio</CardTitle>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => exportarCSV(comparacaoRegras, 'comparacao_regras_envios.csv')}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left p-3 font-bold text-slate-700">Regra</th>
                      <th className="text-center p-3 font-bold text-slate-700">Broadcast</th>
                      <th className="text-center p-3 font-bold text-slate-700">Promoção</th>
                      <th className="text-center p-3 font-bold text-slate-700">Fila Worker</th>
                      <th className="text-left p-3 font-bold text-slate-700">Detalhes Técnicos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparacaoRegras.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{row.regra}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StatusIcon status={row.broadcast} />
                            <span className="text-xs">{row.broadcast}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StatusIcon status={row.promocao} />
                            <span className="text-xs">{row.promocao}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StatusIcon status={row.fila} />
                            <span className="text-xs">{row.fila}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-600">{row.detalhe}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ABA 2: PERSISTÊNCIA DE DADOS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="persistencia">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mapeamento de Persistência</CardTitle>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => exportarCSV(comparacaoPersistencia, 'comparacao_persistencia.csv')}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left p-3 font-bold text-slate-700">Entidade</th>
                      <th className="text-left p-3 font-bold text-slate-700">Campo</th>
                      <th className="text-center p-3 font-bold text-slate-700">Broadcast</th>
                      <th className="text-center p-3 font-bold text-slate-700">Promoção</th>
                      <th className="text-center p-3 font-bold text-slate-700">Fila</th>
                      <th className="text-left p-3 font-bold text-slate-700">Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparacaoPersistencia.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{row.entidade}</td>
                        <td className="p-3 text-slate-700">{row.campo}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StatusIcon status={row.broadcast} />
                            <span className="text-xs">{row.broadcast}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StatusIcon status={row.promocao} />
                            <span className="text-xs">{row.promocao}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StatusIcon status={row.fila} />
                            <span className="text-xs">{row.fila}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-600">{row.obs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ABA 3: FLUXO COMPLETO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="fluxo">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Linha Lógica - Etapas de Execução</CardTitle>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => exportarCSV(comparacaoFluxo, 'comparacao_fluxo.csv')}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left p-3 font-bold text-slate-700">Etapa</th>
                      <th className="text-left p-3 font-bold text-slate-700">Broadcast</th>
                      <th className="text-left p-3 font-bold text-slate-700">Promoção</th>
                      <th className="text-left p-3 font-bold text-slate-700">Fila Worker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparacaoFluxo.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{row.etapa}</td>
                        <td className="p-3 text-slate-700">{row.broadcast}</td>
                        <td className="p-3 text-slate-700">{row.promocao}</td>
                        <td className="p-3 text-slate-700">{row.fila}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ABA 4: GAPS CRÍTICOS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="gaps">
          <div className="space-y-4">
            {gaps.map((gap, idx) => {
              const corPrioridade = 
                gap.prioridade === 'P0' ? 'bg-red-500' :
                gap.prioridade === 'P1' ? 'bg-orange-500' :
                gap.prioridade === 'P2' ? 'bg-yellow-500' :
                'bg-blue-500';

              return (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <Badge className={`${corPrioridade} text-white`}>
                        {gap.prioridade}
                      </Badge>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{gap.gap}</CardTitle>
                        <p className="text-sm text-slate-600 mt-1">
                          <span className="font-semibold">Função:</span> {gap.funcao}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <span className="font-semibold text-red-700">Impacto:</span>
                        <p className="text-sm text-slate-700 mt-1">{gap.impacto}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-green-700">Solução:</span>
                        <p className="text-sm text-slate-700 mt-1 bg-green-50 p-2 rounded border border-green-200">
                          {gap.solucao}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800">📋 Resumo Executivo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-bold text-green-800 mb-2">✅ Pontos Fortes</h4>
                  <ul className="space-y-1 text-slate-700">
                    <li>• Arquitetura unificada (1 função, 2 modos)</li>
                    <li>• Validações robustas (isBlocked em 7 dimensões)</li>
                    <li>• Rotação inteligente (evita últimas 3 promos)</li>
                    <li>• Cancelamento inteligente (se cliente responder)</li>
                    <li>• Cooldown 12h (evita spam)</li>
                    <li>• Templates sem LLM (rápido e barato)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-red-800 mb-2">🚨 Gaps Críticos</h4>
                  <ul className="space-y-1 text-slate-700">
                    <li>• <Badge className="bg-red-600 text-white text-xs animate-pulse">P0</Badge> <span className="font-bold text-red-700">FUNÇÃO QUEBRADA</span> - enviarCampanhaLote.ts erro de deploy</li>
                    <li>• <Badge className="bg-red-500 text-white text-xs">P0</Badge> Broadcast não persiste</li>
                    <li>• <Badge className="bg-orange-500 text-white text-xs">P1</Badge> Contact não atualizado (saudação)</li>
                    <li>• <Badge className="bg-yellow-500 text-white text-xs">P2</Badge> Worker sem AutomationLog</li>
                    <li>• <Badge className="bg-blue-500 text-white text-xs">P3</Badge> Thread não atualizada (worker)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500">
          Versão: 3.0 Unificada | Data: 2026-02-12 | 
          <a 
            href="/api/file/components/comunicacao/ANALISE_LINHA_LOGICA_ENVIOS_COMPLETA.md" 
            className="text-blue-600 hover:underline ml-2"
            target="_blank"
          >
            Ver análise completa em Markdown
          </a>
        </p>
      </div>
    </div>
  );
}