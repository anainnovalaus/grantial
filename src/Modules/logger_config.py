# Modules/logger_config.py

import logging
import os
import sys

_handlers = [logging.StreamHandler(sys.stdout)]
_file_handler_path = "/var/log/grantify/error.log"
try:
    os.makedirs(os.path.dirname(_file_handler_path), exist_ok=True)
    _handlers.append(logging.FileHandler(_file_handler_path, mode="a"))
except Exception:
    # In local/dev sandboxes we may not have permissions for /var/log.
    pass

# Configuración global del logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=_handlers,
)

# Función para obtener loggers por módulo
def get_logger(name=None):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    return logger
