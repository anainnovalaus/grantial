# 📋 Instrucciones para integrar el Blog en tu Backend Flask

## 1. Ejecutar el SQL en PostgreSQL

Primero, ejecuta el archivo `DATABASE_SETUP.sql` en tu base de datos PostgreSQL en AWS:

```bash
psql -h tu-host-aws -U tu-usuario -d tu-database -f DATABASE_SETUP.sql
```

O copia y pega el contenido del archivo en tu cliente SQL favorito (pgAdmin, DBeaver, etc.)

## 2. Integrar las rutas en tu aplicación Flask

En tu archivo principal de Flask (probablemente `app.py` o `main.py`), importa y registra el blueprint:

```python
# En tu app.py o main.py
from routes.blog_routes import blog_bp

# Después de crear tu app Flask
app = Flask(__name__)

# ... tu configuración actual ...

# Registrar el blueprint del blog
app.register_blueprint(blog_bp)
```

## 3. Configurar CORS (si es necesario)

Si tu frontend está en un dominio diferente al backend, asegúrate de tener CORS configurado:

```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "tu-dominio-frontend.com"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

## 4. Implementar autenticación en el decorador `@admin_required`

En el archivo `src/routes/blog_routes.py`, encontrarás el decorador `@admin_required`. Debes implementar tu lógica de autenticación:

```python
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No autorizado'}), 401
        
        token = auth_header.split(' ')[1]
        
        # IMPLEMENTA AQUÍ TU LÓGICA DE VERIFICACIÓN
        # Ejemplo con JWT:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            user_id = payload.get('user_id')
            
            # Verificar que el usuario sea admin
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT is_admin FROM users WHERE id = %s", (user_id,))
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if not result or not result[0]:
                return jsonify({'error': 'No tienes permisos de administrador'}), 403
                
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        
        return f(*args, **kwargs)
    return decorated_function
```

## 5. Configurar variables de entorno en React

Asegúrate de que tu archivo `.env` en el frontend tenga:

```env
VITE_API_URL=http://localhost:5000
# O en producción:
# VITE_API_URL=https://tu-api-aws.com
```

## 6. Añadir ruta en React Router

En tu archivo de rutas de React (probablemente `src/App.tsx` o donde tengas el router), añade:

```tsx
import BlogAdmin from '@/pages/admin/BlogAdmin';

// En tu router
<Route path="/admin/blog" element={<BlogAdmin />} />
```

## 7. Probar la integración

### Backend:
1. Asegúrate de que tu servidor Flask está corriendo
2. Prueba los endpoints con curl o Postman:

```bash
# Obtener posts publicados (público)
curl http://localhost:5000/api/blog/posts

# Obtener post por slug (público)
curl http://localhost:5000/api/blog/posts/como-conseguir-financiacion-startup-2024

# Obtener todos los posts (admin - necesita token)
curl -H "Authorization: Bearer TU_TOKEN" http://localhost:5000/api/admin/blog/posts
```

### Frontend:
1. Visita `http://localhost:5173/blog` para ver la lista de posts
2. Visita `http://localhost:5173/admin/blog` para el panel de administración

## 8. Generar artículos con IA

El endpoint `/api/admin/blog/generate` usa tu clase `LLM` existente (que usa OpenAI).

**Importante:** Asegúrate de tener:
- La API key de OpenAI configurada en tus variables de entorno
- Suficientes créditos en tu cuenta de OpenAI

Ejemplo de uso desde el frontend:

```typescript
const response = await fetch(`${apiUrl}/api/admin/blog/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    topic: 'Subvenciones para restaurantes 2024'
  })
});

const generatedArticle = await response.json();
// Esto devuelve: { title, excerpt, content, category, read_time }
```

## 9. Próximos pasos opcionales

Una vez que todo funcione, puedes añadir:

### A. Upload de imágenes a S3
- Crear endpoint para subir imágenes a tu bucket S3 en AWS
- Actualizar el editor para permitir upload directo

### B. Sistema de etiquetas/tags
- Añadir tabla `blog_tags` y relación many-to-many
- Filtrar posts por tags

### C. Comentarios
- Añadir tabla `blog_comments`
- Sistema de moderación

### D. Analytics
- Contador de visitas por artículo
- Tiempo de lectura promedio
- Artículos más populares

### E. SEO avanzado
- Sitemap automático
- Meta tags Open Graph
- Structured data (JSON-LD)

## 10. Troubleshooting

### Error: "Artículo no encontrado"
- Verifica que la tabla `blog_posts` existe
- Verifica que hay datos en la tabla con `SELECT * FROM blog_posts`

### Error: "No autorizado" en endpoints admin
- Verifica que estás enviando el token en el header `Authorization: Bearer TOKEN`
- Implementa correctamente el decorador `@admin_required`

### Error: "Error al generar artículo con IA"
- Verifica que tu API key de OpenAI está configurada
- Revisa los logs del servidor Flask para más detalles
- Asegúrate de tener créditos en OpenAI

### Los estilos no se ven bien
- Ejecuta `npm install` en el frontend para asegurar que TipTap está instalado
- Verifica que las clases de Tailwind se están aplicando correctamente

## 📞 Soporte

Si encuentras algún problema durante la integración, revisa:
1. Los logs del servidor Flask
2. La consola del navegador (F12)
3. La pestaña Network en las herramientas de desarrollo
4. Que todos los endpoints devuelven el formato JSON correcto