import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Shield,
  Pause,
  Activity,
  Settings,
  Zap,
  Brain,
  Database,
  MessageSquare,
  BarChart3
} from 'lucide-react';

const CATEGORIA_ICONS = {
  automacao: Zap,
  analise: BarChart3,
  comunicacao: MessageSquare,
  gestao_dados: Database,
  inteligencia: Brain,
  sistema: Settings
};

const CATEGORIA_COLORS = {
  automacao: 'bg-purple-100 text-purple-800',
  analise: 'bg-blue-100 text-blue-800',
  comunicacao: 'bg-green-100 text-green-800',
  gestao_dados: 'bg-orange-100 text-orange-800',
  inteligencia: 'bg-indigo-100 text-indigo-800',
  sistema: 'bg-gray-100 text-gray-800'
};

const RISCO_COLORS = {
  baixo: 'bg-green-100 text-green-800',
  medio: 'bg-yellow-100 text-yellow-800',
  alto: 'bg-orange-100 text-orange-800',
  critico: 'bg-red-100 text-red-800'
};

const RISCO_ICONS = {
  baixo: CheckCircle2,
  medio: AlertTriangle,
  alto: AlertTriangle,
  critico: Shield
};

export default function CatalogoSkills({ skills, onExecutar, onToggle, usuario }) {
  const isAdmin = usuario?.role === 'admin';

  return (
    <div className="h-full overflow-y-auto space-y-3 pr-2">
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm z-10 pb-3 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-600" />
          Skills Disponíveis
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          {skills.filter(s => s.ativa).length} ativas de {skills.length} cadastradas
        </p>
      </div>

      {skills.map((skill) => {
        const CategoriaIcon = CATEGORIA_ICONS[skill.categoria] || Activity;
        const RiscoIcon = RISCO_ICONS[skill.nivel_risco] || Activity;
        
        return (
          <Card 
            key={skill.id} 
            className={`hover:shadow-lg transition-all ${!skill.ativa && 'opacity-50'}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${CATEGORIA_COLORS[skill.categoria]}`}>
                    <CategoriaIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm leading-tight flex items-center gap-2">
                      {skill.display_name}
                      {skill.ativa ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                      ) : (
                        <Pause className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      )}
                    </CardTitle>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge className={`${CATEGORIA_COLORS[skill.categoria]} text-[10px] px-1.5 py-0.5`}>
                  {skill.categoria}
                </Badge>
                <Badge className={`${RISCO_COLORS[skill.nivel_risco]} text-[10px] px-1.5 py-0.5 flex items-center gap-1`}>
                  <RiscoIcon className="w-3 h-3" />
                  {skill.nivel_risco}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                  {skill.modo_execucao_padrao}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                {skill.descricao}
              </p>
              
              {skill.performance && skill.performance.total_execucoes > 0 && (
                <div className="bg-slate-50 rounded-lg p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-600">Sucesso:</span>
                    <span className="font-semibold text-green-600">
                      {skill.performance.taxa_sucesso?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-600">Execuções:</span>
                    <span className="font-semibold">{skill.performance.total_execucoes}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-600">Tempo:</span>
                    <span className="font-semibold">{skill.performance.tempo_medio_ms}ms</span>
                  </div>
                </div>
              )}

              {skill.exemplos_uso && skill.exemplos_uso.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] text-slate-500 mb-1">Exemplo:</p>
                  <code className="text-[10px] bg-slate-100 px-2 py-1 rounded block truncate">
                    {skill.exemplos_uso[0].comando}
                  </code>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => onExecutar(skill)}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-xs h-8"
                  disabled={!skill.ativa}
                >
                  <Play className="w-3 h-3 mr-1" />
                  Executar
                </Button>
                
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onToggle(skill)}
                    className="text-xs h-8 px-3"
                  >
                    {skill.ativa ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}