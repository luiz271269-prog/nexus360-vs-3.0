import Agenda from './pages/Agenda';
import AnalisePlaybooksCritica from './pages/AnalisePlaybooksCritica';
import AnalyticsAvancado from './pages/AnalyticsAvancado';
import AnalyticsPlaybooks from './pages/AnalyticsPlaybooks';
import Auditoria from './pages/Auditoria';
import BackupManager from './pages/BackupManager';
import BaseConhecimento from './pages/BaseConhecimento';
import ChecklistProducao from './pages/ChecklistProducao';
import ChecklistValidacaoZAPI from './pages/ChecklistValidacaoZAPI';
import Clientes from './pages/Clientes';
import Comunicacao from './pages/Comunicacao';
import ContatosParados from './pages/ContatosParados';
import Dashboard from './pages/Dashboard';
import DashboardExecutivo from './pages/DashboardExecutivo';
import DebugWebhooks from './pages/DebugWebhooks';
import DiagnosticoCirurgico from './pages/DiagnosticoCirurgico';
import DiagnosticoDetalhado from './pages/DiagnosticoDetalhado';
import DiagnosticoInbound from './pages/DiagnosticoInbound';
import DiagnosticoPreAtendimento from './pages/DiagnosticoPreAtendimento';
import DiagnosticoWhatsApp from './pages/DiagnosticoWhatsApp';
import Documentacao from './pages/Documentacao';
import DocumentacaoCompleta from './pages/DocumentacaoCompleta';
import DocumentacaoDeployment from './pages/DocumentacaoDeployment';
import DocumentacaoImplementacao from './pages/DocumentacaoImplementacao';
import EstrategiaImplementacao from './pages/EstrategiaImplementacao';
import Fase1 from './pages/Fase1';
import Fase2 from './pages/Fase2';
import Fase2Documentacao from './pages/Fase2Documentacao';
import Fase3 from './pages/Fase3';
import Fase4 from './pages/Fase4';
import GerenciadorPermissoes from './pages/GerenciadorPermissoes';
import Home from './pages/Home';
import Importacao from './pages/Importacao';
import InteligenciaMetricas from './pages/InteligenciaMetricas';
import KPIDashboard from './pages/KPIDashboard';
import LeadsQualificados from './pages/LeadsQualificados';
import Metas from './pages/Metas';
import MonitoramentoRealTime from './pages/MonitoramentoRealTime';
import NexusCommandCenter from './pages/NexusCommandCenter';
import OrcamentoDetalhes from './pages/OrcamentoDetalhes';
import Orcamentos from './pages/Orcamentos';
import PlanoImplementacao from './pages/PlanoImplementacao';
import PlaybooksAutomacao from './pages/PlaybooksAutomacao';
import Precificacao from './pages/Precificacao';
import Produtos from './pages/Produtos';
import RoteamentoInteligente from './pages/RoteamentoInteligente';
import SetupWizard from './pages/SetupWizard';
import SystemHealth from './pages/SystemHealth';
import TesteFluxoControlado from './pages/TesteFluxoControlado';
import TestePersistenciaDireta from './pages/TestePersistenciaDireta';
import TesteWebhookDireto from './pages/TesteWebhookDireto';
import Testes from './pages/Testes';
import TestesAutomatizados from './pages/TestesAutomatizados';
import TestesIA from './pages/TestesIA';
import TestesIntegracao from './pages/TestesIntegracao';
import TestesPreAtendimento from './pages/TestesPreAtendimento';
import Usuarios from './pages/Usuarios';
import Vendas from './pages/Vendas';
import Vendedores from './pages/Vendedores';
import WhatsAppTemplates from './pages/WhatsAppTemplates';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Agenda": Agenda,
    "AnalisePlaybooksCritica": AnalisePlaybooksCritica,
    "AnalyticsAvancado": AnalyticsAvancado,
    "AnalyticsPlaybooks": AnalyticsPlaybooks,
    "Auditoria": Auditoria,
    "BackupManager": BackupManager,
    "BaseConhecimento": BaseConhecimento,
    "ChecklistProducao": ChecklistProducao,
    "ChecklistValidacaoZAPI": ChecklistValidacaoZAPI,
    "Clientes": Clientes,
    "Comunicacao": Comunicacao,
    "ContatosParados": ContatosParados,
    "Dashboard": Dashboard,
    "DashboardExecutivo": DashboardExecutivo,
    "DebugWebhooks": DebugWebhooks,
    "DiagnosticoCirurgico": DiagnosticoCirurgico,
    "DiagnosticoDetalhado": DiagnosticoDetalhado,
    "DiagnosticoInbound": DiagnosticoInbound,
    "DiagnosticoPreAtendimento": DiagnosticoPreAtendimento,
    "DiagnosticoWhatsApp": DiagnosticoWhatsApp,
    "Documentacao": Documentacao,
    "DocumentacaoCompleta": DocumentacaoCompleta,
    "DocumentacaoDeployment": DocumentacaoDeployment,
    "DocumentacaoImplementacao": DocumentacaoImplementacao,
    "EstrategiaImplementacao": EstrategiaImplementacao,
    "Fase1": Fase1,
    "Fase2": Fase2,
    "Fase2Documentacao": Fase2Documentacao,
    "Fase3": Fase3,
    "Fase4": Fase4,
    "GerenciadorPermissoes": GerenciadorPermissoes,
    "Home": Home,
    "Importacao": Importacao,
    "InteligenciaMetricas": InteligenciaMetricas,
    "KPIDashboard": KPIDashboard,
    "LeadsQualificados": LeadsQualificados,
    "Metas": Metas,
    "MonitoramentoRealTime": MonitoramentoRealTime,
    "NexusCommandCenter": NexusCommandCenter,
    "OrcamentoDetalhes": OrcamentoDetalhes,
    "Orcamentos": Orcamentos,
    "PlanoImplementacao": PlanoImplementacao,
    "PlaybooksAutomacao": PlaybooksAutomacao,
    "Precificacao": Precificacao,
    "Produtos": Produtos,
    "RoteamentoInteligente": RoteamentoInteligente,
    "SetupWizard": SetupWizard,
    "SystemHealth": SystemHealth,
    "TesteFluxoControlado": TesteFluxoControlado,
    "TestePersistenciaDireta": TestePersistenciaDireta,
    "TesteWebhookDireto": TesteWebhookDireto,
    "Testes": Testes,
    "TestesAutomatizados": TestesAutomatizados,
    "TestesIA": TestesIA,
    "TestesIntegracao": TestesIntegracao,
    "TestesPreAtendimento": TestesPreAtendimento,
    "Usuarios": Usuarios,
    "Vendas": Vendas,
    "Vendedores": Vendedores,
    "WhatsAppTemplates": WhatsAppTemplates,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};