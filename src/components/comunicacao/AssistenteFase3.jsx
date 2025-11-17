import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Circle,
  ChevronRight,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Code,
  Link as LinkIcon,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";

export default function AssistenteFase3() {
  const [etapaAtiva, setEtapaAtiva] = useState('C1');
  const [validacoes, setValidacoes] = useState({
    C1_planilha_criada: false,
    C2_apps_script_publicado: false,
    C3_secret_configurada: false
  });

  const [webhookUrl, setWebhookUrl] = useState('');
  const [showWebhookUrl, setShowWebhookUrl] = useState(false);

  const copiarTexto = (texto, label) => {
    navigator.clipboard.writeText(texto);
    toast.success(`${label} copiado!`);
  };

  const etapas = [
    {
      id: 'C1',
      titulo: 'C1. Criar Planilha',
      prioridade: 'CRÍTICA',
      status: validacoes.C1_planilha_criada ? 'concluido' : 'pendente',
      descricao: 'Criar Google Sheet com colunas corretas'
    },
    {
      id: 'C2',
      titulo: 'C2. Apps Script',
      prioridade: 'CRÍTICA',
      status: validacoes.C2_apps_script_publicado ? 'concluido' : 'pendente',
      descricao: 'Criar e publicar Web App'
    },
    {
      id: 'C3',
      titulo: 'C3. Configurar Secret',
      prioridade: 'CRÍTICA',
      status: validacoes.C3_secret_configurada ? 'concluido' : 'pendente',
      descricao: 'Adicionar URL no Base44'
    }
  ];

  const codigoAppsScript = `/**
 * ══════════════════════════════════════════════════════════════
 * GOOGLE APPS SCRIPT - RECEPTOR DE LOGS SRE
 * ══════════════════════════════════════════════════════════════
 * 
 * Este script recebe logs do healthcheck-regenerativo.js
 * e os salva persistentemente no Google Sheets.
 * 
 * @version 1.0.0
 * @author VendaPro Pro - SRE Team
 */

function doPost(e) {
  try {
    // 1. Validar que temos um payload
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Payload vazio ou inválido'
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Parse do JSON
    const payload = JSON.parse(e.postData.contents);
    Logger.log('[SHEET-WEBHOOK] 📥 Payload recebido:', payload);

    // 3. Obter a planilha ativa
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 4. Validar que temos as colunas corretas
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const expectedHeaders = [
      'timestamp',
      'zapi_status',
      'zapi_latency',
      'zapi_error',
      'nexus_status',
      'nexus_latency',
      'nexus_error',
      'diagnosis'
    ];
    
    // Se os headers não existem ou estão errados, criar/corrigir
    if (headers.length === 0 || headers[0] !== 'timestamp') {
      Logger.log('[SHEET-WEBHOOK] 📋 Criando headers...');
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, expectedHeaders.length).setBackground('#4CAF50');
      sheet.getRange(1, 1, 1, expectedHeaders.length).setFontColor('#FFFFFF');
    }

    // 5. Extrair dados do payload
    const timestamp = payload.timestamp || new Date().toISOString();
    const zapiStatus = payload.zapi_status || 'UNKNOWN';
    const zapiLatency = payload.zapi_latency || 0;
    const zapiError = payload.zapi_error || '';
    const nexusStatus = payload.nexus_status || 'UNKNOWN';
    const nexusLatency = payload.nexus_latency || 0;
    const nexusError = payload.nexus_error || '';
    const diagnosis = payload.diagnosis || '';

    // 6. Adicionar nova linha
    const newRow = [
      timestamp,
      zapiStatus,
      zapiLatency,
      zapiError,
      nexusStatus,
      nexusLatency,
      nexusError,
      diagnosis
    ];

    sheet.appendRow(newRow);
    Logger.log('[SHEET-WEBHOOK] ✅ Linha adicionada com sucesso');

    // 7. Formatação condicional na linha recém-adicionada
    const lastRow = sheet.getLastRow();
    
    // Colorir status da Z-API
    const zapiCell = sheet.getRange(lastRow, 2); // Coluna B (zapi_status)
    if (zapiStatus === 'OK') {
      zapiCell.setBackground('#C8E6C9'); // Verde claro
      zapiCell.setFontColor('#2E7D32'); // Verde escuro
    } else if (zapiStatus === 'ERROR') {
      zapiCell.setBackground('#FFCDD2'); // Vermelho claro
      zapiCell.setFontColor('#C62828'); // Vermelho escuro
    } else {
      zapiCell.setBackground('#FFF9C4'); // Amarelo claro
      zapiCell.setFontColor('#F57F17'); // Amarelo escuro
    }

    // Colorir status do Nexus
    const nexusCell = sheet.getRange(lastRow, 5); // Coluna E (nexus_status)
    if (nexusStatus === 'OK') {
      nexusCell.setBackground('#C8E6C9');
      nexusCell.setFontColor('#2E7D32');
    } else if (nexusStatus === 'ERROR') {
      nexusCell.setBackground('#FFCDD2');
      nexusCell.setFontColor('#C62828');
    } else {
      nexusCell.setBackground('#FFF9C4');
      nexusCell.setFontColor('#F57F17');
    }

    // 8. Auto-ajustar largura das colunas (opcional, pode deixar lento)
    // sheet.autoResizeColumns(1, expectedHeaders.length);

    // 9. Retornar sucesso
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Log registrado com sucesso',
      row: lastRow
    }))
    .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('[SHEET-WEBHOOK] ❌ Erro:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Função auxiliar para testar o script manualmente
 */
function testar() {
  const payloadTeste = {
    timestamp: new Date().toISOString(),
    zapi_status: 'OK',
    zapi_latency: 234,
    zapi_error: '',
    nexus_status: 'OK',
    nexus_latency: 1523,
    nexus_error: '',
    diagnosis: 'Teste manual via Apps Script'
  };

  const e = {
    postData: {
      contents: JSON.stringify(payloadTeste)
    }
  };

  const resultado = doPost(e);
  Logger.log('Resultado do teste:', resultado.getContent());
}`;

  const renderC1 = () => (
    <div className="space-y-6">
      {/* Status */}
      {validacoes.C1_planilha_criada ? (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>✅ Planilha criada!</strong> Você marcou esta etapa como concluída.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-blue-50 border-blue-200">
          <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>📊 Vamos criar sua planilha!</strong> Siga o passo a passo abaixo.
          </AlertDescription>
        </Alert>
      )}

      {/* Instruções Passo a Passo */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-lg text-green-900">📋 Passo a Passo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Passo 1 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-900 font-semibold mb-2">
                Acesse o Google Sheets
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://sheets.google.com', '_blank')}
                className="border-green-600 text-green-700 hover:bg-green-100"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir Google Sheets
              </Button>
            </div>
          </div>

          {/* Passo 2 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <p className="text-sm text-green-900 flex-1">
              Crie uma nova planilha em branco<br/>
              <span className="text-xs text-green-700">Clique em "Planilha em branco" ou use Ctrl+N</span>
            </p>
          </div>

          {/* Passo 3 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-900 font-semibold mb-2">
                Renomeie a planilha
              </p>
              <p className="text-xs text-green-700 mb-2">
                Clique no título "Planilha sem título" e renomeie para:
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-1 rounded border border-green-300 text-green-800 font-mono text-sm">
                  VendaPro - SRE Logs
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copiarTexto('VendaPro - SRE Logs', 'Nome da planilha')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Passo 4 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              4
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-900 font-semibold mb-2">
                Configure as colunas (EXATAMENTE nesta ordem)
              </p>
              <p className="text-xs text-green-700 mb-3">
                Na primeira linha (linha 1), adicione os seguintes cabeçalhos:
              </p>
              
              <div className="bg-white p-3 rounded border border-green-300">
                <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-green-100 p-2 rounded text-center font-semibold">
                    A1: timestamp
                  </div>
                  <div className="bg-blue-100 p-2 rounded text-center font-semibold">
                    B1: zapi_status
                  </div>
                  <div className="bg-blue-100 p-2 rounded text-center font-semibold">
                    C1: zapi_latency
                  </div>
                  <div className="bg-blue-100 p-2 rounded text-center font-semibold">
                    D1: zapi_error
                  </div>
                  <div className="bg-purple-100 p-2 rounded text-center font-semibold">
                    E1: nexus_status
                  </div>
                  <div className="bg-purple-100 p-2 rounded text-center font-semibold">
                    F1: nexus_latency
                  </div>
                  <div className="bg-purple-100 p-2 rounded text-center font-semibold">
                    G1: nexus_error
                  </div>
                  <div className="bg-orange-100 p-2 rounded text-center font-semibold">
                    H1: diagnosis
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  const headers = 'timestamp\tzapi_status\tzapi_latency\tzapi_error\tnexus_status\tnexus_latency\tnexus_error\tdiagnosis';
                  copiarTexto(headers, 'Cabeçalhos');
                  toast.info('Cole no Google Sheets (Ctrl+V) - o \\t vai criar as colunas automaticamente');
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar Cabeçalhos (separados por TAB)
              </Button>
            </div>
          </div>

          {/* Passo 5 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              5
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-900 font-semibold mb-2">
                (Opcional) Formate os cabeçalhos
              </p>
              <ul className="text-xs text-green-700 space-y-1 list-disc list-inside">
                <li>Selecione a linha 1 (linha dos cabeçalhos)</li>
                <li>Deixe o texto em <strong>Negrito</strong></li>
                <li>Coloque fundo verde e texto branco (para ficar bonito 😊)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visualização de Exemplo */}
      <Card className="border-slate-300">
        <CardHeader>
          <CardTitle className="text-lg">👁️ Como Deve Ficar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-green-600 text-white">
                  <th className="border border-green-700 p-2">timestamp</th>
                  <th className="border border-green-700 p-2">zapi_status</th>
                  <th className="border border-green-700 p-2">zapi_latency</th>
                  <th className="border border-green-700 p-2">zapi_error</th>
                  <th className="border border-green-700 p-2">nexus_status</th>
                  <th className="border border-green-700 p-2">nexus_latency</th>
                  <th className="border border-green-700 p-2">nexus_error</th>
                  <th className="border border-green-700 p-2">diagnosis</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="border border-slate-300 p-2 text-slate-400 italic" colSpan={8}>
                    (As linhas de dados aparecerão aqui automaticamente)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            ⚠️ A ordem das colunas é importante! O Apps Script espera esta sequência exata.
          </p>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">✅ Checklist de Validação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Planilha criada no Google Sheets</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Nome: "VendaPro - SRE Logs" (ou similar)</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>8 colunas configuradas na ordem correta</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Cabeçalhos formatados (opcional)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={() => {
            setValidacoes(prev => ({ ...prev, C1_planilha_criada: true }));
            toast.success('✅ C1 concluída!');
          }}
          className="bg-gradient-to-r from-green-500 to-emerald-600"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Marcar como Concluída
        </Button>
        <Button
          onClick={() => {
            if (validacoes.C1_planilha_criada) {
              setEtapaAtiva('C2');
              toast.success('Avançando para C2!');
            } else {
              toast.warning('Marque C1 como concluída primeiro');
            }
          }}
          disabled={!validacoes.C1_planilha_criada}
          className="bg-gradient-to-r from-blue-500 to-indigo-600"
        >
          Avançar para C2
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderC2 = () => (
    <div className="space-y-6">
      {/* Status */}
      {validacoes.C2_apps_script_publicado ? (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>✅ Apps Script publicado!</strong> A URL do Web App está pronta.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-blue-50 border-blue-200">
          <Code className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>👨‍💻 Vamos criar o Apps Script!</strong> Este é o receptor que vai salvar os logs.
          </AlertDescription>
        </Alert>
      )}

      {/* O que é Apps Script */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-lg text-purple-900">🤔 O que é Google Apps Script?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-purple-800">
            É uma plataforma de desenvolvimento do Google que permite criar "mini aplicações" 
            que interagem com Google Sheets, Docs, Gmail, etc.
          </p>
          <p className="text-sm text-purple-800">
            No nosso caso, vamos criar um <strong>Web App</strong> que:
          </p>
          <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside ml-4">
            <li>Recebe requisições HTTP (POST) do nosso Healthcheck</li>
            <li>Extrai os dados do payload</li>
            <li>Salva automaticamente no Google Sheets</li>
            <li>Aplica formatação condicional (cores para status OK/ERROR)</li>
          </ul>
        </CardContent>
      </Card>

      {/* Passo a Passo */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">📋 Passo a Passo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Passo 1 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 font-semibold mb-2">
                Abra sua planilha no Google Sheets
              </p>
              <p className="text-xs text-blue-700">
                A planilha "VendaPro - SRE Logs" que você criou na etapa C1
              </p>
            </div>
          </div>

          {/* Passo 2 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 font-semibold mb-2">
                Acesse o Editor do Apps Script
              </p>
              <p className="text-xs text-blue-700 mb-2">
                No menu da planilha: <strong>Extensões → Apps Script</strong>
              </p>
              <img 
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='60'%3E%3Crect width='300' height='60' fill='%23f0f0f0'/%3E%3Ctext x='150' y='35' font-family='Arial' font-size='14' text-anchor='middle'%3EExtensões → Apps Script%3C/text%3E%3C/svg%3E"
                alt="Menu"
                className="border border-blue-300 rounded"
              />
            </div>
          </div>

          {/* Passo 3 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 font-semibold mb-2">
                Substitua todo o código
              </p>
              <p className="text-xs text-blue-700 mb-2">
                Apague o código padrão (<code className="bg-blue-200 px-1 rounded">function myFunction()</code>) 
                e cole o código abaixo:
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Código do Apps Script */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">💻 Código do Apps Script</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                copiarTexto(codigoAppsScript, 'Código do Apps Script');
                toast.success('Código copiado! Cole no editor do Apps Script.', { duration: 5000 });
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Código Completo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
            <pre>{codigoAppsScript}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Continuação Passo a Passo */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-lg text-orange-900">📋 Continuação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Passo 4 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              4
            </div>
            <div className="flex-1">
              <p className="text-sm text-orange-900 font-semibold mb-2">
                Salve o projeto
              </p>
              <p className="text-xs text-orange-700">
                Clique no ícone de disquete 💾 ou pressione <code className="bg-orange-200 px-1 rounded">Ctrl+S</code>
              </p>
            </div>
          </div>

          {/* Passo 5 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              5
            </div>
            <div className="flex-1">
              <p className="text-sm text-orange-900 font-semibold mb-2">
                Implante como Web App
              </p>
              <p className="text-xs text-orange-700 mb-2">
                Clique em: <strong>Implantar → Nova implantação</strong>
              </p>
            </div>
          </div>

          {/* Passo 6 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              6
            </div>
            <div className="flex-1">
              <p className="text-sm text-orange-900 font-semibold mb-2">
                Configure a implantação
              </p>
              <ul className="text-xs text-orange-700 space-y-2 list-disc list-inside ml-2">
                <li>
                  <strong>Tipo:</strong> Selecione "Aplicativo da Web"
                </li>
                <li>
                  <strong>Descrição:</strong> Digite "VendaPro SRE Webhook"
                </li>
                <li>
                  <strong>Executar como:</strong> Selecione "Eu"
                </li>
                <li>
                  <strong className="text-red-700">⚠️ IMPORTANTE - Quem tem acesso:</strong> 
                  Selecione <strong>"Qualquer pessoa"</strong> (sem login required)
                </li>
              </ul>
              <Alert className="mt-3 bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs text-red-800">
                  <strong>CRÍTICO:</strong> Se você não selecionar "Qualquer pessoa", 
                  o Healthcheck não conseguirá enviar logs e a FASE 3 falhará!
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Passo 7 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              7
            </div>
            <div className="flex-1">
              <p className="text-sm text-orange-900 font-semibold mb-2">
                Autorize o script
              </p>
              <p className="text-xs text-orange-700 mb-2">
                O Google vai pedir autorização. Siga os passos:
              </p>
              <ol className="text-xs text-orange-700 space-y-1 list-decimal list-inside ml-2">
                <li>Clique em "Autorizar acesso"</li>
                <li>Escolha sua conta do Google</li>
                <li>Clique em "Avançado" (se aparecer aviso)</li>
                <li>Clique em "Ir para [nome do projeto] (não seguro)"</li>
                <li>Clique em "Permitir"</li>
              </ol>
            </div>
          </div>

          {/* Passo 8 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              8
            </div>
            <div className="flex-1">
              <p className="text-sm text-orange-900 font-semibold mb-2">
                Copie a URL do Web App
              </p>
              <p className="text-xs text-orange-700 mb-2">
                Após a implantação, copie a <strong>URL do aplicativo da Web</strong>
              </p>
              <div className="bg-white p-3 rounded border border-orange-300">
                <p className="text-xs text-orange-900 font-semibold mb-1">📌 A URL será algo como:</p>
                <code className="text-xs font-mono text-orange-700 block bg-orange-100 p-2 rounded break-all">
                  https://script.google.com/macros/s/AKfycbz.../exec
                </code>
              </div>
              <Alert className="mt-3 bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-xs text-green-800">
                  <strong>✅ Guarde esta URL!</strong> Você vai precisar dela na etapa C3.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teste Opcional */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-lg text-purple-900">🧪 (Opcional) Testar o Script</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-purple-800">
            Antes de publicar, você pode testar o script:
          </p>
          <ol className="text-sm text-purple-800 space-y-1 list-decimal list-inside ml-2">
            <li>No editor do Apps Script, localize a função <code className="bg-purple-200 px-1 rounded">testar()</code></li>
            <li>Selecione <code className="bg-purple-200 px-1 rounded">testar</code> no menu suspenso de funções</li>
            <li>Clique em "Executar" ▶️</li>
            <li>Verifique se uma nova linha aparece na sua planilha</li>
          </ol>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card className="border-slate-300">
        <CardHeader>
          <CardTitle className="text-lg">✅ Checklist de Validação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Código do Apps Script colado no editor</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Projeto salvo</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Implantado como Web App</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Acesso configurado para "Qualquer pessoa"</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>URL do Web App copiada</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setEtapaAtiva('C1')}
        >
          Voltar para C1
        </Button>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setValidacoes(prev => ({ ...prev, C2_apps_script_publicado: true }));
              toast.success('✅ C2 concluída!');
            }}
            className="bg-gradient-to-r from-green-500 to-emerald-600"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Marcar como Concluída
          </Button>
          <Button
            onClick={() => {
              if (validacoes.C2_apps_script_publicado) {
                setEtapaAtiva('C3');
                toast.success('Avançando para C3!');
              } else {
                toast.warning('Marque C2 como concluída primeiro');
              }
            }}
            disabled={!validacoes.C2_apps_script_publicado}
            className="bg-gradient-to-r from-blue-500 to-indigo-600"
          >
            Avançar para C3
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderC3 = () => (
    <div className="space-y-6">
      {/* Status */}
      {validacoes.C3_secret_configurada ? (
        <Alert className="bg-green-50 border-2 border-green-400">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertDescription className="text-green-800">
            <p className="font-bold text-lg mb-2">🎉 FASE 3 CONCLUÍDA!</p>
            <p className="text-sm">
              O sistema de observabilidade persistente está ativo. 
              Os logs do Healthcheck agora são salvos automaticamente no Google Sheets!
            </p>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-blue-50 border-blue-200">
          <LinkIcon className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>🔗 Última etapa!</strong> Vamos configurar a URL do Webhook no Base44.
          </AlertDescription>
        </Alert>
      )}

      {/* Instruções */}
      <Card className="border-indigo-200 bg-indigo-50">
        <CardHeader>
          <CardTitle className="text-lg text-indigo-900">📋 Passo a Passo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Passo 1 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm text-indigo-900 font-semibold mb-2">
                Copie a URL do Web App
              </p>
              <p className="text-xs text-indigo-700 mb-2">
                Esta é a URL que você obteve na etapa C2 (após publicar o Apps Script)
              </p>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycbz.../exec"
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Passo 2 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm text-indigo-900 font-semibold mb-2">
                Acesse o painel do Base44
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://base44.com/dashboard', '_blank')}
                className="border-indigo-600 text-indigo-700 hover:bg-indigo-100"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir Dashboard Base44
              </Button>
            </div>
          </div>

          {/* Passo 3 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <p className="text-sm text-indigo-900 flex-1">
              Vá em: <strong>Settings → Environment Variables</strong>
            </p>
          </div>

          {/* Passo 4 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              4
            </div>
            <div className="flex-1">
              <p className="text-sm text-indigo-900 font-semibold mb-2">
                Configure a variável GOOGLE_SHEET_WEBHOOK
              </p>
              <div className="bg-white p-3 rounded border border-indigo-300 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-indigo-900 font-semibold">Nome da variável:</p>
                    <code className="text-sm font-mono text-indigo-700">GOOGLE_SHEET_WEBHOOK</code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copiarTexto('GOOGLE_SHEET_WEBHOOK', 'Nome da variável')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                
                <div>
                  <p className="text-xs text-indigo-900 font-semibold mb-1">Valor:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type={showWebhookUrl ? "text" : "password"}
                      value={webhookUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowWebhookUrl(!showWebhookUrl)}
                    >
                      {showWebhookUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (webhookUrl) {
                          copiarTexto(webhookUrl, 'URL do Webhook');
                        } else {
                          toast.warning('Cole a URL do Web App primeiro (Passo 1)');
                        }
                      }}
                      disabled={!webhookUrl}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Passo 5 */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              5
            </div>
            <p className="text-sm text-indigo-900 flex-1">
              Salve a configuração no Base44
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Teste Final */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-lg text-green-900">🧪 Teste de Aceitação Final</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-green-800 font-semibold">
            Agora que tudo está configurado, vamos validar o sistema completo:
          </p>
          
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border border-green-300">
              <p className="text-xs text-green-900 font-semibold mb-2">1️⃣ Aguarde o próximo Healthcheck</p>
              <p className="text-xs text-green-700">
                O <code className="bg-green-200 px-1 rounded">healthcheck-regenerativo</code> roda 
                automaticamente a cada <strong>10 minutos</strong>.
              </p>
            </div>

            <div className="bg-white p-3 rounded border border-green-300">
              <p className="text-xs text-green-900 font-semibold mb-2">2️⃣ Verifique o Slack</p>
              <p className="text-xs text-green-700">
                Você deve receber uma notificação no canal configurado (ex: #vendapro-alertas) 
                com o status <Badge className="bg-green-600">🟢 SAUDÁVEL</Badge>
              </p>
            </div>

            <div className="bg-white p-3 rounded border border-green-300">
              <p className="text-xs text-green-900 font-semibold mb-2">3️⃣ Verifique o Google Sheets</p>
              <p className="text-xs text-green-700 mb-2">
                Abra a planilha "VendaPro - SRE Logs" e confirme que:
              </p>
              <ul className="text-xs text-green-700 space-y-1 list-disc list-inside ml-2">
                <li>Uma nova linha foi adicionada automaticamente</li>
                <li>O campo <code className="bg-green-200 px-1 rounded">zapi_status</code> está como <strong>OK</strong> (verde)</li>
                <li>O campo <code className="bg-green-200 px-1 rounded">nexus_status</code> está como <strong>OK</strong> (verde)</li>
                <li>Todos os campos estão preenchidos</li>
              </ul>
            </div>
          </div>

          <Alert className="bg-blue-50 border-blue-200 mt-4">
            <AlertDescription className="text-xs text-blue-800">
              <strong>💡 Dica:</strong> Você também pode executar o Healthcheck manualmente pela página de Diagnóstico 
              ou invocando a função <code className="bg-blue-200 px-1 rounded">healthcheck-regenerativo</code> via console.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card className="border-slate-300">
        <CardHeader>
          <CardTitle className="text-lg">✅ Checklist Final</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>URL do Web App colada acima</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Secret GOOGLE_SHEET_WEBHOOK configurada no Base44</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Teste realizado (Slack + Google Sheets)</span>
            </div>
            <div className="flex items-start gap-2">
              <Circle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Logs sendo salvos automaticamente</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conclusão */}
      {validacoes.C3_secret_configurada && (
        <Alert className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
          <CheckCircle2 className="h-6 w-6" />
          <AlertDescription>
            <p className="font-bold text-xl mb-3">🎊 PARABÉNS!</p>
            <p className="text-sm mb-3">
              Você completou com sucesso a implementação do <strong>VendaPro Pro v2.0</strong> 
              com sistema de SRE de classe mundial!
            </p>
            <div className="bg-white/20 p-3 rounded">
              <p className="text-sm font-semibold mb-2">✅ Módulos Implementados:</p>
              <ul className="text-xs space-y-1 list-disc list-inside ml-2">
                <li>Módulo I: Diagnóstico e Validação Z-API</li>
                <li>Módulo II: Comunicação Bidirecional (Envio/Recebimento)</li>
                <li>Módulo III: SRE e Autonomia (Healthcheck + LLM)</li>
                <li>Módulo IV: Observabilidade Persistente (Google Sheets)</li>
              </ul>
            </div>
            <p className="text-sm mt-3">
              🚀 Seu sistema agora é <strong>autônomo, inteligente e observável</strong>!
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Ações */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setEtapaAtiva('C2')}
        >
          Voltar para C2
        </Button>
        <Button
          onClick={() => {
            if (!webhookUrl) {
              toast.warning('Cole a URL do Web App primeiro (Passo 1)');
              return;
            }
            setValidacoes(prev => ({ ...prev, C3_secret_configurada: true }));
            toast.success('🎉 FASE 3 CONCLUÍDA! Sistema 100% operacional!', { duration: 5000 });
          }}
          disabled={!webhookUrl}
          className="bg-gradient-to-r from-green-500 to-emerald-600"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Finalizar Implementação
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-2">📊 FASE 3: Observabilidade Persistente</h1>
        <p className="text-blue-100">
          Configuração do Google Sheets para registro permanente de logs SRE
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            {etapas.map((etapa) => (
              <button
                key={etapa.id}
                onClick={() => setEtapaAtiva(etapa.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  etapaAtiva === etapa.id
                    ? 'border-blue-500 bg-blue-50'
                    : etapa.status === 'concluido'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs">{etapa.id}</span>
                  {etapa.status === 'concluido' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <p className="text-xs text-slate-600 text-left">{etapa.descricao}</p>
                <Badge
                  className="mt-2 text-xs bg-red-600"
                >
                  {etapa.prioridade}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {etapas.find(e => e.id === etapaAtiva)?.titulo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {etapaAtiva === 'C1' && renderC1()}
          {etapaAtiva === 'C2' && renderC2()}
          {etapaAtiva === 'C3' && renderC3()}
        </CardContent>
      </Card>
    </div>
  );
}