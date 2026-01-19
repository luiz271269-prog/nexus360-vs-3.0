import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

const BLOQUEIOS = [
  {
    grupo: 'Bloqueios de Contexto',
    descricao: 'Regras que bloqueiam por contexto da conversa',
    regras: [
      {
        codigo: 'P1',
        titulo: 'Thread Interna - Participação',
        descricao: 'Controla acesso a threads internas (1:1 ou grupos de setor).',
        regra: 'ALLOW se: Usuário é participante OU Admin. DENY se: Não participante.',
        exemplo: 'João vê uma thread 1:1 com Maria porque é participante.',
        cor: 'bg-red-50 border-red-200',
        icone: '👥'
      },
      {
        codigo: 'Fidelizado',
        titulo: 'Fidelizado a Outro - Bloqueio',
        descricao: 'Bloqueia se contato está fidelizado a outro atendente.',
        regra: 'DENY se: Contato.is_cliente_fidelizado AND fidelizado_a_outro_usuario.',
        exemplo: 'Carlos não vê cliente fidelizado a Ana (mesmo sendo do mesmo setor).',
        cor: 'bg-red-50 border-red-200',
        icone: '🔒'
      }
    ]
  },
  {
    grupo: 'Bloqueios Técnicos',
    descricao: 'Bloqueios configuráveis por canal, integração ou setor',
    regras: [
      {
        codigo: 'P9',
        titulo: 'Canal Bloqueado',
        descricao: 'Bloqueia acesso com base no CANAL de comunicação (WhatsApp, Email, etc).',
        regra: 'DENY se: Thread.channel está em canaisBloqueados.',
        exemplo: 'Júnior não vê threads de Email porque Email está bloqueado para sua função.',
        cor: 'bg-red-50 border-red-200',
        icone: '📱',
        configuravel: true
      },
      {
        codigo: 'P10',
        titulo: 'Integração Bloqueada',
        descricao: 'Bloqueia acesso com base na INTEGRAÇÃO (qual número WhatsApp, conta, etc).',
        regra: 'DENY se: Thread.whatsapp_integration_id está em integracoesBloqueadas.',
        exemplo: 'Pleno vê conversas apenas do número +55 48 3045-2076, não do 99649-8993.',
        cor: 'bg-red-50 border-red-200',
        icone: '📞',
        configuravel: true
      },
      {
        codigo: 'P11',
        titulo: 'Setor Bloqueado',
        descricao: 'Bloqueia acesso com base no SETOR (Vendas, Suporte, Financeiro, etc).',
        regra: 'DENY se: Thread.sector está em setoresBloqueados.',
        exemplo: 'Atendente de Vendas não vê conversas de Financeiro (Financeiro está bloqueado).',
        cor: 'bg-red-50 border-red-200',
        icone: '🏢',
        configuravel: true
      }
    ]
  }
];

const LIBERACOES = [
  {
    grupo: 'Chaves Mestras',
    descricao: 'Acesso garantido que sobrescreve todos os bloqueios técnicos',
    regras: [
      {
        codigo: 'P3',
        titulo: 'Atribuição',
        descricao: 'Thread atribuída ao usuário = acesso garantido, ignora bloqueios técnicos.',
        regra: 'ALLOW se: Thread.assigned_user_id = Usuário. Ignora P9-P11.',
        exemplo: 'Mesmo se WhatsApp está bloqueado, Ana vê sua thread atribuída.',
        cor: 'bg-purple-50 border-purple-200',
        icone: '🔑',
        sobrescreve: 'P9-P11'
      },
      {
        codigo: 'P4',
        titulo: 'Fidelização',
        descricao: 'Contato fidelizado ao usuário = acesso garantido, ignora bloqueios técnicos.',
        regra: 'ALLOW se: Contato.is_cliente_fidelizado AND fidelizado_ao_usuário. Ignora P9-P11.',
        exemplo: 'Mesmo com "Financeiro" bloqueado, o gerente vê seu cliente fidelizado.',
        cor: 'bg-purple-50 border-purple-200',
        icone: '💎',
        sobrescreve: 'P9-P11'
      }
    ]
  },
  {
    grupo: 'Fail-Safes Temporais',
    descricao: 'Liberação baseada em janelas de tempo',
    regras: [
      {
        codigo: 'P5',
        titulo: 'Janela 24h',
        descricao: 'Janela de tempo que permite ver mensagens recentes do cliente, ignora bloqueios técnicos.',
        regra: 'ALLOW se: (Agora - última_mensagem_do_cliente) < 24h. A menos que fidelizado a outro.',
        exemplo: 'Carlos vê uma thread de "Vendas" bloqueada porque cliente mandou msg há 6h.',
        cor: 'bg-green-50 border-green-200',
        icone: '⏰',
        configuravel: true,
        sobrescreve: 'P9-P11'
      }
    ]
  },
  {
    grupo: 'Supervisão',
    descricao: 'Permissões para supervisores e gerentes',
    regras: [
      {
        codigo: 'P6',
        titulo: 'Carteira de Outros',
        descricao: 'Permite supervisão de contatos fidelizados a colegas do mesmo setor.',
        regra: 'ALLOW se: Contato está fidelizado (mesmo que a outro) AND mesmo setor.',
        exemplo: 'Gerente de Vendas vê carteira de Ana (também Vendas) para acompanhamento.',
        cor: 'bg-green-50 border-green-200',
        icone: '👀',
        configuravel: true
      },
      {
        codigo: 'P7',
        titulo: 'Conversas de Outros',
        descricao: 'Permite ver conversas atribuídas a colegas do mesmo setor (supervisão).',
        regra: 'ALLOW se: Thread atribuída a outro usuario AND mesmo setor AND flag podeVerConversasOutros.',
        exemplo: 'Senior de Suporte vê threads de plenos em Suporte para review.',
        cor: 'bg-green-50 border-green-200',
        icone: '📋',
        configuravel: true
      },
      {
        codigo: 'P8',
        titulo: 'Supervisão Gerencial',
        descricao: 'Gerente vê threads de colegas quando cliente aguarda resposta há muito tempo.',
        regra: 'ALLOW se: (Agora - última_resposta_atendente) > 30min AND gerente.',
        exemplo: 'Coordenador vê thread de João após 45min de espera do cliente.',
        cor: 'bg-green-50 border-green-200',
        icone: '⚡',
        configuravel: true
      }
    ]
  },
  {
    grupo: 'Fallback e Admin',
    descricao: 'Regras de última instância',
    regras: [
      {
        codigo: 'P12',
        titulo: 'Modo Padrão',
        descricao: 'Valor padrão quando nenhuma outra regra se aplica.',
        regra: 'ALLOW se: modo_visibilidade = "padrao_liberado". DENY se: "padrao_bloqueado".',
        exemplo: 'Se tudo acima falhou: padrão libera = vê a thread. Padrão bloqueia = não vê.',
        cor: 'bg-slate-50 border-slate-200',
        icone: '⚙️',
        configuravel: true
      },
      {
        codigo: 'Admin',
        titulo: 'Administrador',
        descricao: 'Administrador vê TUDO, em qualquer situação (com exceção de bloqueios absolutos).',
        regra: 'ALLOW se: usuario.role === "admin". Sobrescreve quase tudo.',
        exemplo: 'Admin vê threads internas, bloqueadas, privadas - tudo sem limite.',
        cor: 'bg-orange-50 border-orange-200',
        icone: '👑',
        sobrescreve: 'Tudo (exceto P1)'
      }
    ]
  }
];

