import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

const REGRAS_P1_P12 = [
  {
    codigo: 'P1',
    titulo: 'Thread Interna - Participação',
    descricao: 'Controla acesso a threads internas (1:1 ou grupos de setor).',
    regra: 'ALLOW se: Usuário é participante OU Admin. DENY se: Não participante.',
    exemplo: 'João vê uma thread 1:1 com Maria porque é participante.',
    categoria: 'Hard Core (Fixo)',
    cor: 'bg-red-50 border-red-200'
  },
  {
    codigo: 'P3',
    titulo: 'Atribuição - Chave Mestra',
    descricao: 'Thread atribuída ao usuário = acesso garantido, ignora bloqueios técnicos.',
    regra: 'ALLOW se: Thread.assigned_user_id = Usuário. Ignora P9-P11.',
    exemplo: 'Mesmo se WhatsApp está bloqueado, Ana vê sua thread atribuída.',
    categoria: 'Chave Mestra',
    cor: 'bg-purple-50 border-purple-200'
  },
  {
    codigo: 'P4',
    titulo: 'Fidelização - Chave Mestra',
    descricao: 'Contato fidelizado ao usuário = acesso garantido, ignora bloqueios técnicos.',
    regra: 'ALLOW se: Contato.is_cliente_fidelizado AND fidelizado_ao_usuário. Ignora P9-P11.',
    exemplo: 'Mesmo com "Financeiro" bloqueado, o gerente vê seu cliente fidelizado.',
    categoria: 'Chave Mestra',
    cor: 'bg-purple-50 border-purple-200'
  },
  {
    codigo: 'P5',
    titulo: 'Fail-Safe 24h - Mensagem Recente',
    descricao: 'Janela de tempo que permite ver mensagens recentes do cliente, ignora bloqueios técnicos.',
    regra: 'ALLOW se: (Agora - última_mensagem_do_cliente) < 24h. A menos que fidelizado a outro.',
    exemplo: 'Carlos vê uma thread de "Vendas" bloqueada porque cliente mandou msg há 6h.',
    categoria: 'Liberação (Allow Override)',
    cor: 'bg-green-50 border-green-200'
  },
  {
    codigo: 'P6',
    titulo: 'Carteira de Outros - Supervisão',
    descricao: 'Permite supervisão de contatos fidelizados a colegas do mesmo setor.',
    regra: 'ALLOW se: Contato está fidelizado (mesmo que a outro) AND mesmo setor.',
    exemplo: 'Gerente de Vendas vê carteira de Ana (também Vendas) para acompanhamento.',
    categoria: 'Liberação (Soft)',
    cor: 'bg-green-50 border-green-200'
  },
  {
    codigo: 'P7',
    titulo: 'Conversas de Outros - Supervisão',
    descricao: 'Permite ver conversas atribuídas a colegas do mesmo setor (supervisão).',
    regra: 'ALLOW se: Thread atribuída a outro usuario AND mesmo setor AND flag podeVerConversasOutros.',
    exemplo: 'Senior de Suporte vê threads de plenos em Suporte para review.',
    categoria: 'Liberação (Soft)',
    cor: 'bg-green-50 border-green-200'
  },
  {
    codigo: 'P8',
    titulo: 'Supervisão Gerencial - Resposta Pendente',
    descricao: 'Gerente vê threads de colegas quando cliente aguarda resposta há muito tempo.',
    regra: 'ALLOW se: (Agora - última_resposta_atendente) > 30min AND gerente.',
    exemplo: 'Coordenador vê thread de João após 45min de espera do cliente.',
    categoria: 'Liberação (Soft)',
    cor: 'bg-green-50 border-green-200'
  },
  {
    codigo: 'P9',
    titulo: 'Canal Bloqueado - Hard Block',
    descricao: 'Bloqueia acesso com base no CANAL de comunicação (WhatsApp, Email, etc).',
    regra: 'DENY se: Thread.channel está em canaisBloqueados. Hard Core.',
    exemplo: 'Júnior não vê threads de Email porque Email está bloqueado para sua função.',
    categoria: 'Hard Core (Deny-First)',
    cor: 'bg-red-50 border-red-200'
  },
  {
    codigo: 'P10',
    titulo: 'Integração Bloqueada - Hard Block',
    descricao: 'Bloqueia acesso com base na INTEGRAÇÃO (qual número WhatsApp, conta, etc).',
    regra: 'DENY se: Thread.whatsapp_integration_id está em integracoesBloqueadas. Hard Core.',
    exemplo: 'Pleno vê conversas apenas do número +55 48 3045-2076, não do 99649-8993.',
    categoria: 'Hard Core (Deny-First)',
    cor: 'bg-red-50 border-red-200'
  },
  {
    codigo: 'P11',
    titulo: 'Setor Bloqueado - Hard Block',
    descricao: 'Bloqueia acesso com base no SETOR (Vendas, Suporte, Financeiro, etc).',
    regra: 'DENY se: Thread.sector está em setoresBloqueados AND não tem podeVerTodosSetores. Hard Core.',
    exemplo: 'Atendente de Vendas não vê conversas de Financeiro (Financeiro está bloqueado).',
    categoria: 'Hard Core (Deny-First)',
    cor: 'bg-red-50 border-red-200'
  },
  {
    codigo: 'P12',
    titulo: 'Modo Padrão - Default Allow/Deny',
    descricao: 'Valor padrão quando nenhuma outra regra se aplica.',
    regra: 'ALLOW se: modo_visibilidade = "padrao_liberado". DENY se: "padrao_bloqueado".',
    exemplo: 'Se tudo acima falhou: padrão libera = vê a thread. Padrão bloqueia = não vê.',
    categoria: 'Default (Fallback)',
    cor: 'bg-slate-50 border-slate-200'
  },
  {
    codigo: 'Admin',
    titulo: 'Administrador - Acesso Total',
    descricao: 'Administrador vê TUDO, em qualquer situação (com exceção de bloqueios absolutos).',
    regra: 'ALLOW se: usuario.role === "admin". Sobrescreve quase tudo.',
    exemplo: 'Admin vê threads internas, bloqueadas, privadas - tudo sem limite.',
    categoria: 'Exceção Global',
    cor: 'bg-orange-50 border-orange-200'
  }
];

