import msal
import requests
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from Modules.logger_config import get_logger
logger = get_logger(__name__)
# -----------------------------------------------------
# CONEXIÓN SHAREPOINT
# -----------------------------------------------------

""" Función para obtener el token """
def autenticar_onedrive(authority, client_id, scopes, secret):
    """
    Autentica la aplicación en OneDrive usando MSAL.
    """
    logger.info("Autenticando One Drive")
    app = msal.ConfidentialClientApplication(
        client_id, 
        authority=authority,
        client_credential=secret
    )

    # The pattern to acquire a token looks like this.
    result = None

    # Firstly, looks up a token from cache
    # Since we are looking for token for the current app, NOT for an end user,
    # notice we give account parameter as None.
    result = app.acquire_token_silent(scopes=scopes, account=None)
    if not result:
        logger.error("Token no encontrado en caché. Solicitando un nuevo token...")
        result = app.acquire_token_for_client(scopes=scopes)
        

    if "access_token" in result:
        logger.info("Autenticación exitosa. Token obtenido.")
        return result["access_token"]
    else:
        raise Exception(f"Error en la autenticación del token: {result.get('error_description', 'Descripción no disponible')}")

""" Función para obtener el site-id de sharepoint Innovalaus """
def obtener_site_id(token, site_id_name):
    logger.info("Obteniendo el site ID...")

    url = f"https://graph.microsoft.com/v1.0/sites/innovalaus.sharepoint.com:/sites/{site_id_name}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        raw_site_id = response.json()["id"] # Extrae el dominio + el ID
        site_id = raw_site_id.split(',', 1)[1]  # Extrae solo el ID relevante
        logger.info("Site ID encontrado.")
        return site_id  # Devuelve el site_id
        
    else:
        logger.error(f"Error al obtener el Site ID del sitio: {response.status_code}, {response.text}")

""" Función para obtener el drive-id """
def obtener_drive_id(site_id, token):
    logger.info("Obteniendo el Site ID de SharePoint...")
    url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        drives = response.json()["value"]
        for drive in drives:
            logger.info(f"Drive name: {drive['name']}, Drive ID: {drive['id']}")
            if drive["name"] == "Documents":
                logger.info("Drive ID encontrado.")
                return drive["id"]
        raise Exception("Drive 'Documents' no encontrado.")
    else:
        raise Exception(f"Error al obtener drive ID: {response.status_code}, {response.text}")
    

def conect_sharepoint_main(authority, client_id, raw_scope, secret, site_id_name):
    """
    Función principal para conectar a SharePoint y obtener el token, site ID y drive ID.
    """
    logger.info("Conectando a SharePoint...")
    try:
        scopes = [raw_scope]      
        # Autenticación
        token = autenticar_onedrive(authority, client_id, scopes, secret)
        # Obtener el site ID
        site_id = obtener_site_id(token, site_id_name)
        # Obtener el drive ID
        drive_id = obtener_drive_id(site_id, token)
        return token, site_id, drive_id
    except Exception as e:
        logger.error(f"Error en la conexión a SharePoint: {e}")
        raise
    finally:
        logger.info("Conexión a SharePoint finalizada.")
        