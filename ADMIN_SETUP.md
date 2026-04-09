# Configuración del Modo Admin

## ⚙️ Configurar el token de administrador

### 1. Establecer la variable de entorno `ADMIN_TOKEN`

Debes crear un token secreto y agregarlo como variable de entorno en tu servidor:

#### En desarrollo local (.env):
```bash
ADMIN_TOKEN=tu_token_super_secreto_aqui_12345
```

#### En producción (AWS/servidor):
Agrega la variable de entorno `ADMIN_TOKEN` en la configuración de tu servidor con un valor secreto fuerte.

**Ejemplo de token fuerte:**
```
ADMIN_TOKEN=grantial_admin_2025_Xk9$mP2#vL8@nQ4
```

### 2. Configurar el token en el navegador

Para acceder al panel de admin (`/admin/blog`), debes guardar el mismo token en el localStorage:

1. Abre la consola del navegador (F12)
2. Ejecuta:
```javascript
localStorage.setItem('token', 'tu_token_super_secreto_aqui_12345')
```

3. Navega a `/admin/blog` y ya podrás gestionar los artículos

### 3. Renovar el token (recomendado)

Por seguridad, cambia el token periódicamente:
1. Genera un nuevo token secreto
2. Actualiza la variable de entorno `ADMIN_TOKEN` en el servidor
3. Reinicia el servidor
4. Actualiza el token en el navegador con `localStorage.setItem('token', 'nuevo_token')`

## 🔒 Seguridad

- **NUNCA** compartas el token admin públicamente
- **NUNCA** subas el archivo `.env` a Git
- Usa tokens largos y complejos (mínimo 32 caracteres)
- Rota el token cada 3-6 meses
- Considera implementar tokens JWT con expiración para mayor seguridad

## ⚠️ Solución de problemas

### Error: "No autorizado - Token requerido"
- Verifica que ejecutaste `localStorage.setItem('token', 'tu_token')` en la consola

### Error: "No autorizado - Token inválido"
- El token en localStorage NO coincide con el `ADMIN_TOKEN` del servidor
- Verifica que sean exactamente iguales (sensible a mayúsculas/minúsculas)

### Error: "Configuración de autenticación incorrecta"
- La variable de entorno `ADMIN_TOKEN` NO está configurada en el servidor
- Agrega `ADMIN_TOKEN` al archivo `.env` o variables de entorno del servidor