export default function GuiaRegraP1P12() {
  const [expandido, setExpandido] = useState(null);

  const categoriasUnicas = [...new Set(REGRAS_P1_P12.map(r => r.categoria))];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border border-indigo-200">
        <h2 className="text-lg font-bold text-indigo-900 mb-1">📋 Guia Completo: P1-P12</h2>
        <p className="text-sm text-indigo-700">
          Entenda cada regra de decisão que controla a visibilidade de threads na Comunicação.
        </p>
      </div>

      {/* Tabs por Categoria */}
      <Tabs defaultValue="Hard Core (Fixo)" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          {categoriasUnicas.map(cat => (
            <TabsTrigger key={cat} value={cat} className="text-xs">
              {cat.split(' ')[0]}
            </TabsTrigger>
          ))}
        </TabsList>

        {categoriasUnicas.map(categoria => (
          <TabsContent key={categoria} value={categoria} className="space-y-3">
            {REGRAS_P1_P12.filter(r => r.categoria === categoria).map((regra, idx) => (
              <Card key={idx} className={`${regra.cor} border transition-all`}>
                <CardHeader 
                  className="pb-3 cursor-pointer hover:bg-black/5"
                  onClick={() => setExpandido(expandido === regra.codigo ? null : regra.codigo)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Badge className="mt-1 bg-slate-700 text-white font-bold">
                        {regra.codigo}
                      </Badge>
                      <div className="flex-1">
                        <CardTitle className="text-base text-slate-900">
                          {regra.titulo}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1">{regra.descricao}</p>
                      </div>
                    </div>
                    {expandido === regra.codigo ? (
                      <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>

                {expandido === regra.codigo && (
                  <CardContent className="space-y-3 border-t pt-4 bg-white/50">
                    {/* Regra */}
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-slate-900">Lógica</h4>
                      <div className="bg-white p-3 rounded border border-slate-200 text-sm text-slate-700 font-mono">
                        {regra.regra}
                      </div>
                    </div>

                    {/* Exemplo */}
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-slate-900">Exemplo Prático</h4>
                      <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-slate-800">
                        💡 {regra.exemplo}
                      </div>
                    </div>

                    {/* Impacto */}
                    <div className="p-3 rounded bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 text-xs">
                      <span className="font-semibold text-slate-700">
                        ↳ {regra.categoria === 'Hard Core (Fixo)' || regra.categoria === 'Hard Core (Deny-First)' 
                          ? '🔴 Bloqueio automático (não configurável)' 
                          : regra.categoria === 'Chave Mestra'
                          ? '💎 Sobrescreve bloqueios técnicos'
                          : regra.categoria === 'Liberação (Allow Override)'
                          ? '🟢 Libera mesmo com bloqueios'
                          : regra.categoria === 'Liberação (Soft)'
                          ? '🟡 Libera com condições'
                          : regra.categoria === 'Default (Fallback)'
                          ? '⚙️ Valor padrão'
                          : '👑 Acesso administrativo total'
                        }
                      </span>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* Fluxo Visual */}
      <Card className="border-slate-300 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-sm">🔄 Sequência de Decisão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>1. Is thread interna? → P1 (ALLOW/DENY)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>2. Is Admin? → ALLOW</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>3. Janela 24h ativa? → P5 (ALLOW)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>4. Atribuído ao usuário? → P3 (ALLOW)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>5. Fidelizado ao usuário? → P4 (ALLOW)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>6. Fidelizado a outro? → DENY</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>7. Supervisão gerencial? → P8 (ALLOW)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>8. Ver conversas de outros? → P7 (ALLOW)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>9. Canal bloqueado? → P9 (DENY)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>10. Integração bloqueada? → P10 (DENY)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>11. Setor bloqueado? → P11 (DENY)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <span>12. Default mode? → P12 (ALLOW/DENY)</span>
          </div>
        </CardContent>
      </Card>

      {/* Dicas */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-sm">💡 Dicas de Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-amber-900">
          <p>• <strong>Hard Core (P1, P9-P11):</strong> Bloqueios automáticos, não configuráveis aqui - são derivados dos dados legados.</p>
          <p>• <strong>Chaves Mestras (P3-P4):</strong> Atribuição e fidelização SEMPRE permitem, mesmo com bloqueios.</p>
          <p>• <strong>Liberações (P5, P6-P8):</strong> Configuráveis aqui - ajuste "janela 24h" e "supervisão gerencial".</p>
          <p>• <strong>P12:</strong> Se nada se aplica, segue o modo padrão (liberado ou bloqueado).</p>
          <p>• <strong>Strict Mode:</strong> Desativa P5 (janela 24h) e P8 (supervisão) - use para estagiários.</p>
        </CardContent>
      </Card>
    </div>
  );
}