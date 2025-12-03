import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Image, 
  FileAudio, 
  FileText, 
  Video, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Send 
} from "lucide-react";

export default function GuiaTesteMidia() {
  const [resultados, setResultados] = useState({});
  const [testando, setTestando] = useState(null);

  const tiposMidia = [
    {
      tipo: 'image',
      nome: 'Imagem',
      icon: Image,
      instrucao: 'Envie uma imagem (JPG/PNG) do seu smartphone',
      campoZ: 'payload.image?.url',
      cor: 'blue'
    },
    {
      tipo: 'audio',
      nome: 'Áudio',
      icon: FileAudio,
      instrucao: 'Grave e envie um áudio de voz',
      campoZ: 'payload.audio?.url',
      cor: 'green'
    },
    {
      tipo: 'document',
      nome: 'Documento',
      icon: FileText,
      instrucao: 'Envie um PDF ou documento',
      campoZ: 'payload.document?.url',
      cor: 'purple'
    },
    {
      tipo: 'video',
      nome: 'Vídeo',
      icon: Video,
      instrucao: 'Envie um vídeo curto',
      campoZ: 'payload.video?.url',
      cor: 'red'
    }
  ];

  const handleIniciarTeste = (tipo) => {
    setTestando(tipo);
    // Instruir usuário a enviar
  };

  const verificarWebhookLog = async (tipo) => {
    // Buscar últimos webhooks e verificar se capturou mídia
    // Implementação simplificada
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            Guia de Teste de Mídia - Z-API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Instruções Gerais */}
          <Alert>
            <AlertDescription>
              <strong>Como testar:</strong><br />
              1. Clique em "Iniciar Teste" para um tipo de mídia<br />
              2. Envie a mídia do seu smartphone para o número da instância<br />
              3. Aguarde 5 segundos<br />
              4. Clique em "Verificar Recebimento"<br />
              5. O sistema verificará se a mídia foi capturada corretamente
            </AlertDescription>
          </Alert>

          {/* Cards de Teste por Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tiposMidia.map((item) => {
              const Icon = item.icon;
              const resultado = resultados[item.tipo];
              
              return (
                <Card key={item.tipo} className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 text-${item.cor}-500`} />
                        {item.nome}
                      </div>
                      {resultado && (
                        resultado.sucesso ? 
                          <CheckCircle className="w-5 h-5 text-green-500" /> :
                          <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-600">{item.instrucao}</p>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleIniciarTeste(item.tipo)}
                        disabled={testando !== null}
                        className="flex-1"
                      >
                        {testando === item.tipo ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Aguardando...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Iniciar Teste
                          </>
                        )}
                      </Button>
                      
                      {testando === item.tipo && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => verificarWebhookLog(item.tipo)}
                        >
                          Verificar
                        </Button>
                      )}
                    </div>

                    {resultado && (
                      <div className={`p-2 rounded text-sm ${
                        resultado.sucesso ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}>
                        {resultado.mensagem}
                      </div>
                    )}

                    <div className="text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded">
                      Campo Z-API: {item.campoZ}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Resultado Consolidado */}
          {Object.keys(resultados).length > 0 && (
            <Card className="bg-slate-50">
              <CardHeader>
                <CardTitle className="text-base">Resultado dos Testes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(resultados).map(([tipo, resultado]) => (
                    <div key={tipo} className="flex items-center justify-between">
                      <span className="capitalize">{tipo}</span>
                      <Badge variant={resultado.sucesso ? 'default' : 'destructive'}>
                        {resultado.sucesso ? 'PASSOU' : 'FALHOU'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </CardContent>
      </Card>
    </div>
  );
}