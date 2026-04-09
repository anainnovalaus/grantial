"""
Blog Routes - API endpoints para la gestión del blog

Este archivo debe ser importado en tu aplicación Flask principal.
Ejemplo de uso en tu app.py:

from routes.blog_routes import blog_bp
app.register_blueprint(blog_bp)
"""

from flask import Blueprint, request, jsonify
from utils.postgreSQL import get_connection
from utils.llm import LLM
import json
from functools import wraps
from datetime import datetime
import os

blog_bp = Blueprint('blog', __name__)

# Decorador para proteger rutas de administrador
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Obtener el token de autorización del header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No autorizado - Token requerido'}), 401
        
        # Extraer el token
        token = auth_header.split(' ')[1]
        
        # Obtener el token admin de las variables de entorno
        admin_token = "test"
        
        if not admin_token:
            print("ERROR: ADMIN_TOKEN no está configurado en las variables de entorno")
            return jsonify({'error': 'Configuración de autenticación incorrecta'}), 500
        
        # Verificar que el token coincida
        if token != admin_token:
            return jsonify({'error': 'No autorizado - Token inválido'}), 403
        
        return f(*args, **kwargs)
    return decorated_function



# ============= ENDPOINTS PÚBLICOS =============

@blog_bp.route('/api/blog/posts', methods=['GET'])
def get_published_posts():
    """
    Obtener todos los posts publicados (público)
    Query params opcionales:
    - category: Filtrar por categoría
    - limit: Número máximo de posts (default: todos)
    """
    try:
        category = request.args.get('category')
        limit = request.args.get('limit', type=int)
        
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT id, title, slug, excerpt, content, author, category, 
                read_time, image_url, is_featured, status, 
                published_at, created_at, updated_at
            FROM blog_posts
            WHERE status = 'published'
        """
        params = []
        
        if category:
            query += " AND category = %s"
            params.append(category)
        
        query += " ORDER BY published_at DESC, created_at DESC"
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        cursor.execute(query, params if params else None)
        columns = [desc[0] for desc in cursor.description]
        posts = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Convertir fechas a string ISO
        for post in posts:
            if post.get('published_at'):
                post['published_at'] = post['published_at'].isoformat()
            if post.get('created_at'):
                post['created_at'] = post['created_at'].isoformat()
            if post.get('updated_at'):
                post['updated_at'] = post['updated_at'].isoformat()
        
        cursor.close()
        conn.close()
        
        return jsonify(posts), 200
        
    except Exception as e:
        print(f"Error al obtener posts: {e}")
        return jsonify({'error': 'Error al obtener los artículos'}), 500


@blog_bp.route('/api/blog/posts/<slug>', methods=['GET'])
def get_post_by_slug(slug):
    """
    Obtener un artículo específico por su slug (público)
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, slug, excerpt, content, author, category, 
                   read_time, image_url, is_featured, status, 
                   published_at, created_at, updated_at
            FROM blog_posts
            WHERE slug = %s AND status = 'published'
        """, (slug,))
        
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Artículo no encontrado'}), 404
        
        columns = [desc[0] for desc in cursor.description]
        post = dict(zip(columns, row))
        
        # Convertir fechas a string ISO
        if post.get('published_at'):
            post['published_at'] = post['published_at'].isoformat()
        if post.get('created_at'):
            post['created_at'] = post['created_at'].isoformat()
        if post.get('updated_at'):
            post['updated_at'] = post['updated_at'].isoformat()
        
        cursor.close()
        conn.close()
        
        return jsonify(post), 200
        
    except Exception as e:
        print(f"Error al obtener post: {e}")
        return jsonify({'error': 'Error al obtener el artículo'}), 500


# ============= ENDPOINTS DE ADMINISTRACIÓN =============

@blog_bp.route('/api/admin/blog/posts', methods=['GET'])
@admin_required
def get_all_posts_admin():
    """
    Obtener TODOS los posts incluyendo borradores (admin)
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, slug, excerpt, content, author, category, 
                read_time, image_url, is_featured, status, 
                published_at, created_at, updated_at
            FROM blog_posts
            ORDER BY created_at DESC
        """)
        
        columns = [desc[0] for desc in cursor.description]
        posts = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Convertir fechas a string ISO
        for post in posts:
            if post.get('published_at'):
                post['published_at'] = post['published_at'].isoformat()
            if post.get('created_at'):
                post['created_at'] = post['created_at'].isoformat()
            if post.get('updated_at'):
                post['updated_at'] = post['updated_at'].isoformat()
        
        cursor.close()
        conn.close()
        
        return jsonify(posts), 200
        
    except Exception as e:
        print(f"Error al obtener posts: {e}")
        return jsonify({'error': 'Error al obtener los artículos'}), 500


@blog_bp.route('/api/admin/blog/posts', methods=['POST'])
@admin_required
def create_post():
    """
    Crear un nuevo post (admin)
    """
    try:
        data = request.json
        
        # Validar campos requeridos
        required_fields = ['title', 'slug', 'excerpt', 'content']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Campo requerido: {field}'}), 400
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verificar que el slug no exista
        cursor.execute("SELECT id FROM blog_posts WHERE slug = %s", (data['slug'],))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Ya existe un artículo con ese slug'}), 400
        
        # Insertar nuevo post
        published_at = datetime.now() if data.get('status') == 'published' else None
        
        cursor.execute("""
            INSERT INTO blog_posts 
            (title, slug, excerpt, content, author, category, read_time, 
                image_url, is_featured, status, published_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data['title'],
            data['slug'],
            data['excerpt'],
            data['content'],
            data.get('author', 'Grantial'),
            data.get('category', 'General'),
            data.get('read_time', '5 min'),
            data.get('image_url', ''),
            data.get('is_featured', False),
            data.get('status', 'draft'),
            published_at
        ))
        
        post_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'id': post_id, 'message': 'Artículo creado correctamente'}), 201
        
    except Exception as e:
        print(f"Error al crear post: {e}")
        return jsonify({'error': 'Error al crear el artículo'}), 500


