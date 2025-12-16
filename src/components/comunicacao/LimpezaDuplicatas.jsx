import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { base44 } from '@/api/base44Client';
import { Loader2, Users, MessageSquare, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function LimpezaDuplicatas() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const executarLimpeza = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await base44.functions.invoke('limparContatosDuplicados', {});
      
      if (response.data.success) {
        setResult(response.data);
      } else {
        setError(response.data.error || 'Erro desconhecido');
      }
    } catch (err) {
      setError(err.message || 'Erro ao executar limpeza');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-orange-600" />
          Limpeza de Contatos Duplicados
        </CardTitle>
        <CardDescription>
          Consolida contatos com mesmo telefone, reapontando threads e mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && !error && (
          <Button
            onClick={executarLimpeza}
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              'Executar Limpeza'
            )}
          </Button>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-3">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Limpeza concluída com sucesso!
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
                  <Users className="w-4 h-4" />
                  <span>Duplicatas Encontradas</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {result.stats.duplicates_found}
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                  <Users className="w-4 h-4" />
                  <span>Contatos Consolidados</span>
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {result.stats.contacts_merged}
                </div>
              </div>

              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>Threads Atualizadas</span>
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {result.stats.threads_updated}
                </div>
              </div>

              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>Mensagens Atualizadas</span>
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {result.stats.messages_updated}
                </div>
              </div>
            </div>

            {result.stats.errors > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {result.stats.errors} erro(s) durante o processamento
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-slate-500 text-center">
              Processado em: {new Date(result.timestamp).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}