import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, ArrowRight } from "lucide-react";

/**
 * Página de redirecionamento para a Central de Comunicação
 * Esta página foi migrada para a aba "Automação & Templates" na Central de Comunicação
 */
export default function Automacao() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirecionar automaticamente após 2 segundos
    const timer = setTimeout(() => {
      navigate(createPageUrl("Comunicacao") + "?tab=automacao");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Esta página foi movida
          </h1>
          
          <p className="text-slate-600 mb-6">
            As automações agora estão centralizadas na <strong>Central de Comunicação</strong> para facilitar seu trabalho.
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-4">
            <div className="animate-pulse">Redirecionando automaticamente...</div>
            <ArrowRight className="w-4 h-4 animate-bounce" />
          </div>
          
          <button
            onClick={() => navigate(createPageUrl("Comunicacao") + "?tab=automacao")}
            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm underline"
          >
            Ir agora para Central de Comunicação
          </button>
        </CardContent>
      </Card>
    </div>
  );
}