import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, X, ExternalLink } from 'lucide-react';

type BetaMessageBarProps = {
  onHeightChange?: (height: number) => void;
};

const BetaMessageBar = ({ onHeightChange }: BetaMessageBarProps) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isHiddenOnScroll, setIsHiddenOnScroll] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (isDismissed || isHiddenOnScroll) {
      onHeightChange?.(0);
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    const updateHeight = () => {
      onHeightChange?.(Math.ceil(node.getBoundingClientRect().height));
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
      onHeightChange?.(0);
    };
  }, [isDismissed, isHiddenOnScroll, onHeightChange]);

  useEffect(() => {
    if (isDismissed) {
      onHeightChange?.(0);
      return;
    }

    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= 8) {
        setIsHiddenOnScroll(false);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (delta > 8) {
        setIsHiddenOnScroll(true);
      } else if (delta < -8) {
        setIsHiddenOnScroll(false);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isDismissed, onHeightChange]);

  if (isDismissed || isHiddenOnScroll) return null;

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 right-0 z-[60] w-full bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50"
    >
      <div className="w-full px-8 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1" >
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
              <span className="font-medium">Acceso Beta:</span> Por favor, recordar que esto es un acceso beta. Si notáis algún fallo o pensáis que se puede mejorar en algún aspecto →{' '}
              <a
                href="https://wkf.ms/49kTK0f?ticket-grantial="
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 underline underline-offset-2 transition-colors"
              >
                hacérnoslo llegar aquí
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="flex-shrink-0 p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 transition-colors"
            aria-label="Cerrar mensaje"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BetaMessageBar;
