import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import DiagnosticoBuscaGlobal from './DiagnosticoBuscaGlobal';

export default function BotaoDiagnosticoFlutuante({ usuario, contatoAtivo, threadAtiva }) {
  const [showDiagnostico, setShowDiagnostico] = useState(false);

  if (usuario?.role !== 'admin' || !threadAtiva) {
    return null;
  }

  return (
    <div className="absolute bottom-24 right-6 z-50">
      <div className="relative">
        <Button
          onClick={() => setShowDiagnostico(!showDiagnostico)}
          variant="outline"
          className="bg-red-500 hover:bg-red-600 text-white rounded-full w-14 h-14 shadow-lg border-2 border-white/50 focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition-all duration-300 transform hover:scale-110"
        >
          <Bug className="w-7 h-7" />
        </Button>
        {showDiagnostico && (
          <div className="absolute bottom-16 right-0 w-80 bg-white rounded-lg shadow-2xl border border-slate-200 p-4 z-50">
            <DiagnosticoBuscaGlobal
              contactId={contatoAtivo?.id}
              threadId={threadAtiva?.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}