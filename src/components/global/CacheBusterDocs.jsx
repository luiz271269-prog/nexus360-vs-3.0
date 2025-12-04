import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, CheckCircle, AlertTriangle } from "lucide-react";

/**
 * Componente de documentação do Cache Buster
 * Exibe instruções de uso para desenvolvedores
 */

export default function CacheBusterDocs() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-6 h-6 text-blue-600" />
            🚀 Cache Buster Automático - VendaPro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Visão Geral</AlertTitle>
            <AlertDescription>
              O sistema de Cache Buster do VendaPro garante que todos os usuários sempre vejam a versão mais recente do aplicativo, 
              eliminando problemas causados por arquivos antigos em cache do navegador.
            </AlertDescription>
          </Alert>

          <div>
            <h3 className="font-semibold text-lg mb-2">✅ Funcionalidades</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Detecção Automática de Versão: Compara a versão atual com a nova versão</li>
              <li>Soft Update (Notificação Amigável): Notifica o usuário antes de recarregar</li>
              <li>Versionamento Manual Simples: Atualização em uma linha de código</li>
              <li>Apenas Produção: Desativado em localhost para não atrapalhar desenvolvimento</li>
              <li>Chave Isolada: Usa 'venda_pro_app_version' no localStorage</li>
            </ul>
          </div>

          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertTitle>Como Usar</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="font-semibold">A cada deploy que precise de cache bust:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Abra <code className="bg-slate-100 px-1 rounded">components/global/CacheBuster.js</code></li>
                <li>Localize a linha: <code className="bg-slate-100 px-1 rounded">const APP_VERSION = '202501091200';</code></li>
                <li>Atualize para a data/hora atual (formato YYYYMMDDHHMM)</li>
                <li>Exemplo: Deploy em 09/01/2025 às 15:30 → <code className="bg-slate-100 px-1 rounded">'202501091530'</code></li>
                <li>Faça o deploy normalmente</li>
              </ol>
            </AlertDescription>
          </Alert>

          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertTitle>Quando Atualizar a Versão?</AlertTitle>
            <AlertDescription>
              <p className="font-semibold mb-1">✅ SEMPRE atualizar em:</p>
              <ul className="list-disc list-inside text-sm mb-2">
                <li>Correções de bugs críticos</li>
                <li>Mudanças na estrutura de dados</li>
                <li>Atualizações de bibliotecas importantes</li>
                <li>Alterações na lógica de negócio</li>
              </ul>
              <p className="font-semibold mb-1">⚠️ OPCIONAL em:</p>
              <ul className="list-disc list-inside text-sm">
                <li>Mudanças de texto/conteúdo apenas</li>
                <li>Ajustes de estilo (CSS)</li>
                <li>Novos componentes que não afetam usuários existentes</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div>
            <h3 className="font-semibold text-lg mb-2">🔍 Logs e Debugging</h3>
            <p className="text-sm mb-2">O Cache Buster registra logs claros no console:</p>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto">
{`[Cache Buster] 📊 Verificando versão:
  - Versão Atual (localStorage): 202501081000
  - Nova Versão (código): 202501091200
[Cache Buster] 🆕 Nova versão detectada!`}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-2">🔧 Troubleshooting</h3>
            <p className="text-sm mb-2">Em caso de problemas:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Verifique os logs do console (busque por [Cache Buster])</li>
              <li>Limpe o localStorage manualmente: <code className="bg-slate-100 px-1 rounded">localStorage.removeItem('venda_pro_app_version')</code></li>
              <li>Force um hard reload: <code className="bg-slate-100 px-1 rounded">Ctrl+Shift+R</code> (Windows) ou <code className="bg-slate-100 px-1 rounded">Cmd+Shift+R</code> (Mac)</li>
            </ol>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <Info className="w-4 h-4 text-blue-600" />
            <AlertTitle>Localização dos Arquivos</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-sm">
                <li><code className="bg-slate-100 px-1 rounded">components/global/CacheBuster.js</code> - Componente principal</li>
                <li><code className="bg-slate-100 px-1 rounded">Layout.js</code> - Integração global</li>
                <li><code className="bg-slate-100 px-1 rounded">components/global/DeploymentBanner.js</code> - Banner opcional de avisos</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}