import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';

export default function ModalDetalhesMetricas({
  isOpen,
  onClose,
  titulo,
  icon: Icon,
  cor,
  dados = [],
  renderRow
}) {
  const corClasses = {
    purple: 'border-purple-200 bg-purple-50',
    red: 'border-red-200 bg-red-50',
    orange: 'border-orange-200 bg-orange-50',
    blue: 'border-blue-200 bg-blue-50'
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5" />}
            {titulo}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {dados.length > 0 ? (
            <div className="space-y-2">
              {dados.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className={`p-3 rounded-lg border ${corClasses[cor] || 'border-slate-200 bg-slate-50'}`}
                >
                  {renderRow ? (
                    renderRow(item)
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{item.name || item.title || String(item)}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.count || item.value || '—'}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <p className="text-sm">Nenhum dado disponível</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}