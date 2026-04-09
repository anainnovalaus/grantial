

def tools():
    return[    
            {
            "type": "function",
            "function": {
                "name": "get_preguntas_subvenciones",
                "description": "Devuelve una respuesta sobre la pregunta en concreto que el usuario ha preguntado sobre la subvención o ayuda solicitada. ",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": "Título de la subvención a buscar en la base de datos vectorial de MilvusDB"
                            }
                        },
                    },
                    "required": ["titulo"],
                    "additionalProperties": False
                    },
                "strict": True
            },
            {
            "type": "function",
            "function": {
                "name": "get_subvenciones_hoy",
                "description": "Devuelve la lista de subvenciones publicadas hoy",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False
                },
                "strict": True
                }
            },
            {
            "type": "function",
            "function": {
                "name": "get_subvenciones_finalidad",
                "description": "Devuelve la lista de subvenciones publicadas para una finalidad en específico. El usuario es probable que diga: destinadas, finalidad, objetivo, propósito, sector, etc.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "finalidad": {
                            "type": "string",
                            "description": "Nombre de la finalidad, p.e. Innovación, Emprendimiento, Fomento del Empleo, Construcción, IA, Investigación..."
                            }
                        },
                    "required": ["finalidad"],
                    "additionalProperties": False
                    },
                "strict": True
                }
            },
            {
            "type": "function",
            "function": {
                "name": "get_subvenciones_por_region",
                "description": "Devuelve la lista de subvenciones publicadas por región española en específico. El usuario es probable que diga: por región, por comunidad, por provincia, por localidad, etc.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "region": {
                            "type": "string",
                            "description": "Region española a buscar, p.e. Andalucía, Madrid, Barcelona, Valencia, Galicia..."
                            }
                        },
                    "required": ["region"],
                    "additionalProperties": False
                    },
                "strict": True
                }
            },
            {
            "type": "function",
            "function": {
                "name": "get_subvenciones_por_beneficario",
                "description": "Devuelve la lista de subvenciones publicadas para un tipo de forma jurídica o física en especifico. El usuario es probable que diga: subvenciones para pymes, para autónomos, ayudas para startups, para personas físicas, etc.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tipo_juridico": {
                            "type": "string",
                            "description": "Nombre del tipo juridico, p.e. Fundación, Asociación, Empresa, Autónomo, Pyme, Gran Empresa, Startup..."
                            }
                        },
                    "required": ["tipo_juridico"],
                    "additionalProperties": False
                    },
                "strict": True
                }
            },
            {
            "type": "function",
            "function": {
                "name": "get_resumen_subvenciones",
                "description": "Devuelve un resumen de la subvención cuando el usuario pregunta por ella. El usuario es probable que diga: resumen, descripción, información, etc. Si su pregunta va relacionada con un detalle concreto de la subvención entonces debería usar la función get_preguntas_subvenciones",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "titulo": {
                            "type": "string",
                            "description": "Título de la subvención a buscar en la base de datos"
                            }
                        },
                    },
                    "required": ["titulo"],
                    "additionalProperties": False
                    },
                "strict": True
            },
            {
            "type": "function",
            "function": {
                "name": "get_match_entidad_subvencion",
                "description": "Recupera una lista de match que la entidades tiene con las subvenciones en la base de datos",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False
                    },
                "strict": True
                }
            }
        ]