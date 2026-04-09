import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Mail } from 'lucide-react';

const PrivacyPolicy = () => {
    // Scroll to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 pt-20 pb-16 px-4">
            <div className="container mx-auto max-w-6xl">
            {/* Header */}
            <div className="text-center mb-12">
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-4xl font-bold mb-4">Política de Privacidad</h1>
                <p className="text-muted-foreground">
                Última actualización: 22 de Noviembre de 2025
                </p>
            </div>
            <Card className="shadow-lg">
                <CardContent className="p-10 prose prose-gray dark:prose-invert max-w-prose mx-auto">
                {/* Sección 1 */}
                <h2 className="text-3xl font-extrabold text-center mb-6">
                    1. Información que recopilamos
                </h2>
                <p className="text-lg text-center mb-8">
                    En Grantial recopilamos diferentes tipos de información para
                    proporcionar y mejorar nuestros servicios:
                </p>

                {/* Sub-sección 1.1 */}
                <h3 className="text-2xl font-semibold text-center mb-4">
                    1.1 Información que nos proporciona
                </h3>
                <ul className="list-disc list-inside mb-8">
                    <li>Datos de registro: nombre, email, contraseña</li>
                    <li>Información de la empresa: sector, tamaño, ubicación, objetivos</li>
                    <li>Datos de contacto: teléfono, dirección</li>
                    <li>Comunicaciones con nuestro equipo de soporte</li>
                </ul>

                {/* Sub-sección 1.2 */}
                <h3 className="text-2xl font-semibold text-center mb-4">
                    1.2 Información que recopilamos automáticamente
                </h3>
                <ul className="list-disc list-inside mb-12">
                    <li>Datos de uso de la plataforma</li>
                    <li>Información del dispositivo y navegador</li>
                    <li>Dirección IP y datos de geolocalización</li>
                    <li>Cookies y tecnologías similares</li>
                </ul>

                {/* Resto de secciones */}
                {[
                    {
                    number: '2.',
                    title: 'Cómo utilizamos su información',
                    items: [
                        'Proporcionar y mantener nuestros servicios',
                        'Personalizar su experiencia y recomendaciones',
                        'Comunicarnos con usted sobre actualizaciones y ofertas',
                        'Mejorar nuestros servicios y desarrollar nuevas funcionalidades',
                        'Garantizar la seguridad y prevenir fraudes',
                        'Cumplir con obligaciones legales',
                    ],
                    },
                    {
                    number: '3.',
                    title: 'Base legal para el procesamiento',
                    items: [
                        '<strong>Consentimiento:</strong> Para marketing directo y cookies no esenciales',
                        '<strong>Ejecución de contrato:</strong> Para proporcionar nuestros servicios',
                        '<strong>Interés legítimo:</strong> Para mejorar nuestros servicios y seguridad',
                        '<strong>Obligación legal:</strong> Para cumplir con requisitos regulatorios',
                    ],
                    },
                    {
                    number: '4.',
                    title: 'Compartir información',
                    items: [
                        '<strong>Proveedores de servicios:</strong> Para hosting, análisis y soporte',
                        '<strong>Autoridades:</strong> Cuando sea requerido por ley',
                        '<strong>Socios comerciales:</strong> Con su consentimiento explícito',
                    ],
                    },
                    {
                    number: '5.',
                    title: 'Seguridad de los datos',
                    text:
                        'Implementamos medidas de seguridad técnicas y organizativas apropiadas para proteger sus datos personales contra acceso no autorizado, alteración, divulgación o destrucción.',
                    },
                    {
                    number: '6.',
                    title: 'Retención de datos',
                    text:
                        'Conservamos sus datos personales solo durante el tiempo necesario para cumplir con los propósitos descritos en esta política, a menos que la ley requiera un período de retención más largo.',
                    },
                    {
                    number: '7.',
                    title: 'Sus derechos',
                    items: [
                        'Acceder a sus datos personales',
                        'Rectificar datos inexactos',
                        'Solicitar la eliminación de sus datos',
                        'Limitar el procesamiento',
                        'Portabilidad de datos',
                        'Oponerse al procesamiento',
                        'Retirar el consentimiento',
                    ],
                    },
                    {
                    number: '8.',
                    title: 'Cookies',
                    text:
                        'Utilizamos cookies para mejorar su experiencia. Puede gestionar sus preferencias de cookies en la configuración de su navegador. Para más información, consulte nuestra Política de Cookies.',
                    },
                    {
                    number: '9.',
                    title: 'Cambios en esta política',
                    text:
                        'Podemos actualizar esta política ocasionalmente. Le notificaremos sobre cambios significativos por email o mediante un aviso prominente en nuestro servicio.',
                    },
                ].map((section) => (
                    <section key={section.number} className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">
                        {section.number} {section.title}
                    </h2>
                    {section.items && (
                        <ul className="list-disc list-inside">
                        {section.items.map((item, idx) => (
                            <li
                            key={idx}
                            // Permite texto HTML dentro de la lista
                            dangerouslySetInnerHTML={{ __html: item }}
                            />
                        ))}
                        </ul>
                    )}
                    {section.text && <p className="mt-2">{section.text}</p>}
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

export default PrivacyPolicy;
