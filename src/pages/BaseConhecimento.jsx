
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PermissionGuard, { PERMISSIONS } from "../components/security/PermissionGuard";

/**
 * Página de redirecionamento para a Central de Comunicação
 */
export default function BaseConhecimento() {
  return (
    <PermissionGuard permission={PERMISSIONS.MANAGE_BASE_CONHECIMENTO}>
      <BaseConhecimentoContent />
    </PermissionGuard>
  );
}

function BaseConhecimentoContent() {
  const navigate = useNavigate();
  // Added for the new header's button functionality, even if not fully utilized in this specific redirect page context.
  const [showForm, setShowForm] = useState(false);

  // New states as per outline
  const [artigos, setArtigos] = useState([]);
  const [filtros, setFiltros] = useState({
    categoria: 'todos',
    tipo: 'todos',
    busca: ''
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(createPageUrl("Comunicacao") + "?tab=base_conhecimento");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="space-y-6 p-6 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header com Gradiente Laranja */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <BookOpen className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Base de Conhecimento
              </h1>
              <p className="text-slate-300 mt-1">
                Documentação inteligente e learning da IA
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowForm(true)} // onClick handler is now functional
            className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 hover:from-amber-500 hover:via-orange-600 hover:to-red-600 text-white font-bold shadow-lg shadow-orange-500/30"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Documento
          </Button>
        </div>
      </div>

      {/* Original redirection card - now placed after the new header, centered horizontally */}
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Esta página foi movida
            </h1>

            <p className="text-slate-600 mb-6">
              A Base de Conhecimento agora está na <strong>Central de Comunicação</strong> como uma aba dedicada.
            </p>

            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-4">
              <div className="animate-pulse">Redirecionando automaticamente...</div>
              <ArrowRight className="w-4 h-4 animate-bounce" />
            </div>

            <button
              onClick={() => navigate(createPageUrl("Comunicacao") + "?tab=base_conhecimento")}
              className="text-indigo-600 hover:text-indigo-700 font-medium text-sm underline"
            >
              Ir agora para Base de Conhecimento
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
