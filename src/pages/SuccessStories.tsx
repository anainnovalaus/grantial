
import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Quote, TrendingUp, Users, Euro, MapPin, Calendar, ArrowRight, ExternalLink, Radar, TrainFront } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Story {
  company: string;
  sector: string;
  location: string;
  website: string;
  logo: string;
  grant: string;
  amount: string;
  date: string;
  description: string;
  quote: string;
  author: string;
  results: string[];
}

const SuccessStories = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const stories: Story[] = [
        {
            company: "Dermilid Farma",
            sector: "Farmacéutica",
            location: "España",
            website: "https://dermilid.com/",
            logo: "https://dermilid.com/wp-content/uploads/2023/10/Mesa-de-trabajo-2-1.png",
            grant: "Subvención I+D Industria Farmacéutica",
            amount: "180.000€",
            date: "2025",
            description: "Desarrollo de nuevas formulaciones dermatológicas de alta eficacia basadas en innovación biotecnológica.",
            quote: "Antes de Grantial, buscar subvenciones era como ir a una estación sin horarios. Solo pusimos nuestro nombre y CIF, y en minutos el radar ya nos había detectado tres convocatorias que encajaban con nuestro perfil. No tuvimos que leer cientos de bases: Grantial nos dijo exactamente a qué tren subirnos.",
            author: "Equipo Dermilid Farma",
            results: [
                "Nueva línea de productos en desarrollo",
                "Aceleración del pipeline de I+D",
                "Financiación asegurada sin perder convocatorias clave"
            ]
        },
        {
            company: "IQUADRAT INFORMATICA SL",
            sector: "Tecnología / Telecomunicaciones",
            location: "Barcelona",
            website: "https://www.iquadrat.com/",
            logo: "https://www.iquadrat.com/wp-content/themes/iq/img/svg/logo-iq.svg",
            grant: "Horizonte Europa - Investigación colaborativa",
            amount: "350.000€",
            date: "2024",
            description: "Investigación en redes de comunicación avanzadas y soluciones de conectividad inteligente para smart cities.",
            quote: "Llevamos años participando en proyectos europeos, pero siempre se nos escapaban convocatorias por falta de tiempo para revisar todas las publicaciones. Con Grantial fue distinto: el radar detectó una convocatoria de Horizonte Europa que encajaba al 93% con nuestro perfil. Solo tuvimos que aportar nuestro CIF y la plataforma hizo el resto.",
            author: "Equipo IQUADRAT",
            results: [
                "Participación en consorcio europeo de 8 países",
                "Nuevo contrato de investigación a 3 años",
                "Ampliación del equipo de I+D con 6 nuevas incorporaciones"
            ]
        },
        {
            company: "Doctomatic",
            sector: "HealthTech",
            location: "Barcelona",
            website: "https://www.doctomatic.com/",
            logo: "https://www.doctomatic.com/wp-content/uploads/2023/02/logo-doctomatic.webp",
            grant: "CDTI - Proyectos de I+D en Salud Digital",
            amount: "250.000€",
            date: "2025",
            description: "Plataforma de monitorización remota de pacientes crónicos con inteligencia artificial predictiva.",
            quote: "En una startup de salud digital, cada semana cuenta. No podíamos permitirnos perder un tren que pasaba una sola vez al año. Grantial nos avisó de una convocatoria CDTI que no teníamos en el radar. Subimos nuestra documentación, el matching fue del 89%, y nos dieron luz verde. Ahora recomendamos Grantial a todas las startups que conocemos.",
            author: "Equipo Doctomatic",
            results: [
                "Producto validado clínicamente en 15 centros de salud",
                "Expansión a Portugal y Latinoamérica",
                "Reducción del 35% en hospitalizaciones de pacientes monitorizados"
            ]
        },
        {
            company: "StockCrowd",
            sector: "FinTech",
            location: "Barcelona",
            website: "https://www.stockcrowd.com/es-es",
            logo: "https://www.stockcrowd.com/resources/img/web/favicon.png",
            grant: "ENISA - Préstamo participativo para startups",
            amount: "200.000€",
            date: "2024",
            description: "Plataforma de inversión colectiva en activos inmobiliarios con tecnología blockchain y tokenización.",
            quote: "El mundo fintech se mueve rápido, pero las convocatorias públicas van a otro ritmo. Grantial nos permitió dejar de preocuparnos por los plazos. Con solo nuestro nombre y CIF ya estábamos dentro de la estación, y cuanto más le contamos sobre nuestra empresa, más afinó las recomendaciones. Es como tener un radar de oportunidades funcionando 24/7.",
            author: "Equipo StockCrowd",
            results: [
                "Capital disponible para desarrollo tecnológico sin dilución",
                "Lanzamiento de nueva funcionalidad de tokenización",
                "Crecimiento del 60% en volumen de inversión gestionado"
            ]
        }
    ];

    const stats = [
        { label: "Empresas financiadas", value: "500+", icon: Users },
        { label: "Financiación detectada", value: "50M€+", icon: Euro },
        { label: "Tasa de éxito", value: "85%", icon: TrendingUp },
        { label: "Subvenciones rastreadas", value: "5.000+", icon: Radar }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 pt-20 pb-16 px-4">
            <div className="container mx-auto max-w-6xl">
            {/* Header */}
            <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 shadow-sm mb-6">
                    <TrainFront className="h-3.5 w-3.5" />
                    Casos reales
                </div>
                <h1 className="text-4xl font-bold mb-4 tracking-tight">
                    Empresas que ya se subieron a su tren
                </h1>
                <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    Estas empresas dejaron de perseguir subvenciones. Con Grantial como radar,
                    encontraron la convocatoria que encajaba con su perfil y llegaron a tiempo
                    para ganarla.
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-14">
                {stats.map((stat, index) => (
                <Card key={index} className="text-center border-border">
                    <CardContent className="p-6">
                    <stat.icon className="h-8 w-8 text-violet-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </CardContent>
                </Card>
                ))}
            </div>

            {/* Success Stories */}
            <div className="space-y-8">
                {stories.map((story, index) => (
                <Card key={index} className="overflow-hidden border-border">
                    <CardContent className="p-0">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                        {/* Story Info */}
                        <div className="lg:col-span-2 p-8">
                        <div className="flex flex-wrap gap-2 mb-4">
                            <Badge variant="outline" className="border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400">{story.sector}</Badge>
                            <Badge variant="outline">{story.grant}</Badge>
                            <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400">{story.amount}</Badge>
                        </div>

                        <div className="flex items-center gap-3 mb-2">
                            <img
                                src={story.logo}
                                alt={`Logo de ${story.company}`}
                                className="h-8 w-auto object-contain shrink-0"
                            />
                            <h3 className="text-2xl font-bold">{story.company}</h3>
                            <a
                                href={story.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-950/40 px-2.5 py-1 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                            >
                                Web <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                            <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{story.location}</span>
                            </div>
                            <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{story.date}</span>
                            </div>
                        </div>

                        <p className="text-muted-foreground mb-6">{story.description}</p>

                        {/* Quote */}
                        <div className="bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 p-5 rounded-xl mb-6">
                            <Quote className="h-5 w-5 text-violet-500 mb-2" />
                            <p className="italic text-sm leading-relaxed mb-3 text-foreground/90">"{story.quote}"</p>
                            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">— {story.author}</p>
                        </div>

                        {/* Results */}
                        <div>
                            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Resultados</h4>
                            <ul className="space-y-2">
                            {story.results.map((result, resultIndex) => (
                                <li key={resultIndex} className="flex items-center gap-2.5 text-sm">
                                <div className="w-2 h-2 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shrink-0"></div>
                                <span>{result}</span>
                                </li>
                            ))}
                            </ul>
                        </div>
                        </div>

                        {/* Visual side */}
                        <div className="bg-gradient-to-br from-violet-50/80 to-fuchsia-50/50 dark:from-violet-950/30 dark:to-fuchsia-950/20 flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="w-28 h-28 rounded-2xl bg-white dark:bg-gray-900 border border-border flex items-center justify-center mx-auto mb-4 shadow-sm p-4">
                            <img
                                src={story.logo}
                                alt={`Logo de ${story.company}`}
                                className="max-w-full max-h-full object-contain"
                            />
                            </div>
                            <div className="text-2xl font-bold text-foreground">{story.amount}</div>
                            <div className="text-sm text-muted-foreground mt-1">Financiación obtenida</div>
                            <a
                                href={story.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                            >
                                Visitar {story.company} <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                        </div>
                    </div>
                    </CardContent>
                </Card>
                ))}
            </div>

            {/* CTA */}
            <Card className="mt-14 overflow-hidden border-0 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">
                <CardContent className="p-10 text-center">
                <TrainFront className="h-8 w-8 mx-auto mb-4 text-white/80" />
                <h3 className="text-2xl font-bold mb-3">¿Tu empresa será la siguiente?</h3>
                <p className="text-white/80 mb-8 max-w-xl mx-auto leading-relaxed">
                    Solo necesitas tu nombre y CIF para entrar en la estación.
                    Nuestro radar hará el resto: detectar las subvenciones que encajan
                    contigo y avisarte antes de que pase el tren.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link to="/auth">
                    <Button size="lg" className="rounded-full bg-white text-violet-700 hover:bg-white/90 px-8 font-semibold">
                        Empezar gratis
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    </Link>
                    <Link to="/">
                    <Button size="lg" className="rounded-full border border-white/30 bg-transparent text-white hover:bg-white/10 px-8">
                        Cómo funciona
                    </Button>
                    </Link>
                </div>
                </CardContent>
            </Card>
            </div>
        </main>
        </div>
    );
};

export default SuccessStories;
