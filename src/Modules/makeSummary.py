from openai import OpenAI
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from Modules.logger_config import get_logger
logger = get_logger(__name__)
# -----------------------------------------------------
# CONFIGURACIÓN PROMPTS 
# -----------------------------------------------------

# -----------------------------------------------------

# ---------------------------------------------------------
# REALIZAR RESUMEN PARA INNOVALAUS CON CHAT GPT
# ---------------------------------------------------------
""" Función para enviar texto a OpenAI y obtener el resumen """
def crear_resumen_innovalaus(text_content, client, chatgpt_prompt_innovalaus, model_resumen):
    logger.info("CHAT GPT RUNNING...")
    if text_content:

        try:
            respuesta = client.chat.completions.create(
                model=model_resumen,
                messages=[
                    {"role": "developer", "content": chatgpt_prompt_innovalaus},
                    {"role": "user", "content": text_content}
                ]
            )

            return respuesta.choices[0].message.content
        

        except Exception as e:
            logger.error(f"Error al resumir documento: {e}")
            return "No se pudo generar el resumen."

# ---------------------------------------------------------
# REALIZAR RESUMEN PARA GRANTIAL CON CHAT GPT
# ---------------------------------------------------------
""" Función para enviar texto a OpenAI y obtener el resumen """
def crear_resumen_grantial(text_content, client, chatgpt_prompt_grantify, model_resumen):
    logger.info("CHAT GPT RUNNING...")
    if text_content:

        try:
            respuesta = client.chat.completions.create(
                model=model_resumen,
                messages=[
                    {"role": "developer", "content": chatgpt_prompt_grantify},
                    {"role": "user", "content": text_content}
                ]
            )

            return respuesta.choices[0].message.content
        
        except Exception as e:
            logger.error(f"Error al resumir documento: {e}")
            return "No se pudo generar el resumen."


################################################
#################### MAIN ######################
################################################
def resumen_main(texto_completo, chatgpt_prompt_innovalaus, 
                        chatgpt_prompt_grantify, model_resumen, client):
    """
    Crear el resumen para Innovalaus
    """
    resumen_innovalaus = crear_resumen_innovalaus(texto_completo, client, chatgpt_prompt_innovalaus, model_resumen)
    logger.info("RESUMEN CREADO: PARA INNOVALAUS: " + resumen_innovalaus)

    """
    Crear el resumen para SQL para Grantial
    """
    resumen_grantial = crear_resumen_grantial(texto_completo, client, chatgpt_prompt_grantify, model_resumen)
    logger.info("RESUMEN CREADO: PARA GRANTIAL: " + resumen_grantial)

    return resumen_innovalaus, resumen_grantial


