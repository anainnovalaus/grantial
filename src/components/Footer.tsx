
import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { Separator } from "@/components/ui/separator";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full mt-24 md:mt-36 bg-gradient-to-b from-background to-primary/5 pt-10 pb-6 border-t border-primary/10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Grantial</h3>
            <p className="text-sm text-muted-foreground">
              Grantial cruza el perfil de tu empresa con miles de subvenciones, te avisa a tiempo y te ayuda a centrarte en las oportunidades que de verdad encajan con tu entidad.
            </p>
            <div className="flex items-center space-x-4 pt-2">
              <a href="https://www.linkedin.com/company/grantial" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3 md:pl-8 lg:pl-12">
            <h3 className="text-lg font-semibold">Enlaces Rápidos</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">Inicio</Link>
              </li>
              <li>
                <Link to="/subvenciones-compatibles" className="text-muted-foreground hover:text-primary transition-colors">Mis Subvenciones Compatibles</Link>
              </li>
              <li>
                <Link to="/swipe" className="text-muted-foreground hover:text-primary transition-colors">Definir mis Preferencias</Link>
              </li>
              <li>
                <Link to="/subvenciones" className="text-muted-foreground hover:text-primary transition-colors">Buscar Subvenciones</Link>
              </li>
              <li>
                <Link to="/entities" className="text-muted-foreground hover:text-primary transition-colors">Mi Entidad</Link>
              </li>

            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Recursos</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/success-stories" className="text-muted-foreground hover:text-primary transition-colors flex items-center">
                  Casos de Éxito <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link to="/barometro" className="text-muted-foreground hover:text-primary transition-colors flex items-center">
                  Barómetro de Subvenciones <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link to="/calculadora" className="text-muted-foreground hover:text-primary transition-colors flex items-center">
                  Calculadora de Oportunidades <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Contacto</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <Mail className="h-5 w-5 text-primary mr-2 shrink-0" />
                <a href="mailto:info@grantial.com" className="text-muted-foreground hover:text-primary transition-colors">info@grantial.com</a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6 bg-primary/10" />
        
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <div className="mb-4 md:mb-0">
            © {currentYear} Grantial. Todos los derechos reservados.
          </div>
          <div className="flex space-x-6">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Política de Privacidad</Link>
            <Link to="/legal-advice" className="hover:text-primary transition-colors">Aviso Legal</Link>
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">Términos de Servicio</Link>
            <Link to="/cookie-policy" className="hover:text-primary transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