export default function GuiaRegraP1P12() {
  const [expandido, setExpandido] = useState(null);

  const renderGrupo = (grupo) => (
    <div key={grupo.grupo} className="space-y-3 mb-6">
      <div className="bg-slate-100 rounded-lg p-3 border border-slate-300">
        <h3 className="font-bold text-slate-900 text-sm">{grupo.grupo}</h3>
        <p className="text-xs text-slate-600 mt-1">{grupo.descricao}</p>
      </div>

      {grupo.regras.map((regra) => (
        <Card key={regra.codigo} className={`${regra.cor} border transition-all`}>
          <CardHeader 
            className="pb-3 cursor-pointer hover:bg-black/5"
            onClick={() => setExpandido(expandido === regra.codigo ? null : regra.codigo)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{regra.icone}</span>
                  <Badge className="bg-slate-700 text-white font-bold">
                    {regra.codigo}
                  </Badge>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base text-slate-900">
                      {regra.titulo}
                    </CardTitle>
                    {regra.configuravel && (
                      <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300 text-blue-700">
                        ⚙️ Configurável
                      </Badge>
                    )}
                    {regra.sobrescreve && (
                      <Badge variant="outline" className="text-xs bg-purple-50 border-purple-300 text-purple-700">
                        🔥 Ignora {regra.sobrescreve}
                      </Badge>
                    )}
                  </div>
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
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-slate-900">Lógica</h4>
                <div className="bg-white p-3 rounded border border-slate-200 text-sm text-slate-700 font-mono">
                  {regra.regra}
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-slate-900">Exemplo Prático</h4>
                <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-slate-800">
                  💡 {regra.exemplo}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border border-indigo-200">
        <h2 className="text-lg font-bold text-indigo-900 mb-1">📋 Guia Completo: P1-P12</h2>
        <p className="text-sm text-indigo-700">
          2 abas organizadas por BLOQUEIOS e LIBERAÇÕES, divididas em grupos lógicos.
        </p>
      </div>

      {/* Tabs: BLOQUEIOS vs LIBERAÇÕES */}
      <Tabs defaultValue="bloqueios" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="bloqueios" className="text-sm">
            🔴 Bloqueios
          </TabsTrigger>
          <TabsTrigger value="liberacoes" className="text-sm">
            🟢 Liberações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bloqueios" className="space-y-0 mt-4">
          {BLOQUEIOS.map(renderGrupo)}
        </TabsContent>

        <TabsContent value="liberacoes" className="space-y-0 mt-4">
          {LIBERACOES.map(renderGrupo)}
        </TabsContent>
      </Tabs>

      {/* Resumo Rápido */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Quando Bloqueia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-red-900">
            <p>• <strong>P1:</strong> Thread interna sem participação</p>
            <p>• <strong>P9-P11:</strong> Canal/Integração/Setor bloqueado</p>
            <p>• <strong>Fidelizado:</strong> Contato da carteira de outro</p>
          </CardContent>
        </Card>

        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Quando Libera
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-green-900">
            <p>• <strong>P3-P4:</strong> Atribuído/Fidelizado a mim (ignora bloqueios)</p>
            <p>• <strong>P5:</strong> Mensagem recente &lt; 24h (ignora bloqueios)</p>
            <p>• <strong>P6-P8:</strong> Supervisão (com condições)</p>
            <p>• <strong>Admin:</strong> Acesso total</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}