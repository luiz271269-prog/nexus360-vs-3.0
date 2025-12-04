import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ═══════════════════════════════════════════════════════════
 * PAINEL DE ALERTAS DE QUALIDADE - PRODUTOS PARA ENRIQUECER
 * ═══════════════════════════════════════════════════════════
 */

export default function PainelAlertasQualidade({ 
  alertas = [], 
  onEditarProduto,
  maxExibir = 10 
}) {
  if (alertas.length === 0) return null;

  return (
    <Card className="border-2 border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-900">
          <AlertCircle className="w-5 h-5" />
          Produtos que Precisam de Enriquecimento
        </CardTitle>
        <p className="text-sm text-red-700">
          {alertas.length} produto{alertas.length > 1 ? 's' : ''} com dados insuficientes para a IA
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {alertas.slice(0, maxExibir).map((alerta, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-3 rounded-lg border border-red-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900">{alerta.produto}</span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-100 text-red-800">
                      Score: {alerta.score}/100
                    </Badge>
                    {onEditarProduto && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditarProduto(alerta)}
                        className="h-7 text-xs hover:bg-red-100"
                      >
                        Editar
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
                <ul className="text-xs text-slate-600 space-y-1">
                  {alerta.problemas.map((problema, pidx) => (
                    <li key={pidx} className="flex items-start gap-1">
                      <span className="text-red-500 flex-shrink-0">•</span>
                      <span>{problema}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {alertas.length > maxExibir && (
            <div className="text-center pt-2">
              <Badge variant="outline" className="text-slate-600">
                +{alertas.length - maxExibir} produtos adicionais
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}