@blog_bp.route('/api/admin/blog/posts/<int:post_id>', methods=['GET'])
@admin_required
def get_post_admin(post_id):
    """
    Obtener un post específico para editar (admin)
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, slug, excerpt, content, author, category, 
                read_time, image_url, is_featured, status, 
                published_at, created_at, updated_at
            FROM blog_posts
            WHERE id = %s
        """, (post_id,))
        
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Artículo no encontrado'}), 404
        
        columns = [desc[0] for desc in cursor.description]
        post = dict(zip(columns, row))
        
        # Convertir fechas a string ISO
        if post.get('published_at'):
            post['published_at'] = post['published_at'].isoformat()
        if post.get('created_at'):
            post['created_at'] = post['created_at'].isoformat()
        if post.get('updated_at'):
            post['updated_at'] = post['updated_at'].isoformat()
        
        cursor.close()
        conn.close()
        
        return jsonify(post), 200
        
    except Exception as e:
        print(f"Error al obtener post: {e}")
        return jsonify({'error': 'Error al obtener el artículo'}), 500


@blog_bp.route('/api/admin/blog/posts/<int:post_id>', methods=['PUT'])
@admin_required
def update_post(post_id):
    """
    Actualizar un post existente (admin)
    """
    try:
        data = request.json
        
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verificar que el post existe
        cursor.execute("SELECT id FROM blog_posts WHERE id = %s", (post_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Artículo no encontrado'}), 404
        
        # Si se está publicando por primera vez, establecer published_at
        published_at = None
        if data.get('status') == 'published':
            cursor.execute("SELECT published_at FROM blog_posts WHERE id = %s", (post_id,))
            current_published_at = cursor.fetchone()[0]
            published_at = current_published_at if current_published_at else datetime.now()
        
        # Actualizar post
        cursor.execute("""
            UPDATE blog_posts
            SET title = %s, slug = %s, excerpt = %s, content = %s,
                author = %s, category = %s, read_time = %s, image_url = %s,
                is_featured = %s, status = %s, published_at = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (
            data['title'],
            data['slug'],
            data['excerpt'],
            data['content'],
            data.get('author', 'Grantial'),
            data.get('category', 'General'),
            data.get('read_time', '5 min'),
            data.get('image_url', ''),
            data.get('is_featured', False),
            data.get('status', 'draft'),
            published_at,
            post_id
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Artículo actualizado correctamente'}), 200
        
    except Exception as e:
        print(f"Error al actualizar post: {e}")
        return jsonify({'error': 'Error al actualizar el artículo'}), 500


@blog_bp.route('/api/admin/blog/posts/<int:post_id>', methods=['DELETE'])
@admin_required
def delete_post(post_id):
    """
    Eliminar un post (admin)
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM blog_posts WHERE id = %s RETURNING id", (post_id,))
        deleted = cursor.fetchone()
        
        if not deleted:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Artículo no encontrado'}), 404
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Artículo eliminado correctamente'}), 200
        
    except Exception as e:
        print(f"Error al eliminar post: {e}")
        return jsonify({'error': 'Error al eliminar el artículo'}), 500


# ============= GENERADOR CON IA =============

@blog_bp.route('/api/admin/blog/generate', methods=['POST'])
@admin_required
def generate_article_with_ai():
    """
    Generar un artículo completo usando IA (admin)
    Body: { "topic": "Descripción del tema del artículo" }
    """
    try:
        data = request.json
        topic = data.get('topic')
        
        if not topic:
            return jsonify({'error': 'El campo "topic" es requerido'}), 400
        
        llm = LLM()
        
        # Prompt para generar el artículo
        prompt = f"""
Eres un experto escritor de contenido sobre subvenciones, financiación empresarial y ayudas públicas en España.

Genera un artículo de blog profesional sobre el siguiente tema:
{topic}

El artículo debe:
- Estar orientado a empresas, emprendedores y autónomos españoles
- Tener entre 800-1200 palabras
- Incluir información práctica y accionable
- Usar HTML para formateo (usa <h2> para subtítulos, <p> para párrafos, <ul> y <li> para listas, <strong> para resaltado)
- Ser optimizado para SEO
- Tener un tono profesional pero cercano
- Incluir datos específicos y ejemplos concretos cuando sea posible

Devuelve ÚNICAMENTE un objeto JSON válido con el siguiente formato (sin markdown, sin explicaciones adicionales):
{{
    "title": "Título atractivo y SEO-friendly (máximo 60 caracteres)",
    "excerpt": "Resumen de 150-200 caracteres que enganche al lector",
    "content": "Contenido completo del artículo en HTML",
    "category": "Categoría sugerida (opciones: Startups, Digitalización, Europa, Innovación, Sostenibilidad)",
    "read_time": "X min"
}}
"""
        
        # Procesar con LLM
        message_history, function_name, tool_id, arguments = llm.process_functions(prompt)
        
        # Si el LLM devolvió una respuesta directa (sin function calling)
        if not function_name and message_history:
            # Extraer el contenido de la respuesta
            response_content = message_history[-1]['content'] if message_history else ""
            
            # Intentar parsear como JSON
            try:
                # Limpiar la respuesta (remover posibles markdown code blocks)
                response_content = response_content.strip()
                if response_content.startswith('```json'):
                    response_content = response_content[7:]
                if response_content.startswith('```'):
                    response_content = response_content[3:]
                if response_content.endswith('```'):
                    response_content = response_content[:-3]
                response_content = response_content.strip()
                
                article_data = json.loads(response_content)
                
                # Validar que tenga los campos necesarios
                required_fields = ['title', 'excerpt', 'content', 'category', 'read_time']
                if all(field in article_data for field in required_fields):
                    return jsonify(article_data), 200
                else:
                    return jsonify({'error': 'La IA no devolvió todos los campos necesarios'}), 500
                    
            except json.JSONDecodeError:
                return jsonify({'error': 'Error al procesar la respuesta de la IA'}), 500
        
        return jsonify({'error': 'No se pudo generar el artículo'}), 500
        
    except Exception as e:
        print(f"Error al generar artículo con IA: {e}")
        return jsonify({'error': 'Error al generar el artículo'}), 500
