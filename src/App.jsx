import './App.css'
import { useState } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import SplashScreen from '@/components/global/SplashScreen';
import SuperAgente from '@/pages/SuperAgente';
import NotasFiscais from '@/pages/NotasFiscais';
import CustoAutomacoes from '@/pages/CustoAutomacoes';
import Compras from '@/pages/Compras';
import MonitorPromocoes from '@/pages/MonitorPromocoes';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  // Show animated logo while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <img
          src="https://base44.app/api/apps/69b2fc6e5d83e60566460a2d/files/mp/public/69b2fc6e5d83e60566460a2d/8ffaca6b4_logo_sticker_opt.webp"
          alt="Nexus360"
          className="w-64 h-64 object-contain"
        />
        <div className="mt-6 w-8 h-8 border-4 border-slate-700 border-t-amber-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      const isPreviewSandbox = window.location.hostname.includes('preview-sandbox');
      if (isPreviewSandbox) {
        return (
          <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-white">
            <div className="text-slate-500 text-sm">Sessão expirada no preview.</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700"
            >
              Recarregar
            </button>
          </div>
        );
      }
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <>
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route 
          path="/SuperAgente" 
          element={
            <LayoutWrapper currentPageName="SuperAgente">
              <SuperAgente />
            </LayoutWrapper>
          } 
        />
        <Route 
          path="/NotasFiscais" 
          element={
            <LayoutWrapper currentPageName="NotasFiscais">
              <NotasFiscais />
            </LayoutWrapper>
          } 
        />
        <Route 
          path="/CustoAutomacoes" 
          element={
            <LayoutWrapper currentPageName="CustoAutomacoes">
              <CustoAutomacoes />
            </LayoutWrapper>
          } 
        />
        <Route 
          path="/Compras" 
          element={
            <LayoutWrapper currentPageName="Compras">
              <Compras />
            </LayoutWrapper>
          } 
        />
        <Route 
          path="/MonitorPromocoes" 
          element={
            <LayoutWrapper currentPageName="MonitorPromocoes">
              <MonitorPromocoes />
            </LayoutWrapper>
          } 
        />
        <Route path="/orcamentos" element={<Navigate to="/LeadsQualificados" replace />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};




function App() {
  const [splashDone, setSplashDone] = useState(() => {
    // Mostra splash apenas uma vez por sessão (evita rodar a cada hot-reload)
    return sessionStorage.getItem('nexus_splash_done') === '1';
  });

  if (!splashDone) {
    return (
      <SplashScreen
        durationMs={3500}
        onFinish={() => {
          sessionStorage.setItem('nexus_splash_done', '1');
          setSplashDone(true);
        }}
      />
    );
  }

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App