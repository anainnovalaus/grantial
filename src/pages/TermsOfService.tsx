import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Mail } from 'lucide-react';

const TermsOfService = () => {
    // Scroll to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const sections = [
        {
        number: '1.',
        title: 'Aceptación de los términos',
        content: `Al acceder y utilizar Grantial, usted acepta cumplir y estar sujeto a estos 
            Términos de Servicio. Si no está de acuerdo con alguno de estos términos, 
            no debe utilizar nuestro servicio.`,
        },
        {
        number: '2.',
        title: 'Descripción del servicio',
        content: `Grantial es una plataforma que utiliza inteligencia artificial para conectar 
            empresas con oportunidades de subvención y financiación. 
            Ofrecemos:`,
        list: [
            'Asistente virtual para consultas sobre subvenciones',
            'Sistema de matching entre empresas y subvenciones',
            'Gestión de perfil de empresa',
            'Recursos educativos sobre financiación',
        ],
        },
        {
        number: '3.',
        title: 'Registro y cuenta de usuario',
        subSections: [
            {
            subtitle: '3.1 Elegibilidad',
            text: `Debe ser mayor de 18 años y tener capacidad legal para celebrar contratos 
                vinculantes para usar nuestros servicios.`,
            },
            {
            subtitle: '3.2 Información de registro',
            text: `Debe proporcionar información precisa, actual y completa durante el proceso 
                de registro y mantener actualizada su información de cuenta.`,
            },
            {
            subtitle: '3.3 Seguridad de la cuenta',
            text: `Es responsable de mantener la confidencialidad de su contraseña y de todas 
                las actividades que ocurran bajo su cuenta.`,
            },
        ],
        },
        {
        number: '4.',
        title: 'Uso aceptable',
        content: `Se compromete a no:`,
        list: [
            'Usar el servicio para fines ilegales o no autorizados',
            'Interferir con el funcionamiento del servicio',
            'Intentar acceder a cuentas de otros usuarios',
            'Transmitir virus, malware o código malicioso',
            'Hacer ingeniería inversa del servicio',
            'Usar el servicio para spam o comunicaciones no solicitadas',
        ],
        },
        {
        number: '5.',
        title: 'Propiedad intelectual',
        content: `Grantial y sus contenidos, incluyendo pero no limitado a texto, gráficos, 
            logotipos, software y código, son propiedad de Grantial o sus licenciantes 
            y están protegidos por derechos de autor y otras leyes de propiedad intelectual.`,
        },
        {
        number: '6.',
        title: 'Datos del usuario',
        content: `Usted conserva todos los derechos sobre los datos que proporciona a través 
            del servicio. Al usar nuestro servicio, nos otorga una licencia para usar 
            estos datos según lo descrito en nuestra Política de Privacidad.`,
        },
        {
        number: '7.',
        title: 'Planes de suscripción y pagos',
        subSections: [
            {
            subtitle: '7.1 Planes gratuitos y de pago',
            text: `Ofrecemos tanto servicios gratuitos como de pago. Los términos específicos 
                de cada plan se describen en nuestra página de precios.`,
            },
            {
            subtitle: '7.2 Facturación',
            text: `Los planes de pago se facturan por adelantado de forma recurrente. Los 
                precios pueden cambiar con previo aviso de 30 días.`,
            },
            {
            subtitle: '7.3 Reembolsos',
            text: `Los reembolsos se evalúan caso por caso. Contáctenos para solicitar un reembolso.`,
            },
        ],
        },
        {
        number: '8.',
        title: 'Limitación de responsabilidad',
        content: `Grantial se proporciona "tal como está" sin garantías de ningún tipo. No 
            garantizamos que obtenga financiación o que la información sea completamente 
            precisa o actualizada.`,
        },
        {
        number: '9.',
        title: 'Indemnización',
        content: `Acepta indemnizar y eximir de responsabilidad a Grantial por cualquier 
            reclamo que surja de su uso del servicio o violación de estos términos.`,
        },
        {
        number: '10.',
        title: 'Terminación',
        content: `Podemos terminar su acceso al servicio en cualquier momento por violación 
            de estos términos. Usted puede cancelar su cuenta en cualquier momento.`,
        },
        {
        number: '11.',
        title: 'Ley aplicable',
        content: `Estos términos se rigen por las leyes de España. Cualquier disputa se 
            resolverá en los tribunales competentes de Madrid.`,
        },
        {
        number: '12.',
        title: 'Cambios en los términos',
        content: `Podemos modificar estos términos ocasionalmente. Los cambios significativos 
            se notificarán con al menos 30 días de antelación.`,
        },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 pt-20 pb-16 px-4">
            <div className="container mx-auto max-w-6xl">
            {/* Header */}
            <div className="text-center mb-12">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-4xl font-bold mb-4">Términos de Servicio</h1>
                <p className="text-muted-foreground">
                Última actualización: 22 de Noviembre de 2025
                </p>
            </div>

            <Card className="shadow-lg">
                <CardContent className="p-10 prose prose-gray dark:prose-invert max-w-prose mx-auto">
                {sections.map((sec) => (
                    <section key={sec.number} className="mb-12">
                    <h2 className="text-3xl font-extrabold text-center mb-4">
                        {sec.number} {sec.title}
                    </h2>
                    {sec.content && <p className="text-lg mb-4">{sec.content}</p>}

                    {sec.list && (
                        <ul className="list-disc list-inside mb-6 text-muted-foreground">
                        {sec.list.map((item, i) => (
                            <li key={i}>{item}</li>
                        ))}
                        </ul>
                    )}

                    {sec.subSections &&
                        sec.subSections.map((sub, i) => (
                        <div key={i} className="mb-6">
                            <h3 className="text-2xl font-semibold mb-2">{sub.subtitle}</h3>
                            <p className="text-lg">{sub.text}</p>
                        </div>
                        ))}
                    </section>
                ))}

                {/* Contacto */}
                <div className="text-center mt-8">
                    <h2 className="text-3xl font-extrabold mb-4">Contacto</h2>
                    <p className="text-lg text-muted-foreground mb-6">
                    Para preguntas sobre estos términos de servicio:
                    </p>
                    <div className="inline-flex items-center bg-muted p-4 rounded-lg">
                    <Mail className="h-6 w-6 mr-2 text-primary" />
                    <span className="font-semibold">info@grantial.com</span>
                    </div>
                </div>
                </CardContent>
            </Card>
            </div>
        </main>
        </div>
    );
};

export default TermsOfService;
