import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, User, ClipboardList, Shuffle, Search, Crown, MessageSquare, KanbanSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from './ThemeSwitcher';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useResponsiveLayout } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const { isMobile } = useResponsiveLayout();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = React.useState(false);
  
  // Function to get the current section info based on path
  const getSectionInfo = (): { name: string; icon: React.ReactNode | null } => {
    const path = location.pathname;
    const iconClass = "w-5 h-5";

    if (path === "/assistant") return { name: "Asistente de Subvenciones", icon: <MessageSquare className={iconClass} /> };
    if (path === "/swipe") return { name: "Swipe", icon: <Shuffle className={iconClass} /> };
    if (path.startsWith("/subvenciones-compatibles")) return { name: "Tus Subvenciones Compatibles", icon: <Crown className={iconClass} /> };
    if (path === "/subvenciones") return { name: "Búsqueda de Subvenciones", icon: <Search className={iconClass} /> };
    if (path === "/crm") return { name: "CRM de Subvenciones", icon: <KanbanSquare className={iconClass} /> };
    if (path === "/entities") return { name: "Mis Entidades", icon: <ClipboardList className={iconClass} /> };
    if (path === "/user-profile") return { name: "Mi Perfil", icon: <User className={iconClass} /> };
    if (path === "/auth") return { name: "Cuenta de Usuario", icon: null };

    return { name: "", icon: null };
  };

  const sectionInfo = getSectionInfo();
  
  const isAuthPage = location.pathname === "/auth" || 
                     location.pathname === "/reset-password" || 
                     location.pathname === "/verify-email";
  const isOnboardingPage = location.pathname === "/onboarding";
  
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };
  
  // Don't render header on onboarding page
  if (isOnboardingPage) {
    return null;
  }

  return (
    <>
      <header
        className="fixed left-0 right-0 z-50 bg-card/95 dark:bg-card/95 backdrop-blur-md border-b border-border shadow-sm transition-[top] duration-200"
        style={{ top: 'var(--beta-bar-height)' }}
      >
        <div className="w-full px-4 py-3 md:py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <img src={logo} alt="Grantial Logo" className={cn(isMobile ? "h-8 w-8" : "h-10 w-10")} />
            <span className={cn("font-semibold", isMobile ? "text-lg" : "text-xl")}>Grantial</span>
          </Link>
          
          {/* Quick nav for Home page */}
          {!isMobile && location.pathname === '/' && (
            <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1">
              {[
                { label: 'Calculadora', target: 'section-calculadora' },
                { label: 'Cómo funciona', target: 'section-como-funciona' },
                { label: 'Funcionalidades', target: 'section-funcionalidades' },
                { label: 'Precios', target: 'section-precios' },
              ].map((item) => (
                <button
                  key={item.target}
                  onClick={() =>
                    document.getElementById(item.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="rounded-full px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          {/* Section name with icon displayed in the middle - hide on mobile and home */}
          {!isMobile && sectionInfo.name && location.pathname !== '/' && (
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-lg font-medium flex items-center gap-2">
                {sectionInfo.icon}
                {sectionInfo.name}
              </h1>
            </div>
          )}
          
          <div className="flex items-center gap-2 md:gap-3">
            <ThemeSwitcher />
            
            {/* Authentication Buttons */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    Mi cuenta
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/user-profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Mi perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/entities')}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    <span>Mis entidades</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => setIsLogoutConfirmOpen(true)}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              !isAuthPage && (
                <div className="flex gap-1 md:gap-2">
                  <Button 
                    variant="ghost" 
                    size={isMobile ? "sm" : "sm"}
                    onClick={() => navigate('/auth?tab=signin')}
                    className={cn(isMobile && "px-2 text-sm")}
                  >
                    {isMobile ? "Entrar" : "Iniciar Sesión"}
                  </Button>
                  <Button 
                    variant="default" 
                    size={isMobile ? "sm" : "sm"}
                    onClick={() => navigate('/auth?tab=signup')}
                    className={cn(isMobile && "px-2 text-sm")}
                  >
                    {isMobile ? "Registro" : "Registrarse"}
                  </Button>
                </div>
              )
            )}
          </div>
        </div>
      </header>

      <AlertDialog open={isLogoutConfirmOpen} onOpenChange={setIsLogoutConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a salir de tu cuenta actual. Puedes volver a entrar cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleLogout}
            >
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Header;
