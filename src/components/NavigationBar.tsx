import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Shuffle, ClipboardList, Search, Crown, KanbanSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useResponsiveLayout } from '@/hooks/use-mobile';
import BottomNavigation from './BottomNavigation';

const NavigationBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showSideNav, showBottomNav } = useResponsiveLayout();
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  const isHomePage = location.pathname === "/";
  const isAuthPage = location.pathname === "/auth" || 
                     location.pathname === "/reset-password" || 
                     location.pathname === "/verify-email";
  const isOnboardingPage = location.pathname === "/onboarding";

  const navigationItems = [
    {
      icon: Crown,
      label: 'Subvenciones compatibles',
      path: '/subvenciones-compatibles',
      isActive: location.pathname.startsWith('/subvenciones-compatibles'),
    },
    {
      icon: Shuffle,
      label: 'Definir preferencias',
      path: '/swipe',
      isActive: location.pathname === '/swipe',
    },
    {
      icon: Search,
      label: 'Búsqueda de subvenciones',
      path: '/subvenciones',
      isActive: location.pathname === '/subvenciones',
    },
    {
      icon: KanbanSquare,
      label: 'CRM de subvenciones',
      path: '/crm',
      isActive: location.pathname === '/crm',
    },
    {
      icon: ClipboardList,
      label: 'Mi entidad',
      path: '/entities',
      isActive: location.pathname === '/entities',
    },
  ];
  
  // Don't render navigation on onboarding page
  if (isOnboardingPage) {
    return null;
  }

  return (
    <>
      {/* Side Navigation - Only show on desktop when not on home page and user is authenticated */}
      {showSideNav && !isHomePage && isAuthenticated && !isAuthPage && (
        <div className="fixed top-1/2 left-4 transform -translate-y-1/2 z-40">
          <div
            className={cn(
              "overflow-hidden border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-md transition-all duration-300 ease-out",
              isExpanded ? "w-64" : "w-[60px]",
              "rounded-[28px]",
            )}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            onFocusCapture={() => setIsExpanded(true)}
            onBlurCapture={() => setIsExpanded(false)}
          >
            <div className="flex flex-col gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex h-12 items-center rounded-2xl transition-all duration-300",
                      isExpanded ? "w-full justify-start px-3.5" : "w-12 justify-center self-center",
                      item.isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    aria-label={item.label}
                    title={!isExpanded ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span
                      className={cn(
                        "overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300",
                        isExpanded ? "ml-3 max-w-[180px] opacity-100" : "ml-0 max-w-0 opacity-0",
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Only show on mobile when authenticated and not on home page */}
      {showBottomNav && isAuthenticated && !isHomePage && !isAuthPage && (
        <BottomNavigation />
      )}
    </>
  );
};

export default NavigationBar;
