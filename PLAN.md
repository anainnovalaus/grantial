1. Crear carpetas backend/ y frontend/.
2. Mover los ficheros Python (Modules/, functions/, utils/, jobs/, tests relacionados) a backend/src/ y requirements.txt a backend/.
3. Mover los ficheros JS/TS y public, package.json, config TS/JSON a frontend/.
4. Actualizar rutas relativas y scripts (frontend/package.json scripts, vite.config.ts paths) y los imports Python si cambian.
5. Ajustar deploy.sh y .gitignore si hace falta.