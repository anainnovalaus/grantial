import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Assistant from "./pages/Assistant";
import NotFound from "./pages/NotFound";
import GrantSwipe from "./pages/GrantSwipe";
import Entities from "./pages/Entities";
import UserProfile from "./pages/UserProfile";
import Matches from "./pages/Matches";
import MatchDetail from "./pages/MatchDetail";
import GrantDetail from "./pages/GrantDetail";
import Blog from "./pages/Blog";
import BlogArticle from "./pages/BlogArticle";
import SuccessStories from "./pages/SuccessStories";
import Barometro from "./pages/Barometro";
import Calculadora from "./pages/Calculadora";
import GrantMarketplace from "./pages/GrantMarketplace";
import Crm from "./pages/Crm";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiePolicy from "./pages/CookiePolicy";
import LegalAdvice from "./pages/LegalAdvice";
import NavigationBar from "./components/NavigationBar";
import Footer from "./components/Footer";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Home from "./pages/Home";
import { ThemeProvider } from "./context/ThemeContext";
import { ChatProvider } from "./context/ChatContext";
import { AuthProvider } from "./context/AuthContext";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyEmailNotice from "./pages/VerifyEmailNotice";
import Onboarding from "./pages/Onboarding";
import WhatsAppFloatingButton from "./components/WhatsAppFloatingButton";
import WhatsAppPopup from "./components/WhatsAppPopup";
import Header from "./components/Header";
import BetaMessageBar from "./components/BetaMessageBar";
import EntityProcessingFloatingTracker from "./components/EntityProcessingFloatingTracker";
import { useSwipeReminder } from "./hooks/useSwipeReminder";

const extractHttpStatus = (error: unknown): number | null => {
  const candidate = (error as { status?: unknown })?.status;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }

  const message = String((error as Error)?.message || '');
  const match = message.match(/\b([1-5]\d{2})\b/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const isTransientQueryError = (error: unknown): boolean => {
  const message = String((error as Error)?.message || '').toLowerCase();
  if (!message) return false;

  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('timeout') ||
    message.includes('abort')
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = extractHttpStatus(error);
        if (status !== null) {
          if (status === 429) return false;
          if (status >= 400 && status < 500) return false;
          if (status >= 500) return failureCount < 1;
        }

        return failureCount < 1 && isTransientQueryError(error);
      },
      retryDelay: (attemptIndex, error) => {
        const status = extractHttpStatus(error);
        if (status === 429) {
          return 10000;
        }
        if (status !== null && status >= 500) {
          return Math.min(1200 * 2 ** attemptIndex, 5000);
        }
        return Math.min(800 * 2 ** attemptIndex, 2000);
      },
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  React.useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
};

// Component to conditionally render the footer based on route
const AppContent = () => {
  const location = useLocation();
  const [showWhatsAppPopup, setShowWhatsAppPopup] = React.useState(false);
  const [betaBarHeight, setBetaBarHeight] = React.useState(0);
  // Hook para mostrar recordatorio cada 20 minutos
  useSwipeReminder();

  React.useEffect(() => {
    document.documentElement.style.setProperty('--beta-bar-height', `${betaBarHeight}px`);

    return () => {
      document.documentElement.style.setProperty('--beta-bar-height', '0px');
    };
  }, [betaBarHeight]);
  
  // Don't show footer on auth and onboarding routes
  const hideFooterRoutes = [
    '/auth', '/reset-password', '/verify-email', '/verify-email-notice', '/onboarding'
  ];
  const shouldShowFooter = !hideFooterRoutes.some(route =>
    location.pathname === route || location.pathname.startsWith(`${route}/`)
  );

  // Don't show footer on these routes
  const hideWhatsAppPopupRoutes = [
    '/reset-password', '/verify-email', '/verify-email-notice', '/onboarding', '/subvenciones-compatibles/:id', '/grants/:id'
  ];
  const shouldShowWhatsAppPopup = !hideWhatsAppPopupRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(`${route}/`)
  );
  
  // Only show NavigationBar on these routes
  const showNavigationBarRoutes = [
    '/swipe', '/entities', '/user-profile', '/subvenciones', '/crm', '/grants', '/subvenciones-compatibles', '/subvenciones-compatibles/:id', '/grants/:id'
  ];
  const shouldShowNavigationBar = showNavigationBarRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(`${route}/`)
  );
  
  // Check if we're on onboarding or home page
  const isHomePage = location.pathname === "/";
  const isOnboardingPage = location.pathname === "/onboarding";

  // Special layout for onboarding (no NavigationBar, full screen)
  if (isOnboardingPage) {
    return (
      <div className="min-h-screen bg-background pt-[var(--beta-bar-height)]">
        <BetaMessageBar onHeightChange={setBetaBarHeight} />
        <Routes>
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requireVerified={true}>
                <Onboarding />
              </ProtectedRoute>
            }
          />
        </Routes>
        <EntityProcessingFloatingTracker />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <BetaMessageBar onHeightChange={setBetaBarHeight} />
      <Header />
      {shouldShowNavigationBar && <NavigationBar />}

      <div className={`content-container ${isHomePage ? "home-page" : ""}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-email-notice" element={<VerifyEmailNotice />} />
          
          
          {/* Content pages - accessible to all */}
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogArticle />} />
          <Route path="/success-stories" element={<SuccessStories />} />
          <Route path="/barometro" element={<Barometro />} />
          <Route path="/calculadora" element={<Calculadora />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/legal-advice" element={<LegalAdvice />} />
          
          {/* Protected routes - require verification and onboarding */}
          {/* <Route 
            path="/assistant" 
            element={
              <ProtectedRoute requireVerified={true} requireOnboarding={true}>
                <ChatProvider>
                  <Assistant />
                </ChatProvider>
              </ProtectedRoute>
            } 
          /> */}
          <Route 
            path="/swipe" 
            element={
              <ProtectedRoute requireVerified={true}>
                <GrantSwipe />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/user-profile" 
            element={
              <ProtectedRoute requireVerified={true}>
                <UserProfile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/subvenciones" 
            element={
              <ProtectedRoute requireVerified={true}>
                <GrantMarketplace />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/crm"
            element={
              <ProtectedRoute requireVerified={true}>
                <Crm />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/subvenciones-compatibles" 
            element={
              <ProtectedRoute requireVerified={true}>
                <Matches />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/subvenciones-compatibles/:id" 
            element={
              <ProtectedRoute requireVerified={true}>
                <MatchDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/grants/:id" 
            element={
              <ProtectedRoute requireVerified={true}>
                <GrantDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/entities" 
            element={
              <ProtectedRoute requireVerified={true}>
                <Entities />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      {shouldShowFooter && <Footer />}
      
      {/* WhatsApp floating button - show only on home page */}
      {isHomePage && (
        <WhatsAppFloatingButton onClick={() => setShowWhatsAppPopup(true)} />
      )}
      
      {/* WhatsApp popup */}
      <WhatsAppPopup 
        isOpen={showWhatsAppPopup} 
        onClose={() => setShowWhatsAppPopup(false)} 
      />
      <EntityProcessingFloatingTracker />
    </div>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider>
              <ScrollToTop />
              <Sonner />
              <Toaster />
              <AppContent />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
