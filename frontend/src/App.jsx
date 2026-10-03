import { useText } from './i18n/useText';
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';

const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));

const LoadingScreen = () => {
    const { t } = useText();
    return <div className="app-shell relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
         <div className="relative z-10 flex flex-col items-center rounded-lg border border-white/10 bg-white/[0.045] p-8 shadow-panel backdrop-blur-xl">
             <div className="mb-4 h-12 w-12 rounded-full border-4 border-white/10 border-t-spotify shadow-[0_0_20px_rgba(29,185,84,0.3)] animate-spin"></div>
             <h2 className="text-base font-extrabold text-white/80 animate-pulse">{t("Carregando dados")}</h2>
         </div>
    </div>;
};

// Componente Wrapper para injetar hooks do react-router adequadamente nas animações
const AnimatedRoutes = () => {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Landing />} />
                {/* No modo local não há login: rota antiga redireciona para o painel. */}
                <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </AnimatePresence>
    )
}

function App() {
  const isCheckingAuth = useAuthStore((state) => state.isCheckingAuth);
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
     checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth) {
     return <LoadingScreen />;
  }

  return (
    <>
       <Toaster 
           position="top-center" 
           toastOptions={{
             style: {
               background: '#333',
               color: '#fff',
               border: '1px solid #444',
               borderRadius: '12px'
             },
             success: {
               iconTheme: {
                 primary: '#1DB954',
                 secondary: '#fff',
               },
             },
           }} 
       />
       
       <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
             <AnimatedRoutes />
          </Suspense>
       </BrowserRouter>
    </>
  )
}

export default App;
