import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Zap, Target, Clock } from 'lucide-react';

export default function SeletorEstrategia({ estrategiaAtual, onMudarEstrategia, disabled }) {
  const estrategias = [
    {
      id: 'fifo',
      nome: 'FIFO',
      descricao: 'Primeiro a entrar, primeiro a ser atendido',
      icon: Clock,
      cor: 'bg-blue-500'
    },
    {
      id: 'prioridade',
      nome: 'Prioridade',
      descricao: 'Atende urgentes primeiro, depois por ordem de chegada',
      icon: Zap,
      cor: 'bg-orange-500'
    },
    {
      id: 'sticky_sender',
      nome: 'Cliente Fiel',
      descricao: 'Prioriza clientes já atendidos pelo atendente',
      icon: Target,
      cor: 'bg-purple-500'
    },
    {
      id: 'round_robin',
      nome: 'Balanceado',
      descricao: 'Distribui igualmente entre atendentes disponíveis',
      icon: Users,
      cor: 'bg-green-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {estrategias.map(estrategia => {
        const Icon = estrategia.icon;
        const isAtiva = estrategiaAtual === estrategia.id;
        
        return (
          <Card 
            key={estrategia.id}
            className={`cursor-pointer transition-all ${
              isAtiva 
                ? 'border-orange-500 border-2 shadow-lg shadow-orange-200' 
                : 'hover:border-slate-300 hover:shadow-md'
            }`}
            onClick={() => !disabled && onMudarEstrategia(estrategia.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 ${estrategia.cor} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                {isAtiva && (
                  <Badge className="bg-orange-500">Ativa</Badge>
                )}
              </div>
              <CardTitle className="text-base mt-2">{estrategia.nome}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">
                {estrategia.descricao}
              </CardDescription>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}