import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

const LegalAdvice = () => {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sections = [
    {
      number: '1.',
      title: 'Titularidad del sitio web',
      content: `
        El sitio web Grantial es titularidad de Innovalaus S.L., cuyos datos identificativos son los siguientes:

        • NIF: B67146357
        • Domicilio social: Avenida Roma 10, Barcelona (08015)
        • Teléfono de contacto: 646474743
        • Correo electrónico: info@grantial.com
        • Denominación social: Innovalaus S.L.

        El acceso y uso de este sitio web implican la aceptación plena de las disposiciones recogidas en el presente Aviso Legal.
      `,
    },
    {
      number: '2.',
      title: 'Objeto',
      content: `
        Este Aviso Legal regula el acceso, navegación y uso del sitio web Grantial, 
        así como las responsabilidades derivadas de su utilización.
      `,
    },
    {
      number: '3.',
      title: 'Condiciones de uso',
      content: `
        El usuario se compromete a utilizar el sitio web de forma responsable, 
        lícita y conforme a la buena fe. Queda prohibido cualquier uso que 
        pueda causar daños a Grantial, a otros usuarios o a terceros.
      `,
      list: [
        'Realizar actividades ilícitas o contrarias a la normativa vigente',
        'Introducir o difundir virus o software malicioso',
        'Acceder sin autorización a sistemas o bases de datos',
        'Suplantar la identidad de personas o entidades',
      ],
    },
    {
      number: '4.',
      title: 'Propiedad intelectual e industrial',
      content: `
        Todos los contenidos del sitio web (textos, imágenes, logotipos, marcas, software 
        y diseño) son propiedad de Grantial o cuentan con licencia para su uso.
        Asimismo, en Grantial se muestra información cuyo origen de los datos procede de la
        Intervención General de la Administración del Estado, utilizada para la prestación
        de los servicios de consulta y análisis de subvenciones.
        Queda prohibida su reproducción total o parcial sin autorización expresa.
      `,
    },
    {
      number: '5.',
      title: 'Responsabilidad',
      content: `
        Grantial no garantiza la disponibilidad permanente del sitio web ni la ausencia 
        de errores. No se hace responsable de:
      `,
      list: [
        'Interrupciones del servicio por mantenimientos técnicos',
        'Daños provocados por virus o ataques informáticos',
        'Errores en la información proporcionada por terceros',
        'Decisiones tomadas por el usuario basadas en la información de la plataforma',
      ],
    },
    {
      number: '6.',
      title: 'Enlaces externos',
      content: `
        El sitio web puede incluir enlaces hacia páginas de terceros. 
        Grantial no es responsable del contenido, seguridad o fiabilidad de estos sitios externos.
      `,
    },
    {
      number: '7.',
      title: 'Protección de datos',
      content: `
        El tratamiento de datos personales se rige por nuestra Política de Privacidad. 
        El usuario debe revisar dicho documento para conocer cómo se recogen, utilizan
        y almacenan sus datos.
      `,
    },
    {
      number: '8.',
      title: 'Ley aplicable y jurisdicción',
      content: `
        Este Aviso Legal se rige por la legislación española. 
        Cualquier disputa se resolverá en los juzgados y tribunales de Madrid.
      `,
    },
    {
      number: '9.',
      title: 'Contacto',
      content: `
        Para consultas relacionadas con este Aviso Legal, puede escribirnos a:
        info@grantial.com
      `,
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
            <h1 className="text-4xl font-bold mb-4">Aviso Legal</h1>
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

                  {sec.content && (
                    <p className="text-lg mb-4 whitespace-pre-line">{sec.content}</p>
                  )}

                  {sec.list && (
                    <ul className="list-disc list-inside mb-6 text-muted-foreground">
                      {sec.list.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
};

export default LegalAdvice;
