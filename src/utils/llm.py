
import os
import json
from openai import OpenAI
from utils.tools import tools as get_tools 

class LLM():
    def __init__(self):
        pass
    
    def process_functions(self, text, message_history=None, selected_grant=None):
        tools = get_tools()
        # Recuperar las credenciales de las variables de entorno
        api_key = os.getenv("OPENAI_API_KEY")
        organization_id = os.getenv("OPENAI_ORG_ID")
        print("Text:", text)
        client = OpenAI(
            api_key=api_key,
            organization=organization_id
        )

        # Construir los mensajes para el LLM
        messages = []
        
        # Añadir instrucciones del sistema
        messages.append({
            "role": "developer", 
            "content": "Eres un asistente especializado en subvenciones y ayudas públicas. Responde con información clara y útil sobre subvenciones, requisitos, fechas y entidades. Utiliza formato HTML básico para resaltar información importante con <strong>, <em>, listas <ul><li>, etc."
        })
        
        # Añadir historial de mensajes si está disponible
        if message_history:
            messages.extend(message_history)

        # Añadir mensaje actual del usuario
        messages.append({"role": "user", "content": text})

        try:
            completion = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                tools=tools,
            )
            # Buscar el nombre de la funcion y argumentos
            tool_call = completion.choices[0].message.tool_calls
            print(f"Tool call: {tool_call}")
            
            function_name = None
            args = {}
            tool_id = None
            
            if tool_call:  # Make sure it's not empty
                function_name = tool_call[0].function.name
                args_str = tool_call[0].function.arguments
                # Convertir el string a diccionario
                args = json.loads(args_str)
                print(f"Args: {args}")
                # Almacenar ID de la tool call
                tool_id = tool_call[0].id
                
            # Almacenar 'message inicial' y output de la funcion escogida
            messages.append(completion.choices[0].message)

            # If user selected a grant and GPT called a function that needs a title,
            # automatically inject the selected grant title
            if selected_grant and function_name in ['get_preguntas_subvenciones', 'get_resumen_subvenciones']:
                if 'titulo' not in args or not args.get('titulo'):
                    args['titulo'] = selected_grant
                    print(f"✅ Auto-injected selected grant title: {selected_grant}")
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"✅ Auto-injected selected grant title: {selected_grant}")

            return messages, function_name, tool_id, args
        except Exception as e:
            print(f"Error in process_functions: {e}")
            # Return a fallback response in case of error
            return messages, None, None, {}

    def process_response(self, tool_response, tool_id, function_response=""):
        # Recuperar las credenciales de las variables de entorno
        api_key = os.getenv("OPENAI_API_KEY")
        organization_id = os.getenv("OPENAI_ORG_ID")

        client = OpenAI(
            api_key=api_key,
            organization=organization_id
        )

        try:
            tools = get_tools()
            
            # Only add a tool call response if we actually had a tool_id
            if tool_id:
                tool_response.append({                    
                    "role": "tool",
                    "tool_call_id": tool_id,
                    "content": str(function_response)
                })
            
            # Instrucciones para formatear respuesta con HTML
            tool_response.append({                    
                "role": "developer",
                "content": """
                    ## Configuración del Asistente
                    ### Tu rol es:
                    Ser asistente amable que se encarga de ofrecer explicaciones detalladas y completas a las solicitudes del usuario. Mi objetivo principal es ofrecerte
                    información completa y clara sobre cualquier tema que consultes, poniendo especial atención en los detalles y en el uso de un lenguaje cercano y fácil de entender.Cuando un usuario solicita un resumen,
                    se espera que se incluya la mayor cantidad de detalles posibles. Por ello, es fundamental no escatimar en información y ofrecer una respuesta completa y minuciosa.
 
                    ### Tu misión es:
                    1. **Incluir la mayor cantidad de detalles relevantes** en tus respuestas, especialmente cuando se te pida un resumen **(IMPORTANTE)**.

                    ### Formato de Respuesta es:
                    1. **Utilizar HTML básico** para dar formato a tus explicaciones, siguiendo estas pautas:
                    - Emplea `<strong>` para resaltar información importante.
                    - Usa `<em>` cuando desees enfatizar un punto relevante.
                    - Presenta listas con `<ul>` y `<li>`, agregando un guion (-) antes de cada elemento.
                    - Separa los párrafos con `<p>` para mantener una estructura clara.
                    - Evita espacios o saltos de línea innecesarios para conservar el texto limpio y fácil de leer.

                    ### Estilo de Respuesta es:
                    1. Al redactar tus respuestas, adopta un **tono cercano y conversacional**, pero mantén la **claridad y el orden** en todo momento. Asegúrate de:
                    - **Adaptar el estilo** según la situación, ofreciendo un tono más formal o más distendido de acuerdo con lo que se requiera.
                    - Ser **conciso y exhaustivo**: responde a lo que te preguntan sin omitir detalles importantes y evita redundancias.
                    - **Mantener la coherencia** aprovechando la información previa de la conversación para contextualizar correctamente.
                    - **Pedir aclaraciones** si notas que la solicitud no está bien definida o hay ambigüedad.
                    - Apoyarte en **ejemplos y analogías** cuando sea necesario, para que la información sea más sencilla de comprender.
                    - Verificar tus respuestas y **corregir errores** si detectas alguna inexactitud.
                    - Indicar cualquier **limitación o incertidumbre** si no dispones de datos precisos.

                    ### Notas:
                    - Si el usuario solicita un resumen, asegúrate de incluir la mayor cantidad de detalles relevantes y sigue la estructura del ejemplo.
                    - Si el usuario solicita un las subvenciones de hoy y lamentablemente, hoy no hay subvenciones disponibles para ofrecer, limita a comentar
                    que por el momento no se han encontrado subvenciones de hoy pero que estas trabajando en obtener esa información durante el día de hoy. 
                    - Si el usuario hace preguntas para saber más información sobre algo, por ejemplo: "Dime los requisitos", "¿Quinees son los beneficiarios?", "¿Cuando es la fecha limite?", etc.
                    Pero no ha especificado el titulo de esta, indicale que ha de seleccionar la subvención que quiere en el seleccionador disponible al
                    lado de la casilla dónde escbribe el mensaje. Sin el título de la subvención, no puedes buscar en tu base
                    de datos la información. 

                """
            })

            tool_response.append({     
                "role": "assistant",
                "content": """
                    ### Ejemplo de respuesta en HTML cuando se solicita un resumen:

                    <p><strong>Subvención para el Desarrollo de Blockchain 2025 – Madrid</strong></p>
                    <p><strong>Objetivo:</strong> Promover proyectos de I+D en la Comunidad de Madrid que utilicen la tecnología Blockchain.</p>
                    <p><strong>Dotación Total:</strong> 2.032.220 € financiados por el PRTR, fondos europeos y regionales.</p>
                    <p><strong>Monto Máximo por Beneficiario:</strong> Hasta 100.000 €.</p>
                    <p><strong>Cobertura:</strong> Financiación de hasta el 100% de los gastos subvencionables.</p>
    
                    <strong>Elegibilidad:</strong>
                    <li>- PYMEs con sede en la Comunidad de Madrid.</li>
                    <li>- Proyectos con un nivel de madurez tecnológica (TRL) mínimo de 6.</li>
                    <li>- Implementación en la Infraestructura de Servicios Blockchain de España (ISBE).</li>
    
                    <strong>Gastos Cubiertos:</strong>
                    <li>- Personal y equipamiento.</li>
                    <li>- Obras y bienes fungibles.</li>
                    <li>- Subcontrataciones, incluyendo facturas externas.</li>
    
                    <p><strong>Proceso de Solicitud:</strong> La concurrencia es simplificada por orden de solicitud hasta agotar fondos. La fecha límite es el <strong>30 de abril de 2025</strong>.</p>
                """
            })
            completion_2 = client.chat.completions.create(
                model="gpt-4o",
                messages=tool_response,
            )

            final_response = completion_2.choices[0].message.content 
            return final_response
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"❌ ERROR in process_response: {e}", exc_info=True)
            print(f"Error in process_response: {e}")
            return "Lo siento, ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde."
