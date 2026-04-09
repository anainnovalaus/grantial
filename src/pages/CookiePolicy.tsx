import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Cookie, Shield, BarChart, Settings, Mail } from 'lucide-react';

const CookiePolicy = () => {
    // Scroll to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const cookieTypes = [
        {
        icon: Shield,
        title: 'Cookies Esenciales',
        description: 'Necesarias para el funcionamiento básico del sitio web.',
        examples: ['Autenticación de usuario', 'Preferencias de idioma', 'Carrito de compras'],
        required: true,
        },
        {
        icon: BarChart,
        title: 'Cookies de Análisis',
        description: 'Nos ayudan a entender cómo interactúas con nuestro sitio.',
        examples: ['Google Analytics', 'Estadísticas de uso', 'Seguimiento de rendimiento'],
        required: false,
        },
        {
        icon: Settings,
        title: 'Cookies de Personalización',
        description: 'Mejoran tu experiencia recordando tus preferencias.',
        examples: ['Configuración de tema', 'Preferencias de usuario', 'Idioma seleccionado'],
        required: false,
        },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 pt-20 pb-16 px-4">
            <div className="container mx-auto max-w-6xl">
            {/* Header */}
            <div className="text-center mb-12">
                <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Cookie className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-5xl font-extrabold mb-2">Política de Cookies</h1>
                <p className="text-lg text-muted-foreground">
                Última actualización: 22 de Noviembre de 2025
                </p>
            </div>

            {/* Toda la política en una sola Card */}
            <Card className="shadow-lg">
                <CardContent className="p-10 prose prose-gray dark:prose-invert max-w-prose mx-auto">
                
                {/* 1. Qué son */}
                <section className="mb-12">
                    <h2 className="text-3xl font-extrabold text-center mb-6">
                    ¿Qué son las cookies?
                    </h2>
                    <p className="text-lg text-center">
                    Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo
                    cuando visitas un sitio web. Se utilizan para hacer que los sitios funcionen de
                    manera más eficiente y proporcionar información a los propietarios del sitio.
                    </p>
                </section>

                {/* 2. Tipos */}
                <section className="mb-12">
                    <h2 className="text-3xl font-extrabold text-center mb-8">
                    Tipos de cookies que utilizamos
                    </h2>
                    {cookieTypes.map((type, idx) => (
                    <div key={idx} className="mb-8">
                        <div className="flex items-center gap-4 mb-3 justify-center">
                        <div className="bg-primary/10 p-3 rounded-full">
                            <type.icon className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="text-2xl font-semibold">{type.title}</h3>
                        <span
                            className={`px-2 py-1 rounded-full text-xs ${
                            type.required
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                        >
                            {type.required ? 'Obligatorias' : 'Opcionales'}
                        </span>
                        </div>
                        <p className="text-muted-foreground mb-3">{type.description}</p>
                        <p className="font-medium mb-2">Ejemplos:</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {type.examples.map((ex, i) => (
                            <li key={i}>{ex}</li>
                        ))}
                        </ul>
                    </div>
                    ))}
                </section>

                {/* 3. Detalles específicos */}
                <section className="mb-12">
                    <h2 className="text-3xl font-extrabold text-center mb-6">
                    Detalles de las cookies específicas
                    </h2>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b">
                            {['Nombre', 'Propósito', 'Duración', 'Tipo'].map((col) => (
                            <th key={col} className="text-left p-3">
                                {col}
                            </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                        {[
                            ['auth_token', 'Mantener la sesión del usuario', '7 días', 'Esencial'],
                            ['theme_preference', 'Recordar el tema elegido', '1 año', 'Personalización'],
                            ['_ga', 'Google Analytics – distinguir usuarios', '2 años', 'Análisis'],
                            ['cookie_consent', 'Recordar preferencias de cookies', '1 año', 'Esencial'],
                        ].map((row, i) => (
                            <tr key={i} className="border-b">
                            {row.map((cell, j) => (
                                <td key={j} className={`p-3 ${j === 0 ? 'font-mono' : ''}`}>
                                {cell}
                                </td>
                            ))}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                </section>

                {/* 4. Gestión */}
                <section className="mb-12">
                    <h2 className="text-3xl font-extrabold text-center mb-6">Gestión de cookies</h2>
                    <h3 className="text-2xl font-semibold mb-2">Control del navegador</h3>
                    <p className="text-lg text-muted-foreground mb-6">
                    Puedes controlar y/o eliminar las cookies como desees desde la configuración de
                    tu navegador.
                    </p>
                    <h3 className="text-2xl font-semibold mb-2">Configuración por navegador</h3>
                    <ul className="list-disc list-inside text-lg space-y-2 mb-4">
                    <li><strong>Chrome:</strong> Privacidad y seguridad → Cookies</li>
                    <li><strong>Firefox:</strong> Privacidad y seguridad → Cookies</li>
                    <li><strong>Safari:</strong> Privacidad → Cookies</li>
                    <li><strong>Edge:</strong> Cookies y permisos de sitio</li>
                    </ul>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <p className="text-lg">
                        <strong>Nota:</strong> Si deshabilitas las cookies, algunas funcionalidades
                        del sitio podrían no funcionar correctamente.
                    </p>
                    </div>
                </section>

                {/* 5. Cookies de terceros */}
                <section className="mb-12">
                    <h2 className="text-3xl font-extrabold text-center mb-6">
                    Cookies de terceros
                    </h2>
                    <ul className="list-disc list-inside text-lg text-muted-foreground space-y-3">
                    <li>
                        <strong>Google Analytics:</strong> Para analizar tráfico y mejorar servicios
                    </li>
                    <li>
                        <strong>Servicios de autenticación:</strong> Para facilitar el inicio de sesión
                        seguro
                    </li>
                    </ul>
                </section>

                {/* 6. Contacto */}
                <section className="text-center">
                    <h2 className="text-3xl font-extrabold mb-4">Contacto</h2>
                    <p className="text-lg text-muted-foreground mb-6">
                    Si tienes preguntas sobre nuestra Política de Cookies:
                    </p>
                    <div className="inline-flex items-center bg-muted p-4 rounded-lg">
                    <Mail className="h-6 w-6 mr-2 text-primary" />
                    <span className="font-semibold">info@grantial.com</span>
                    </div>
                </section>
                
                </CardContent>
            </Card>
            </div>
        </main>
        </div>
    );
};

export default CookiePolicy;
