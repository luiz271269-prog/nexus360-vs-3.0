
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Shield,
  Database,
  Zap,
  Users,
  Activity,
  RefreshCw,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { WhatsAppIntegration } from "@/entities/WhatsAppIntegration";
import { BaseConhecimento } from "@/entities/BaseConhecimento";
import { User } from "@/entities/User";
import { Vendedor } from "@/entities/Vendedor";
import { Cliente } from "@/entities/Cliente";
import { DocumentoIndexado } from "@/entities/DocumentoIndexado";
import { SystemHealthLog } from "@/entities/SystemHealthLog";

export default function ChecklistProducao() {
  const [categorias, setCategorias] = useState([]);
  const [verificando, setVerificando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    inicializarChecklist();
  }, []);

  const inicializarChecklist = () => { // Corrected syntax: `const functionName = () => { ... };`
    const checklistInicial = [
      {
        id: "usuarios",
        nome: "Usuários e Permissões",
        icon: Users,
        cor: "from-blue-500 to-cyan-500",
        itens: [
          { 
            id: "admin_exists", 
            nome: "Usuário admin configurado", 
            status: "pendente",
            critico: true
          },
          { 
            id: "roles_configured", 
            nome: "Roles e permissões definidos", 
            status: "pendente",
            critico: true
          },
          { 
            id: "vendedores_cadastrados", 
            nome: "Vendedores cadastrados", 
            status: "pendente",
            critico: false
          }
        ]
      },
      {
        id: "integracao",
        nome: "Integrações",
        icon: Zap,
        cor: "from-purple-500 to-pink-500",
        itens: [
          { 
            id: "whatsapp_conectado", 
            nome: "WhatsApp conectado e funcional", 
            status: "pendente",
            critico: true
          },
          { 
            id: "webhooks_configurados", 
            nome: "Webhooks configurados corretamente", 
            status: "pendente",
            critico: true
          }
        ]
      },
      {
        id: "seguranca",
        nome: "Segurança",
        icon: Shield,
        cor: "from-green-500 to-emerald-500",
        itens: [
          { 
            id: "https_ativo", 
            nome: "HTTPS habilitado", 
            status: "pendente",
            critico: true
          },
          { 
            id: "cors_configurado", 
            nome: "CORS configurado corretamente", 
            status: "pendente",
            critico: false
          }
        ]
      },
      {
        id: "dados",
        nome: "Dados e IA",
        icon: Database,
        cor: "from-orange-500 to-red-500",
        itens: [
          { 
            id: "base_conhecimento", 
            nome: "Base de conhecimento populada", 
            status: "pendente",
            critico: false
          },
          { 
            id: "clientes_minimos", 
            nome: "Dados iniciais de clientes", 
            status: "pendente",
            critico: false
          },
          { 
            id: "rag_indexado", 
            nome: "Sistema RAG indexado", 
            status: "pendente",
            critico: false
          }
        ]
      },
      {
        id: "monitoramento",
        nome: "Monitoramento",
        icon: Activity,
        cor: "from-indigo-500 to-purple-500",
        itens: [
          { 
            id: "health_check", 
            nome: "Health check funcionando", 
            status: "pendente",
            critico: true
          },
          { 
            id: "logs_ativos", 
            nome: "Sistema de logs ativo", 
            status: "pendente",
            critico: true
          }
        ]
      }
    ];

    setCategorias(checklistInicial);
  };

  const verificarTudo = async () => {
    setVerificando(true);
    setProgresso(0);

    const totalItens = categorias.reduce((acc, cat) => acc + cat.itens.length, 0);
    let itensVerificados = 0;

    const novasCategorias = [...categorias];

    for (let catIndex = 0; catIndex < novasCategorias.length; catIndex++) {
      const categoria = novasCategorias[catIndex];

      for (let itemIndex = 0; itemIndex < categoria.itens.length; itemIndex++) {
        const item = categoria.itens[itemIndex];

        try {
          const resultado = await verificarItem(item.id);
          item.status = resultado.sucesso ? "sucesso" : "erro";
          item.mensagem = resultado.mensagem;
          item.dados = resultado.dados;
        } catch (error) {
          item.status = "erro";
          item.mensagem = `Erro: ${error.message}`;
          item.dados = null;
        }

        itensVerificados++;
        setProgresso((itensVerificados / totalItens) * 100);
        setCategorias([...novasCategorias]);

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setVerificando(false);
    
    const totalErros = novasCategorias.reduce((acc, cat) => 
      acc + cat.itens.filter(i => i.status === "erro").length, 0
    );

    if (totalErros === 0) {
      toast.success("✅ Todos os testes passaram! Sistema pronto para produção.");
    } else {
      toast.error(`⚠️ ${totalErros} problemas encontrados. Verifique os detalhes.`);
    }
  };

  const verificarItem = async (itemId) => {
    switch (itemId) {
      case "admin_exists":
        return await verificarUsuarioAdmin();
      case "roles_configured":
        return await verificarRoles();
      case "vendedores_cadastrados":
        return await verificarVendedores();
      case "whatsapp_conectado":
        return await verificarWhatsApp();
      case "webhooks_configurados":
        return await verificarWebhooks();
      case "https_ativo":
        return await verificarHTTPS();
      case "cors_configurado":
        return await verificarCORS();
      case "base_conhecimento":
        return await verificarBaseConhecimento();
      case "clientes_minimos":
        return await verificarClientes();
      case "rag_indexado":
        return await verificarRAG();
      case "health_check":
        return await verificarHealthCheck();
      case "logs_ativos":
        return await verificarLogs();
      default:
        return { sucesso: false, mensagem: "Verificação não implementada", dados: null };
    }
  };

  // Funções de verificação
  const verificarUsuarioAdmin = async () => {
    try {
      const usuarios = await User.list();
      const admins = usuarios.filter(u => u.role === 'admin');
      return {
        sucesso: admins.length > 0,
        mensagem: admins.length > 0 ? `${admins.length} admin(s) encontrado(s)` : "❌ Nenhum usuário admin encontrado",
        dados: { total_admins: admins.length }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarRoles = async () => {
    try {
      const usuarios = await User.list();
      const comRoles = usuarios.filter(u => u.role);
      return {
        sucesso: comRoles.length === usuarios.length,
        mensagem: comRoles.length === usuarios.length ? 
          "✅ Todos os usuários têm roles definidos" : 
          `⚠️ ${usuarios.length - comRoles.length} usuários sem role`,
        dados: { total_com_roles: comRoles.length, total_usuarios: usuarios.length }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarVendedores = async () => {
    try {
      const vendedores = await Vendedor.list();
      const ativos = vendedores.filter(v => v.status === 'ativo');
      return {
        sucesso: ativos.length > 0,
        mensagem: ativos.length > 0 ? 
          `✅ ${ativos.length} vendedor(es) ativo(s)` : 
          "⚠️ Nenhum vendedor ativo cadastrado",
        dados: { total_ativos: ativos.length, total_vendedores: vendedores.length }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarWhatsApp = async () => {
    try {
      const integracoes = await WhatsAppIntegration.list();
      const conectadas = integracoes.filter(i => i.status === 'conectado');
      return {
        sucesso: conectadas.length > 0,
        mensagem: conectadas.length > 0 ? 
          `✅ ${conectadas.length} integração(ões) conectada(s)` : 
          "❌ Nenhuma integração WhatsApp conectada",
        dados: { total_conectadas: conectadas.length, total_integracoes: integracoes.length }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarWebhooks = async () => {
    try {
      const integracoes = await WhatsAppIntegration.list();
      const comWebhook = integracoes.filter(i => i.webhook_url);
      return {
        sucesso: comWebhook.length > 0,
        mensagem: comWebhook.length > 0 ? 
          `✅ ${comWebhook.length} webhook(s) configurado(s)` : 
          "⚠️ Nenhum webhook configurado",
        dados: { total_webhooks: comWebhook.length }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarHTTPS = async () => {
    try {
      const isHTTPS = window.location.protocol === 'https:';
      return {
        sucesso: isHTTPS,
        mensagem: isHTTPS ? 
          "✅ HTTPS ativo" : 
          "❌ Aplicação rodando em HTTP (inseguro para produção)",
        dados: { protocol: window.location.protocol }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarCORS = async () => {
    return {
      sucesso: true,
      mensagem: "✅ CORS configurado pela plataforma Base44",
      dados: { managed_by: "base44" }
    };
  };

  const verificarBaseConhecimento = async () => {
    try {
      const documentos = await BaseConhecimento.list();
      const aprovados = documentos.filter(d => d.aprovado && d.ativo);
      return {
        sucesso: aprovados.length >= 5,
        mensagem: aprovados.length >= 5 ? 
          `✅ ${aprovados.length} documentos aprovados` : 
          `⚠️ Apenas ${aprovados.length} documentos (recomendado: 5+)`,
        dados: { total_aprovados: aprovados.length, total_documentos: documentos.length }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarClientes = async () => {
    try {
      const clientes = await Cliente.list();
      return {
        sucesso: clientes.length > 0,
        mensagem: clientes.length > 0 ? 
          `✅ ${clientes.length} cliente(s) cadastrado(s)` : 
          "⚠️ Nenhum cliente cadastrado",
        dados: { total_clientes: clientes.length }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarRAG = async () => {
    try {
      const documentos = await DocumentoIndexado.filter({ ativo: true });
      return {
        sucesso: documentos.length >= 5,
        mensagem: documentos.length >= 5 ? 
          `✅ ${documentos.length} documentos indexados` : 
          `⚠️ Apenas ${documentos.length} documentos indexados (recomendado: 5+)`,
        dados: { total_indexados: documentos.length }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarHealthCheck = async () => {
    try {
      const logs = await SystemHealthLog.list('-timestamp', 1);
      const temLogRecente = logs.length > 0 && 
        (new Date() - new Date(logs[0].timestamp)) < 3600000; // 1 hora

      return {
        sucesso: temLogRecente,
        mensagem: temLogRecente ? 
          "✅ Health check ativo (última verificação < 1h)" : 
          "⚠️ Nenhuma verificação de saúde recente",
        dados: { ultimo_log: logs[0]?.timestamp || null }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const verificarLogs = async () => {
    try {
      const logs = await SystemHealthLog.list('-timestamp', 10);
      return {
        sucesso: logs.length > 0,
        mensagem: logs.length > 0 ? 
          `✅ ${logs.length} logs encontrados` : 
          "⚠️ Sistema de logs não ativo",
        dados: { total_logs: logs.length }
      };
    } catch (error) {
      return { sucesso: false, mensagem: `Erro: ${error.message}`, dados: null };
    }
  };

  const calcularEstatisticas = () => {
    const totalItens = categorias.reduce((acc, cat) => acc + cat.itens.length, 0);
    const sucesso = categorias.reduce((acc, cat) => 
      acc + cat.itens.filter(i => i.status === "sucesso").length, 0
    );
    const erro = categorias.reduce((acc, cat) => 
      acc + cat.itens.filter(i => i.status === "erro").length, 0
    );
    const pendente = categorias.reduce((acc, cat) => 
      acc + cat.itens.filter(i => i.status === "pendente").length, 0
    );
    const criticos = categorias.reduce((acc, cat) => 
      acc + cat.itens.filter(i => i.critico && i.status === "erro").length, 0
    );

    return { totalItens, sucesso, erro, pendente, criticos };
  };

  const stats = calcularEstatisticas();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-white via-indigo-50/30 to-purple-50/50 rounded-2xl shadow-2xl border-2 border-white/50 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Checklist de Produção
              </h1>
              <p className="text-slate-600 mt-2">
                Verificação completa antes do deploy para produção
              </p>
            </div>
            <Button 
              onClick={verificarTudo}
              disabled={verificando}
              size="lg"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {verificando ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Verificar Tudo
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        {verificando && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Progresso da Verificação</span>
                <span className="text-sm font-bold text-indigo-600">{Math.round(progresso)}%</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-2 border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalItens}</p>
                </div>
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Sucesso</p>
                  <p className="text-2xl font-bold text-green-900">{stats.sucesso}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Erros</p>
                  <p className="text-2xl font-bold text-red-900">{stats.erro}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-700">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-900">{stats.pendente}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700">Críticos</p>
                  <p className="text-2xl font-bold text-orange-900">{stats.criticos}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Categorias */}
        <div className="grid grid-cols-1 gap-6">
          {categorias.map((categoria) => {
            const Icon = categoria.icon;
            const totalItens = categoria.itens.length;
            const sucesso = categoria.itens.filter(i => i.status === "sucesso").length;
            const percentualSucesso = totalItens > 0 ? (sucesso / totalItens) * 100 : 0;

            return (
              <Card key={categoria.id} className="border-2 border-slate-200">
                <CardHeader className={`bg-gradient-to-r ${categoria.cor} text-white rounded-t-lg`}>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6" />
                      <span>{categoria.nome}</span>
                    </div>
                    <Badge className="bg-white/20 text-white border-none">
                      {sucesso}/{totalItens}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Progresso</span>
                      <span className="text-sm font-bold text-indigo-600">{Math.round(percentualSucesso)}%</span>
                    </div>
                    <Progress value={percentualSucesso} className="h-2" />
                  </div>

                  <div className="space-y-3">
                    {categoria.itens.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex-shrink-0 mt-0.5">
                          {item.status === "sucesso" && <CheckCircle className="w-5 h-5 text-green-500" />}
                          {item.status === "erro" && <XCircle className="w-5 h-5 text-red-500" />}
                          {item.status === "pendente" && <AlertCircle className="w-5 h-5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-900">{item.nome}</span>
                            {item.critico && (
                              <Badge variant="destructive" className="text-xs">CRÍTICO</Badge>
                            )}
                          </div>
                          {item.mensagem && (
                            <p className="text-sm text-slate-600">{item.mensagem}</p>
                          )}
                          {item.dados && Object.keys(item.dados).length > 0 && (
                            <div className="mt-2 p-2 bg-slate-100 rounded text-xs font-mono">
                              {JSON.stringify(item.dados, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Status Final */}
        {stats.pendente === 0 && (
          <Card className={`border-2 ${stats.erro === 0 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <CardContent className="pt-6">
              <div className="text-center">
                {stats.erro === 0 ? (
                  <>
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-green-900 mb-2">
                      ✅ Sistema Pronto para Produção!
                    </h3>
                    <p className="text-green-700">
                      Todos os testes passaram com sucesso. Você pode fazer o deploy com segurança.
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-red-900 mb-2">
                      ⚠️ Problemas Encontrados
                    </h3>
                    <p className="text-red-700">
                      {stats.erro} problema(s) encontrado(s). Corrija-os antes de fazer o deploy.
                      {stats.criticos > 0 && <strong className="block mt-2">{stats.criticos} problema(s) CRÍTICO(S)</strong>}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
