/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Agenda from './pages/Agenda';
import AnaliseDetalhadaContato from './pages/AnaliseDetalhadaContato';
import AnalisePlaybooksCritica from './pages/AnalisePlaybooksCritica';
import AnalyticsAvancado from './pages/AnalyticsAvancado';
import AnalyticsPlaybooks from './pages/AnalyticsPlaybooks';
import Auditoria from './pages/Auditoria';
import Automacoes from './pages/Automacoes';
import BackupManager from './pages/BackupManager';
import BaseConhecimento from './pages/BaseConhecimento';
import ChecklistProducao from './pages/ChecklistProducao';
import ChecklistValidacaoWAPI from './pages/ChecklistValidacaoWAPI';
import ChecklistValidacaoZAPI from './pages/ChecklistValidacaoZAPI';
import Clientes from './pages/Clientes';
import Comunicacao from './pages/Comunicacao';
import ContatosParados from './pages/ContatosParados';
import Dashboard from './pages/Dashboard';
import DashboardExecutivo from './pages/DashboardExecutivo';
import DebugWebhooks from './pages/DebugWebhooks';
import DiagnosticoBloqueios from './pages/DiagnosticoBloqueios';
import DiagnosticoCirurgico from './pages/DiagnosticoCirurgico';
import DiagnosticoContato from './pages/DiagnosticoContato';
import DiagnosticoDetalhado from './pages/DiagnosticoDetalhado';
import DiagnosticoInbound from './pages/DiagnosticoInbound';
import DiagnosticoMensagemLuiz from './pages/DiagnosticoMensagemLuiz';
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
import FerramentasMigracao from './pages/FerramentasMigracao';
import GerenciadorPermissoes from './pages/GerenciadorPermissoes';
import Home from './pages/Home';
import Importacao from './pages/Importacao';
import InteligenciaMetricas from './pages/InteligenciaMetricas';
import JarvisControl from './pages/JarvisControl';
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
import Promocoes from './pages/Promocoes';
import RoteamentoInteligente from './pages/RoteamentoInteligente';
import SetupWizard from './pages/SetupWizard';
import SystemHealth from './pages/SystemHealth';
import TesteFluxoControlado from './pages/TesteFluxoControlado';
import TesteOndeEstaaThread from './pages/TesteOndeEstaaThread';
import TestePersistenciaDireta from './pages/TestePersistenciaDireta';
import TesteVisibilidadeThread from './pages/TesteVisibilidadeThread';
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
import ContatosInteligentes from './pages/ContatosInteligentes';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Agenda": Agenda,
    "AnaliseDetalhadaContato": AnaliseDetalhadaContato,
    "AnalisePlaybooksCritica": AnalisePlaybooksCritica,
    "AnalyticsAvancado": AnalyticsAvancado,
    "AnalyticsPlaybooks": AnalyticsPlaybooks,
    "Auditoria": Auditoria,
    "Automacoes": Automacoes,
    "BackupManager": BackupManager,
    "BaseConhecimento": BaseConhecimento,
    "ChecklistProducao": ChecklistProducao,
    "ChecklistValidacaoWAPI": ChecklistValidacaoWAPI,
    "ChecklistValidacaoZAPI": ChecklistValidacaoZAPI,
    "Clientes": Clientes,
    "Comunicacao": Comunicacao,
    "ContatosParados": ContatosParados,
    "Dashboard": Dashboard,
    "DashboardExecutivo": DashboardExecutivo,
    "DebugWebhooks": DebugWebhooks,
    "DiagnosticoBloqueios": DiagnosticoBloqueios,
    "DiagnosticoCirurgico": DiagnosticoCirurgico,
    "DiagnosticoContato": DiagnosticoContato,
    "DiagnosticoDetalhado": DiagnosticoDetalhado,
    "DiagnosticoInbound": DiagnosticoInbound,
    "DiagnosticoMensagemLuiz": DiagnosticoMensagemLuiz,
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
    "FerramentasMigracao": FerramentasMigracao,
    "GerenciadorPermissoes": GerenciadorPermissoes,
    "Home": Home,
    "Importacao": Importacao,
    "InteligenciaMetricas": InteligenciaMetricas,
    "JarvisControl": JarvisControl,
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
    "Promocoes": Promocoes,
    "RoteamentoInteligente": RoteamentoInteligente,
    "SetupWizard": SetupWizard,
    "SystemHealth": SystemHealth,
    "TesteFluxoControlado": TesteFluxoControlado,
    "TesteOndeEstaaThread": TesteOndeEstaaThread,
    "TestePersistenciaDireta": TestePersistenciaDireta,
    "TesteVisibilidadeThread": TesteVisibilidadeThread,
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
    "ContatosInteligentes": ContatosInteligentes,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};