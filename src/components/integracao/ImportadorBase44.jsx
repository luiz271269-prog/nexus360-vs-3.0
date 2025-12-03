import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { ImportadorProjetoOrcamentos } from '../scripts/importar-projeto-orcamentos';

export default function ImportadorBase44() {
  const [dadosImportacao, setDadosImportacao] = useState('');
  const [relatorioCompatibilidade, setRelatorioCompatibilidade] = useState(null);
  const [logImportacao, setLogImportacao] = useState([]);
  const [processando, setProcessando] = useState(false);

  const analisarCompatibilidade = async () => {
    try {
      const dados = JSON.parse(dadosImportacao);
      const relatorio = await ImportadorProjetoOrcamentos.gerarRelatorioCompatibilidade(dados);
      setRelatorioCompatibilidade(relatorio);
    } catch (error) {
      alert('Erro ao analisar dados. Verifique se o JSON está correto.');
    }
  };

  const executarImportacao = async () => {
    if (!dadosImportacao.trim()) {
      alert('Cole os dados de exportação primeiro.');
      return;
    }

    setProcessando(true);
    setLogImportacao([]);

    try {
      const dados = JSON.parse(dadosImportacao);
      const resultado = await ImportadorProjetoOrcamentos.importarDadosCompletos(dados);
      
      setLogImportacao(resultado.log);
      
      if (resultado.sucesso) {
        alert('Importação concluída com sucesso!');
      } else {
        alert(`Importação finalizada com erros: ${resultado.erro}`);
      }
    } catch (error) {
      alert(`Erro na importação: ${error.message}`);
      setLogImportacao([`Erro crítico: ${error.message}`]);
    }

    setProcessando(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">
            Importador de Projeto Base44
          </h2>
          <p className="text-slate-600 mt-1">
            Importe dados do projeto de orçamentos (App ID: 688ba5d6f456445f29c31db7)
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Instruções */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                Como Importar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800">1</Badge>
                <p className="text-sm">Acesse o projeto original no base44 e exporte os dados</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800">2</Badge>
                <p className="text-sm">Cole o JSON exportado no campo abaixo</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800">3</Badge>
                <p className="text-sm">Analise a compatibilidade antes de importar</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="bg-blue-100 text-blue-800">4</Badge>
                <p className="text-sm">Execute a importação e acompanhe o progresso</p>
              </div>
            </CardContent>
          </Card>

          {/* Área de Dados */}
          <div className="space-y-4">
            <Label htmlFor="dados">Dados de Exportação (JSON)</Label>
            <Textarea
              id="dados"
              value={dadosImportacao}
              onChange={(e) => setDadosImportacao(e.target.value)}
              placeholder={`Cole aqui o JSON exportado do projeto base44...

Exemplo:
{
  "produtos": [...],
  "clientes": [...],
  "orcamentos": [...]
}`}
              className="h-48 font-mono text-sm"
            />
            <div className="flex gap-3">
              <Button 
                onClick={analisarCompatibilidade}
                variant="outline"
                disabled={!dadosImportacao.trim()}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Analisar Compatibilidade
              </Button>
              <Button 
                onClick={executarImportacao}
                disabled={!dadosImportacao.trim() || processando}
                className="bg-amber-500 hover:bg-amber-600"
              >
                <Upload className="w-4 h-4 mr-2" />
                {processando ? 'Importando...' : 'Executar Importação'}
              </Button>
            </div>
          </div>

          {/* Relatório de Compatibilidade */}
          {relatorioCompatibilidade && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Relatório de Compatibilidade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600">Produtos</p>
                    <p className="text-xl font-bold text-blue-800">
                      {relatorioCompatibilidade.estatisticas.produtos || 0}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600">Clientes</p>
                    <p className="text-xl font-bold text-green-800">
                      {relatorioCompatibilidade.estatisticas.clientes || 0}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600">Orçamentos</p>
                    <p className="text-xl font-bold text-purple-800">
                      {relatorioCompatibilidade.estatisticas.orcamentos || 0}
                    </p>
                  </div>
                </div>

                {relatorioCompatibilidade.recomendacoes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-slate-700">Recomendações:</h4>
                    {relatorioCompatibilidade.recomendacoes.map((rec, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Log de Importação */}
          {logImportacao.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Log de Importação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-900 text-green-400 p-4 rounded-lg max-h-64 overflow-y-auto font-mono text-sm">
                  {logImportacao.map((linha, index) => (
                    <div key={index} className="mb-1">
                      {linha}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end">
          <Button variant="outline" onClick={() => window.history.back()}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}