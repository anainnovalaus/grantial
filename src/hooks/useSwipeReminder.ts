import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const REMINDER_INTERVAL = 20 * 60 * 1000; // 20 minutos en milisegundos
const LAST_REMINDER_KEY = 'lastSwipeReminderTime';

export const useSwipeReminder = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const showReminder = () => {
      const now = Date.now();
      const lastReminder = localStorage.getItem(LAST_REMINDER_KEY);
      
      // Si ya se mostró recientemente (menos de 20 min), no mostrar
      if (lastReminder && now - parseInt(lastReminder) < REMINDER_INTERVAL) {
        return;
      }

      // Guardar el timestamp actual
      localStorage.setItem(LAST_REMINDER_KEY, now.toString());

      // Mostrar el toast con botón para ir a /swipe
      toast('💡 Recordatorio', {
        description: 'Define tus preferencias para obtener mejores matches de subvenciones',
        action: {
          label: 'Ir a Preferencias',
          onClick: () => navigate('/swipe'),
        },
        duration: 8000,
      });
    };

    // Mostrar el primer recordatorio después de 20 minutos
    const timerId = setInterval(showReminder, REMINDER_INTERVAL);

    // Cleanup al desmontar
    return () => clearInterval(timerId);
  }, [navigate]);
};

export default useSwipeReminder;