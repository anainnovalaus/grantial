import { useLocation, useNavigate } from 'react-router-dom';
import { Shuffle, Crown, ClipboardList, Search, KanbanSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navigationItems = [
    {
      icon: Crown,
      label: 'Compatibles',
      path: '/subvenciones-compatibles',
    },
    {
      icon: Shuffle,
      label: 'Swipe',
      path: '/swipe',
    },
    {
      icon: Search,
      label: 'Buscar',
      path: '/subvenciones',
    },
    {
      icon: KanbanSquare,
      label: 'CRM',
      path: '/crm',
    },
    {
      icon: ClipboardList,
      label: 'Mi Entidad',
      path: '/entities',
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-card/95 backdrop-blur-md border-t border-border shadow-lg md:hidden will-change-transform" style={{ transform: 'translateZ(0)' }}>
      <div className="flex items-center justify-around px-1 py-1.5 pb-safe">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-all duration-200 min-w-0 flex-1 max-w-[72px]",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
