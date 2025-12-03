
import React from 'react';
import { motion } from 'framer-motion';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import OrcamentoCard from './OrcamentoCard';
import { Badge } from '@/components/ui/badge';

export default function KanbanColumn({ etapa, orcamentos, onEdit, onDelete, onDuplicar, onWhatsApp }) {
  const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  const totalValor = orcamentos.reduce((sum, o) => sum + (o.valor_total || 0), 0);

  return (
    <div className={`flex-shrink-0 w-80 ${etapa.bg} rounded-lg p-4`}>
      <div className="p-3 border-b border-slate-200 sticky top-0 bg-slate-100 rounded-t-lg z-10">
        <h3 className="font-semibold text-slate-800 flex items-center justify-between">
          <span>{etapa.title}</span>
          <Badge variant="secondary">{orcamentos.length}</Badge>
        </h3>
        <p className="text-sm font-bold text-amber-600">{formatCurrency(totalValor)}</p>
      </div>

      <SortableContext items={orcamentos.map(o => o.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {orcamentos.map((orcamento) => (
            <motion.div
              key={orcamento.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <OrcamentoCard
                orcamento={orcamento}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicar={onDuplicar}
                onWhatsApp={onWhatsApp}
              />
            </motion.div>
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
