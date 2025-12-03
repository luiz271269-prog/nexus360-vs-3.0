import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
  Info,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function CopiadorSeguroZAPI({ onCredenciaisValidadas }) {
  const [instanceId, setInstanceId] = useState("");
  const [clientToken, setClientToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState(null);
  const [validacoes, setValidacoes] = useState({
    instanceId: null,
    clientToken: null
  });

  const validarInstanceId = (valor) => {
    const limpo = valor.trim();
    
    const validacoes = {
      comprimento: limpo.length === 32,
      formato: /^[A-F0-9]{32}$/i.test(limpo),
      semEspacos: limpo.length === valor.length,
      apenasHex: /^[A-F0-9]+$/i.test(limpo)
    };

    const valido = Object.values(validacoes).every(v => v);

    setValidacoes(prev => ({
      ...prev,
      instanceId: {
        valido,
        detalhes: validacoes,
        mensagem: valido 
          ? "✅ Instance ID válido!" 
          : "❌ Instance ID inválido"
      }
    }));

    return valido;
  };

  const validarClientToken = (valor) => {
    const limpo = valor.trim();
    
    const validacoes = {
      comprimentoMinimo: limpo.length >= 24,
      semEspacos: limpo.length === valor.length,
      formatoHex: /^[A-F0-9]+$/i.test(limpo),
      caracteresValidos: /^[A-F0-9]{24,32}$/i.test(limpo)
    };

    const valido = Object.values(validacoes).every(v => v);

    setValidacoes(prev => ({
      ...prev,
      clientToken: {
        valido,
        detalhes: validacoes,
        mensagem: valido 
          ? "✅ Client Token válido!" 
          : "❌ Client Token inválido"
      }
    }));

    return valido;
  };

  const handleInstanceIdChange = (e) => {
    const valor = e.target.value;
    setInstanceId(valor);
    setResultadoTeste(null);
    
    if (valor.length >= 32) {
      validarInstanceId(valor);
    } else {
      setValidacoes(prev => ({ ...prev, instanceId: null }));
    }
  };

  const handleClientTokenChange = (e) => {
    const valor = e.target.value;
    setClientToken(valor);
    setResultadoTeste(null);
    
    if (valor.length >= 24) {
      validarClientToken(valor);
    } else {
      setValidacoes(prev => ({ ...prev, clientToken: null }));
    }
  };

  const colarDoClipboard = async (campo) => {
    try {
      const texto = await navigator.clipboard.readText();
      const textoLimpo = texto.trim();

      if (campo === "instanceId") {
        setInstanceId(textoLimpo);
        validarInstanceId(textoLimpo);
        toast.success("Instance ID colado e validado!");
      } else if (campo === "clientToken") {
        setClientToken(textoLimpo);
        validarClientToken(textoLimpo);
        toast.success("Client Token colado e validado!");
      }
    } catch (error) {
      toast.error("Erro ao colar. Use Ctrl+V manualmente.");
    }
  };

  const testarConexaoDireta = async () => {
    const instanceIdValido = validarInstanceId(instanceId);
    const clientTokenValido = validarClientToken(clientToken);

    if (!instanceIdValido || !clientTokenValido) {
      toast.error("❌ Corrija os erros de validação primeiro");
      return;
    }

    setTestando(true);
    setResultadoTeste(null);

    try {
      const baseUrl = "https://api.z-api.io";
      
      // ═══════════════════════════════════════════════════════════
      // ✅ FORMATO CORRETO: Client-Token no header
      // ═══════════════════════════════════════════════════════════
      const testUrl = `${baseUrl}/instances/${instanceId.trim()}/status`;
      
      console.log('[TESTE SEGURO] URL:', testUrl);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Client-Token': clientToken.trim()  // ✅ FORMATO CORRETO
        }
      });

      const data = await response.json();
      
      console.log('[TESTE SEGURO] Status:', response.status);
      console.log('[TESTE SEGURO] Data:', data);

      if (!response.ok) {
        setResultadoTeste({
          sucesso: false,
          erro: data.message || data.error || `HTTP ${response.status}`,
          detalhes: data
        });
        toast.error(`❌ ${data.message || 'Erro na conexão'}`);
        return;
      }

      const isConnected = data.connected === true || data.state === 'CONNECTED';

      setResultadoTeste({
        sucesso: true,
        conectado: isConnected,
        status: data.state || (isConnected ? 'connected' : 'disconnected'),
        tempoResposta: response.headers.get('x-response-time') || 'N/A',
        dados: data
      });

      if (isConnected) {
        toast.success("✅ WhatsApp Conectado!");
      } else {
        toast.warning("⚠️ Token válido, mas WhatsApp desconectado");
      }

      // Notificar componente pai
      if (onCredenciaisValidadas) {
        onCredenciaisValidadas({
          instance_id_provider: instanceId.trim(),
          api_key_provider: clientToken.trim(),
          base_url_provider: baseUrl
        });
      }

    } catch (error) {
      console.error('[TESTE SEGURO] Erro:', error);
      setResultadoTeste({
        sucesso: false,
        erro: error.message
      });
      toast.error("❌ Erro: " + error.message);
    } finally {
      setTestando(false);
    }
  };

  const ambosValidos = validacoes.instanceId?.valido && validacoes.clientToken?.valido;

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Copy className="w-5 h-5" />
          Copiar Credenciais da Z-API
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
        {/* INSTRUÇÕES */}
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 font-semibold">📋 Como copiar corretamente</AlertTitle>
          <AlertDescription className="text-blue-800 text-sm">
            <ol className="list-decimal ml-4 mt-2 space-y-1">
              <li>Abra o painel Z-API: <a href="https://www.z-api.io" target="_blank" rel="noopener noreferrer" className="underline font-bold">z-api.io</a></li>
              <li>Vá em <strong>"Instâncias"</strong> no menu lateral</li>
              <li>Clique na sua instância</li>
              <li>Copie o <strong>"Instance ID"</strong> (32 caracteres)</li>
              <li>Copie o <strong>"Token da Instância"</strong> (24-32 caracteres)</li>
              <li>Cole aqui usando os botões "Colar"</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* INSTANCE ID */}
        <div>
          <Label htmlFor="instanceId">Instance ID *</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="instanceId"
              value={instanceId}
              onChange={handleInstanceIdChange}
              placeholder="3E5D2BD1BF421127B24ECEF0269361A3"
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => colarDoClipboard("instanceId")}
            >
              <Copy className="w-4 h-4 mr-1" />
              Colar
            </Button>
          </div>

          {/* VALIDAÇÃO INSTANCE ID */}
          {validacoes.instanceId && (
            <div className={`mt-2 p-2 rounded text-sm ${validacoes.instanceId.valido ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              <p className="font-semibold flex items-center gap-2">
                {validacoes.instanceId.valido ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {validacoes.instanceId.mensagem}
              </p>
              <ul className="mt-1 ml-6 text-xs space-y-0.5">
                <li>{validacoes.instanceId.detalhes.comprimento ? '✓' : '✗'} comprimento: {validacoes.instanceId.detalhes.comprimento ? 'OK' : 'deve ter 32 caracteres'}</li>
                <li>{validacoes.instanceId.detalhes.formato ? '✓' : '✗'} formato: {validacoes.instanceId.detalhes.formato ? 'OK' : 'apenas A-F e 0-9'}</li>
                <li>{validacoes.instanceId.detalhes.semEspacos ? '✓' : '✗'} semEspacos: {validacoes.instanceId.detalhes.semEspacos ? 'OK' : 'remova espaços'}</li>
                <li>{validacoes.instanceId.detalhes.apenasHex ? '✓' : '✗'} apenasHex: {validacoes.instanceId.detalhes.apenasHex ? 'OK' : 'formato hexadecimal'}</li>
              </ul>
              <p className="text-xs mt-1 text-slate-600">Comprimento: {instanceId.trim().length} caracteres</p>
            </div>
          )}
        </div>

        {/* CLIENT TOKEN */}
        <div>
          <Label htmlFor="clientToken">Client Token (Token da Instância) *</Label>
          <div className="flex gap-2 mt-1">
            <div className="relative flex-1">
              <Input
                id="clientToken"
                type={showToken ? "text" : "password"}
                value={clientToken}
                onChange={handleClientTokenChange}
                placeholder="FCA8C0E84C200511139162ED"
                className="font-mono text-sm pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => colarDoClipboard("clientToken")}
            >
              <Copy className="w-4 h-4 mr-1" />
              Colar
            </Button>
          </div>

          {/* VALIDAÇÃO CLIENT TOKEN */}
          {validacoes.clientToken && (
            <div className={`mt-2 p-2 rounded text-sm ${validacoes.clientToken.valido ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              <p className="font-semibold flex items-center gap-2">
                {validacoes.clientToken.valido ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {validacoes.clientToken.mensagem}
              </p>
              <ul className="mt-1 ml-6 text-xs space-y-0.5">
                <li>{validacoes.clientToken.detalhes.comprimentoMinimo ? '✓' : '✗'} comprimentoMinimo: {validacoes.clientToken.detalhes.comprimentoMinimo ? 'OK' : 'mínimo 24 caracteres'}</li>
                <li>{validacoes.clientToken.detalhes.semEspacos ? '✓' : '✗'} semEspacos: {validacoes.clientToken.detalhes.semEspacos ? 'OK' : 'remova espaços'}</li>
                <li>{validacoes.clientToken.detalhes.formatoHex ? '✓' : '✗'} formatoHex: {validacoes.clientToken.detalhes.formatoHex ? 'OK' : 'apenas A-F e 0-9'}</li>
                <li>{validacoes.clientToken.detalhes.caracteresValidos ? '✓' : '✗'} caracteresValidos: {validacoes.clientToken.detalhes.caracteresValidos ? 'OK' : '24-32 caracteres hex'}</li>
              </ul>
              <p className="text-xs mt-1 text-slate-600">Comprimento: {clientToken.trim().length} caracteres</p>
            </div>
          )}

          <div className="flex items-start gap-2 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Salvo criptografado no banco de dados</span>
          </div>
        </div>

        {/* STATUS GERAL */}
        {ambosValidos && (
          <Alert className="bg-green-50 border-green-300">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900 font-bold">✅ Credenciais Prontas!</AlertTitle>
            <AlertDescription className="text-green-800 text-sm">
              Instance ID e Client Token validados. Clique em "Testar Conexão" para verificar se funcionam na Z-API.
            </AlertDescription>
          </Alert>
        )}

        {/* BOTÃO DE TESTE */}
        <Button
          onClick={testarConexaoDireta}
          disabled={!ambosValidos || testando}
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
          size="lg"
        >
          {testando ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Testando...
            </>
          ) : (
            <>
              <ExternalLink className="w-5 h-5 mr-2" />
              Testar Conexão com Z-API
            </>
          )}
        </Button>

        {/* RESULTADO DO TESTE */}
        {resultadoTeste && (
          <Alert className={resultadoTeste.sucesso ? (resultadoTeste.conectado ? "bg-green-50 border-green-300" : "bg-yellow-50 border-yellow-300") : "bg-red-50 border-red-300"}>
            {resultadoTeste.sucesso ? (
              resultadoTeste.conectado ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <AlertTitle className="text-green-900 font-bold">✅ Teste Bem-Sucedido!</AlertTitle>
                  <AlertDescription className="text-green-800">
                    <p className="mb-2"><strong>Status:</strong> {resultadoTeste.conectado ? 'WhatsApp Conectado' : 'Token Válido'}</p>
                    <p><strong>Tempo de Resposta:</strong> {resultadoTeste.tempoResposta}</p>
                  </AlertDescription>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <AlertTitle className="text-yellow-900 font-bold">⚠️ Token Válido, WhatsApp Desconectado</AlertTitle>
                  <AlertDescription className="text-yellow-800">
                    <p>As credenciais são válidas, mas o WhatsApp não está conectado nesta instância.</p>
                    <p className="mt-2 font-semibold">Ação necessária:</p>
                    <ol className="list-decimal ml-4 mt-1 text-sm">
                      <li>Acesse o painel da Z-API</li>
                      <li>Escaneie o QR Code com seu WhatsApp</li>
                    </ol>
                  </AlertDescription>
                </>
              )
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                <AlertTitle className="text-red-900 font-bold">❌ Teste Falhou</AlertTitle>
                <AlertDescription className="text-red-800">
                  <p><strong>Erro:</strong> {resultadoTeste.erro}</p>
                  {resultadoTeste.detalhes && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold">Ver Detalhes</summary>
                      <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
                        {JSON.stringify(resultadoTeste.detalhes, null, 2)}
                      </pre>
                    </details>
                  )}
                </AlertDescription>
              </>
            )}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}