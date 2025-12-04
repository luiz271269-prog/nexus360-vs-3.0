
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { 
  Image, 
  Video, 
  Mic, 
  FileText,
  Send,
  Upload,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export default function TestadorTiposMidia({ integracoes }) {
  const [testeAtivo, setTesteAtivo] = useState(null);
  const [numeroTeste, setNumeroTeste] = useState("+55 48 99932-2400");
  const [arquivo, setArquivo] = useState(null);
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState([]);

  const integracaoAtiva = integracoes?.find(i => i.status === 'conectado');

  const tiposTeste = [
    {
      tipo: "image",
      nome: "Imagem",
      icon: Image,
      color: "from-green-500 to-emerald-600",
      accepts: "image/*",
      descricao: "Teste de envio de imagens (JPG, PNG, etc.)"
    },
    {
      tipo: "video",
      nome: "Vídeo",
      icon: Video,
      color: "from-purple-500 to-indigo-600",
      accepts: "video/*",
      descricao: "Teste de envio de vídeos (MP4, etc.)"
    },
    {
      tipo: "audio",
      nome: "Áudio",
      icon: Mic,
      color: "from-orange-500 to-red-600",
      accepts: "audio/*",
      descricao: "Teste de envio de áudios (MP3, OGG, etc.)"
    },
    {
      tipo: "document",
      nome: "Documento",
      icon: FileText,
      color: "from-blue-500 to-cyan-600",
      accepts: ".pdf,.doc,.docx,.xls,.xlsx",
      descricao: "Teste de envio de documentos (PDF, Word, Excel)"
    }
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArquivo(file);
      toast.info(`Arquivo selecionado: ${file.name}`);
    }
  };

  const handleEnviarTeste = async () => {
    if (!integracaoAtiva) {
      toast.error("Nenhuma integração ativa encontrada");
      return;
    }

    if (!arquivo) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    setEnviando(true);
    const inicio = Date.now();

    try {
      console.log('[TESTE] Enviando arquivo:', arquivo.name);

      // 1. Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });
      console.log('[TESTE] Arquivo uploaded:', file_url);

      // 2. Enviar via WhatsApp
      const response = await base44.functions.invoke('enviarWhatsApp', {
        integration_id: integracaoAtiva.id,
        numero_destino: numeroTeste,
        mensagem: legenda || `Teste de ${testeAtivo?.nome}`,
        media_url: file_url,
        media_type: testeAtivo?.tipo,
        media_caption: legenda
      });

      const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(2);

      if (response.data.success) {
        const resultado = {
          tipo: testeAtivo.tipo,
          status: "sucesso",
          tempo: tempoTotal,
          arquivo: arquivo.name,
          timestamp: new Date().toISOString()
        };
        
        setResultados([resultado, ...resultados]);
        
        toast.success(
          <div>
            <p className="font-bold">✅ Teste de {testeAtivo.nome} bem-sucedido!</p>
            <p className="text-sm mt-1">Tempo: {tempoTotal}s</p>
          </div>,
          { duration: 5000 }
        );
        
        // Limpar formulário
        setArquivo(null);
        setLegenda("");
        setTesteAtivo(null);
        
      } else {
        throw new Error(response.data.error || "Erro desconhecido");
      }

    } catch (error) {
      console.error('[TESTE] Erro:', error);
      
      const resultado = {
        tipo: testeAtivo?.tipo,
        status: "erro",
        erro: error.message,
        timestamp: new Date().toISOString()
      };
      
      setResultados([resultado, ...resultados]);
      
      toast.error(`Erro no teste: ${error.message}`);
    }

    setEnviando(false);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Testador de Tipos de Mídia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Envie diferentes tipos de arquivos para validar o processamento de mídia no sistema.
          </p>

          {/* Seleção de Tipo */}
          {!testeAtivo ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {tiposTeste.map((tipo) => {
                const Icon = tipo.icon;
                return (
                  <button
                    key={tipo.tipo}
                    onClick={() => setTesteAtivo(tipo)}
                    className={`p-6 rounded-xl bg-gradient-to-br ${tipo.color} text-white hover:scale-105 transition-transform shadow-lg`}
                  >
                    <Icon className="w-8 h-8 mx-auto mb-2" />
                    <div className="font-bold">{tipo.nome}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${testeAtivo.color} flex items-center justify-center`}>
                    <testeAtivo.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold">Teste de {testeAtivo.nome}</div>
                    <div className="text-xs text-slate-500">{testeAtivo.descricao}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTesteAtivo(null);
                    setArquivo(null);
                    setLegenda("");
                  }}
                >
                  Cancelar
                </Button>
              </div>

              <div>
                <Label>Número de Teste</Label>
                <Input
                  value={numeroTeste}
                  onChange={(e) => setNumeroTeste(e.target.value)}
                  placeholder="+55 48 99999-9999"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  accept={testeAtivo.accepts}
                  onChange={handleFileChange}
                  className="mt-1"
                />
                {arquivo && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {arquivo.name} ({(arquivo.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div>
                <Label>Legenda (Opcional)</Label>
                <Input
                  value={legenda}
                  onChange={(e) => setLegenda(e.target.value)}
                  placeholder="Adicione uma legenda..."
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleEnviarTeste}
                disabled={!arquivo || enviando || !integracaoAtiva}
                className={`w-full bg-gradient-to-r ${testeAtivo.color}`}
              >
                {enviando ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Teste
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados dos Testes */}
      {resultados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Testes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resultados.map((resultado, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                    resultado.status === "sucesso"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {resultado.status === "sucesso" ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <div>
                      <div className="font-semibold text-sm">
                        {resultado.tipo.toUpperCase()} - {resultado.status}
                      </div>
                      {resultado.arquivo && (
                        <div className="text-xs text-slate-600">{resultado.arquivo}</div>
                      )}
                      {resultado.erro && (
                        <div className="text-xs text-red-600">{resultado.erro}</div>
                      )}
                    </div>
                  </div>
                  {resultado.tempo && (
                    <div className="text-xs text-slate-500">{resultado.tempo}s</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
