import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Brain,
  AlertCircle,
  RefreshCw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import InsightRenderer from "../components/comunicacao/InsightRenderer";

export default function AnaliseDetalhadaContato() {
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get("contact_id");
  const [contact, setContact] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contactId) {
      carregarDados();
    }
  }, [contactId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Buscar contato
      const [contactData] = await base44.entities.Contact.filter({ id: contactId });
      setContact(contactData);

      // Buscar análise mais recente
      const analises = await base44.entities.ContactBehaviorAnalysis.filter(
        { contact_id: contactId },
        '-ultima_analise',
        1
      );
      if (analises.length > 0) {
        setAnalise(analises[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar análise');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!analise) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">Nenhuma análise disponível para este contato</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const insights = analise.insights || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-600" />
              Análise Profunda do Contato
            </h1>
            {contact && (
              <p className="text-lg text-slate-600 mt-2">
                {contact.nome} • {contact.empresa}
              </p>
            )}
            <p className="text-sm text-slate-500 mt-1">
              📊 Análise de: {new Date(analise.ultima_analise).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <Button
            onClick={carregarDados}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* Renderizar insights estruturados */}
        <InsightRenderer insights={insights} />
      </div>
    </div>
  );
}