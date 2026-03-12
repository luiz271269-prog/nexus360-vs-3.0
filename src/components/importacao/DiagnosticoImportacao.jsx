import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Image, 
  Table, 
  Brain,
  PlayCircle,
  Loader2,
  Zap
} from "lucide-react";

export default function DiagnosticoImportacao({ arquivo, onResultado }) {
  const [diagnostico, setDiagnostico] = useState(null);
  const [executando, setExecutando] = useState(false);

  const detectarTipoArquivo = (arquivo) => {
    if (!arquivo || !arquivo.nome) return "Desconhecido";
    const extensao = arquivo.nome.split('.').pop().toLowerCase();
    const mapeamento = {
      'pdf': 'PDF', 'xlsx': 'Excel', 'csv': 'CSV',
      'docx': 'Word', 'doc': 'Word', 'jpg': 'Imagem', 
      'jpeg': 'Imagem', 'png': 'Imagem', 'xml': 'XML', 'json': 'JSON'
    };
    return mapeamento[extensao] || 'Outro';
  };

  const executarDiagnostico = async () => {
    setExecutando(true);
    setDiagnostico(null);

    const resultado = {
      arquivo: {
        nome: arquivo?.nome || "Arquivo de teste",
        tipo: detectarTipoArquivo(arquivo),
        tamanho: arquivo?.tamanho || 0
      },
      etapas: [],
      sucesso: false,
      dados_extraidos: null,
      erro_detalhado: null
    };

    try {
      // ETAPA 1: Validação do arquivo
      resultado.etapas.push({ nome: "Validação do Arquivo", status: "executando" });
      setDiagnostico({...resultado});

      let fileUrl = arquivo?.url;
      if (!fileUrl && arquivo?.file) {
        try {
          const uploadResult = await UploadFile({ file: arquivo.file });
          fileUrl = uploadResult.file_url;
        } catch (uploadError) {
          resultado.etapas[resultado.etapas.length - 1].status = "erro";
          resultado.etapas[resultado.etapas.length - 1].detalhes = `Erro no upload: ${uploadError.message}`;
          setDiagnostico({...resultado});
          return;
        }
      }

      if (!fileUrl) {
        resultado.etapas[resultado.etapas.length - 1].status = "erro";
        resultado.etapas[resultado.etapas.length - 1].detalhes = "URL do arquivo não encontrada";
        setDiagnostico({...resultado});
        return;
      }

      resultado.etapas[resultado.etapas.length - 1].status = "sucesso";
      resultado.etapas[resultado.etapas.length - 1].detalhes = `Arquivo acessível: ${fileUrl.substring(0, 50)}...`;
      setDiagnostico({...resultado});

      // ETAPA 2: Extração Inteligente com IA
      resultado.etapas.push({ nome: "Extração Inteligente (IA Direta)", status: "executando" });
      setDiagnostico({...resultado});

      const prompt = `
Analise este arquivo e extraia TODOS os dados estruturados possíveis.

INSTRUÇÕES CRÍTICAS:
1. Se for uma planilha/tabela: extraia TODAS as linhas de dados
2. Se for uma imagem: extraia TODOS os textos, números, datas visíveis
3. Se for um documento: extraia TODAS as informações estruturadas
4. NUNCA retorne um array vazio - sempre tente extrair alguma informação
5. Se não há dados tabulares, extraia pelo menos o conteúdo textual estruturado

FORMATO OBRIGATÓRIO:
{
  "dados_extraidos": [
    // Array com PELO MENOS 1 objeto, mesmo que seja informação básica
  ],
  "tipo_conteudo": "planilha|documento|imagem|lista|outro",
  "campos_identificados": ["campo1", "campo2", ...],
  "confianca": numero_0_a_100,
  "observacoes": "descrição do que foi encontrado"
}

NUNCA deixe dados_extraidos vazio. Se necessário, crie um objeto com informações básicas do arquivo.
`;

      let dadosExtraidos = null;
      const tsInicioDiagnostico = Date.now();
      try {
       const resultadoIA = await base44.integrations.Core.InvokeLLM({
         model: 'gemini_3_flash',
         prompt: prompt,
         file_urls: [fileUrl],
         response_json_schema: {
           type: "object",
           properties: {
             dados_extraidos: {
               type: "array",
               items: { type: "object", additionalProperties: true }
             },
             tipo_conteudo: { type: "string" },
             campos_identificados: { type: "array", items: { type: "string" } },
             confianca: { type: "number", minimum: 0, maximum: 100 },
             observacoes: { type: "string" }
           },
           required: ["dados_extraidos"]
         }
       });

        if (resultadoIA && resultadoIA.dados_extraidos && Array.isArray(resultadoIA.dados_extraidos)) {
          dadosExtraidos = resultadoIA.dados_extraidos;
          resultado.etapas[resultado.etapas.length - 1].status = "sucesso";
          resultado.etapas[resultado.etapas.length - 1].detalhes = `${dadosExtraidos.length} registros extraídos (Confiança: ${resultadoIA.confianca || 75}%)`;
          resultado.metadados_ia = {
            tipo: resultadoIA.tipo_conteudo,
            campos: resultadoIA.campos_identificados,
            confianca: resultadoIA.confianca,
            observacoes: resultadoIA.observacoes
          };
        } else {
          throw new Error("IA não retornou dados válidos");
        }
      } catch (erroIA) {
        resultado.etapas[resultado.etapas.length - 1].status = "erro";
        resultado.etapas[resultado.etapas.length - 1].detalhes = `Erro da IA: ${erroIA.message}`;
      }

      // ETAPA 3: Validação final
      resultado.etapas.push({ nome: "Validação dos Dados", status: "executando" });
      setDiagnostico({...resultado});

      if (dadosExtraidos && dadosExtraidos.length > 0) {
        resultado.sucesso = true;
        resultado.dados_extraidos = dadosExtraidos;
        resultado.etapas[resultado.etapas.length - 1].status = "sucesso";
        resultado.etapas[resultado.etapas.length - 1].detalhes = `${dadosExtraidos.length} registros validados e prontos para importação`;
      } else {
        resultado.sucesso = false;
        resultado.etapas[resultado.etapas.length - 1].status = "erro";
        resultado.etapas[resultado.etapas.length - 1].detalhes = "Nenhum dado estruturado foi encontrado no arquivo";
        resultado.erro_detalhado = "O sistema não conseguiu extrair dados estruturados do arquivo. Verifique se o arquivo contém uma tabela, lista ou dados organizados.";
      }

      setDiagnostico({...resultado});

      // SkillExecution: registrar diagnóstico
      ;(async () => {
        try {
          await base44.entities.SkillExecution.create({
            skill_name: 'importacao_diagnostico_arquivo',
            triggered_by: 'usuario_reprocessamento',
            execution_mode: 'autonomous_safe',
            context: {
              tipo_arquivo: detectarTipoArquivo(arquivo),
              nome_arquivo: arquivo?.nome,
              resultado: resultado.sucesso ? 'sucesso' : 'falha_extracao'
            },
            success: resultado.sucesso,
            error_message: resultado.sucesso ? null : resultado.erro_detalhado,
            duration_ms: Date.now() - tsInicioDiagnostico,
            metricas: resultado.sucesso ? {
              registros_extraidos: resultado.dados_extraidos?.length || 0,
              confianca: resultado.metadados_ia?.confianca || 0,
              etapas_sucesso: resultado.etapas.filter(e => e.status === 'sucesso').length,
              etapas_erro: resultado.etapas.filter(e => e.status === 'erro').length
            } : {
              etapas_executadas: resultado.etapas.length,
              etapas_erro: resultado.etapas.filter(e => e.status === 'erro').length
            }
          }).catch(() => {});
        } catch (e) {
          console.warn('[diagnostico] SkillExecution falhou:', e.message);
        }
      })();

      // Chamar callback com resultado
      if (onResultado) {
        onResultado(resultado);
      }

    } catch (error) {
      console.error("Erro no diagnóstico:", error);
      resultado.sucesso = false;
      resultado.erro_detalhado = `Erro crítico: ${error.message}`;
      if (resultado.etapas.length > 0) {
        resultado.etapas[resultado.etapas.length - 1].status = "erro";
        resultado.etapas[resultado.etapas.length - 1].detalhes = error.message;
      }
      setDiagnostico({...resultado});
      
      if (onResultado) {
        onResultado(resultado);
      }
    } finally {
      setExecutando(false);
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case "sucesso": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "erro": return <XCircle className="w-5 h-5 text-red-500" />;
      case "executando": return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getTipoIcon = (tipo) => {
    switch(tipo.toLowerCase()) {
      case "pdf": return <FileText className="w-6 h-6 text-red-500" />;
      case "excel": case "csv": return <Table className="w-6 h-6 text-green-500" />;
      case "imagem": return <Image className="w-6 h-6 text-blue-500" />;
      case "word": return <FileText className="w-6 h-6 text-blue-600" />;
      default: return <FileText className="w-6 h-6 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-purple-600" />
          <div>
            <h3 className="text-xl font-bold text-gray-800">Diagnóstico de Importação</h3>
            <p className="text-gray-600">Análise detalhada da capacidade de extração</p>
          </div>
        </div>
        
        {!executando && !diagnostico && (
          <Button onClick={executarDiagnostico} className="bg-purple-600 hover:bg-purple-700">
            <PlayCircle className="w-4 h-4 mr-2" />
            Iniciar Diagnóstico
          </Button>
        )}
      </div>

      {/* Informações do Arquivo */}
      {arquivo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTipoIcon(diagnostico?.arquivo.tipo || arquivo.tipo || "Arquivo")}
              Arquivo para Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Nome:</span>
                <span className="ml-2 font-medium">{arquivo.nome}</span>
              </div>
              <div>
                <span className="text-gray-600">Tipo:</span>
                <span className="ml-2 font-medium">{diagnostico?.arquivo.tipo || detectarTipoArquivo(arquivo)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progresso do Diagnóstico */}
      {diagnostico && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Progresso do Diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {diagnostico.etapas.map((etapa, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(etapa.status)}
                    <div>
                      <h4 className="font-medium">{etapa.nome}</h4>
                      <p className="text-sm text-gray-600">{etapa.detalhes}</p>
                    </div>
                  </div>
                  <Badge variant={etapa.status === "sucesso" ? "default" : etapa.status === "erro" ? "destructive" : "secondary"}>
                    {etapa.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado Final */}
      {diagnostico && !executando && (
        <Card className={diagnostico.sucesso ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${diagnostico.sucesso ? "text-green-800" : "text-red-800"}`}>
              {diagnostico.sucesso ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              {diagnostico.sucesso ? "Diagnóstico Bem-sucedido" : "Problemas Detectados"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {diagnostico.sucesso ? (
              <div className="space-y-3">
                <p className="text-green-700 font-medium">
                  ✅ O arquivo pode ser importado com sucesso!
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-green-600">Registros encontrados:</span>
                    <span className="ml-2 font-bold">{diagnostico.dados_extraidos?.length || 0}</span>
                  </div>
                  {diagnostico.metadados_ia && (
                    <div>
                      <span className="text-green-600">Confiança:</span>
                      <span className="ml-2 font-bold">{diagnostico.metadados_ia.confianca}%</span>
                    </div>
                  )}
                </div>
                {diagnostico.metadados_ia?.observacoes && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <p className="text-sm text-gray-700">{diagnostico.metadados_ia.observacoes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-red-700 font-medium">
                  ❌ Não foi possível extrair dados estruturados
                </p>
                <p className="text-red-600 text-sm">
                  {diagnostico.erro_detalhado}
                </p>
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <h4 className="font-medium text-yellow-800 mb-2">💡 Sugestões:</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Verifique se o arquivo contém uma tabela ou lista organizada</li>
                    <li>• Para imagens, certifique-se de que o texto está legível</li>
                    <li>• Para planilhas, verifique se há cabeçalhos nas colunas</li>
                    <li>• Tente converter o arquivo para um formato mais estruturado (CSV, XLSX)</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}