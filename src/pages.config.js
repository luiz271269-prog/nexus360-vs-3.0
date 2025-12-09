import Dashboard from './pages/Dashboard';
import Vendedores from './pages/Vendedores';
import Clientes from './pages/Clientes';
import Orcamentos from './pages/Orcamentos';
import Importacao from './pages/Importacao';
import Vendas from './pages/Vendas';
import Usuarios from './pages/Usuarios';
import Produtos from './pages/Produtos';
import OrcamentoDetalhes from './pages/OrcamentoDetalhes';
import Precificacao from './pages/Precificacao';
import InteligenciaMetricas from './pages/InteligenciaMetricas';
import WhatsAppTemplates from './pages/WhatsAppTemplates';
import DebugWebhooks from './pages/DebugWebhooks';
import BaseConhecimento from './pages/BaseConhecimento';
import Testes from './pages/Testes';
import AnalyticsAvancado from './pages/AnalyticsAvancado';
import Auditoria from './pages/Auditoria';
import SystemHealth from './pages/SystemHealth';
import DocumentacaoDeployment from './pages/DocumentacaoDeployment';
import ChecklistProducao from './pages/ChecklistProducao';
import DiagnosticoWhatsApp from './pages/DiagnosticoWhatsApp';
import Comunicacao from './pages/Comunicacao';
import TestesIA from './pages/TestesIA';
import RoteamentoInteligente from './pages/RoteamentoInteligente';
import NexusCommandCenter from './pages/NexusCommandCenter';
import Agenda from './pages/Agenda';
import EstrategiaImplementacao from './pages/EstrategiaImplementacao';
import DocumentacaoImplementacao from './pages/DocumentacaoImplementacao';
import Fase1 from './pages/Fase1';
import Fase2 from './pages/Fase2';
import Fase3 from './pages/Fase3';
import Fase4 from './pages/Fase4';
import DiagnosticoInbound from './pages/DiagnosticoInbound';
import ChecklistValidacaoZAPI from './pages/ChecklistValidacaoZAPI';
import BackupManager from './pages/BackupManager';
import PlanoImplementacao from './pages/PlanoImplementacao';
import TestesPreAtendimento from './pages/TestesPreAtendimento';
import Fase2Documentacao from './pages/Fase2Documentacao';
import DiagnosticoPreAtendimento from './pages/DiagnosticoPreAtendimento';
import PlaybooksAutomacao from './pages/PlaybooksAutomacao';
import AnalyticsPlaybooks from './pages/AnalyticsPlaybooks';
import AnalisePlaybooksCritica from './pages/AnalisePlaybooksCritica';
import TestesAutomatizados from './pages/TestesAutomatizados';
import Documentacao from './pages/Documentacao';
import KPIDashboard from './pages/KPIDashboard';
import TestesIntegracao from './pages/TestesIntegracao';
import SetupWizard from './pages/SetupWizard';
import MonitoramentoRealTime from './pages/MonitoramentoRealTime';
import DocumentacaoCompleta from './pages/DocumentacaoCompleta';
import DashboardExecutivo from './pages/DashboardExecutivo';
import Metas from './pages/Metas';
import LeadsQualificados from './pages/LeadsQualificados';
import GerenciadorPermissoes from './pages/GerenciadorPermissoes';
import TesteWebhookDireto from './pages/TesteWebhookDireto';
import DiagnosticoDetalhado from './pages/DiagnosticoDetalhado';
import DiagnosticoCirurgico from './pages/DiagnosticoCirurgico';
import TestePersistenciaDireta from './pages/TestePersistenciaDireta';
import TesteFluxoControlado from './pages/TesteFluxoControlado';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Vendedores": Vendedores,
    "Clientes": Clientes,
    "Orcamentos": Orcamentos,
    "Importacao": Importacao,
    "Vendas": Vendas,
    "Usuarios": Usuarios,
    "Produtos": Produtos,
    "OrcamentoDetalhes": OrcamentoDetalhes,
    "Precificacao": Precificacao,
    "InteligenciaMetricas": InteligenciaMetricas,
    "WhatsAppTemplates": WhatsAppTemplates,
    "DebugWebhooks": DebugWebhooks,
    "BaseConhecimento": BaseConhecimento,
    "Testes": Testes,
    "AnalyticsAvancado": AnalyticsAvancado,
    "Auditoria": Auditoria,
    "SystemHealth": SystemHealth,
    "DocumentacaoDeployment": DocumentacaoDeployment,
    "ChecklistProducao": ChecklistProducao,
    "DiagnosticoWhatsApp": DiagnosticoWhatsApp,
    "Comunicacao": Comunicacao,
    "TestesIA": TestesIA,
    "RoteamentoInteligente": RoteamentoInteligente,
    "NexusCommandCenter": NexusCommandCenter,
    "Agenda": Agenda,
    "EstrategiaImplementacao": EstrategiaImplementacao,
    "DocumentacaoImplementacao": DocumentacaoImplementacao,
    "Fase1": Fase1,
    "Fase2": Fase2,
    "Fase3": Fase3,
    "Fase4": Fase4,
    "DiagnosticoInbound": DiagnosticoInbound,
    "ChecklistValidacaoZAPI": ChecklistValidacaoZAPI,
    "BackupManager": BackupManager,
    "PlanoImplementacao": PlanoImplementacao,
    "TestesPreAtendimento": TestesPreAtendimento,
    "Fase2Documentacao": Fase2Documentacao,
    "DiagnosticoPreAtendimento": DiagnosticoPreAtendimento,
    "PlaybooksAutomacao": PlaybooksAutomacao,
    "AnalyticsPlaybooks": AnalyticsPlaybooks,
    "AnalisePlaybooksCritica": AnalisePlaybooksCritica,
    "TestesAutomatizados": TestesAutomatizados,
    "Documentacao": Documentacao,
    "KPIDashboard": KPIDashboard,
    "TestesIntegracao": TestesIntegracao,
    "SetupWizard": SetupWizard,
    "MonitoramentoRealTime": MonitoramentoRealTime,
    "DocumentacaoCompleta": DocumentacaoCompleta,
    "DashboardExecutivo": DashboardExecutivo,
    "Metas": Metas,
    "LeadsQualificados": LeadsQualificados,
    "GerenciadorPermissoes": GerenciadorPermissoes,
    "TesteWebhookDireto": TesteWebhookDireto,
    "DiagnosticoDetalhado": DiagnosticoDetalhado,
    "DiagnosticoCirurgico": DiagnosticoCirurgico,
    "TestePersistenciaDireta": TestePersistenciaDireta,
    "TesteFluxoControlado": TesteFluxoControlado,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};