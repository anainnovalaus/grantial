#!/bin/bash

# Log a ~/grantify-deploy.log
exec > >(tee -a ~/grantify-deploy.log) 2>&1
set -euo pipefail

PROJECT_DIR="/home/ubuntu/Grantify"
VENV_PATH="/home/ubuntu/.venvs/grantify/bin/activate"

echo "📅 Fecha: $(date)"
echo "📁 Proyecto: $PROJECT_DIR"
echo "🚀 Iniciando despliegue..."

echo "🛑 Deteniendo backend..."
sudo systemctl stop gunicorn.service || true

echo "➡️  Sincronizando repo"
cd "$PROJECT_DIR"
git fetch origin
# Deja el árbol EXACTAMENTE como origin/main (descarta cambios locales)
git reset --hard origin/main

# Borra archivos no versionados (incl. node_modules si existe y no está trackeado)
# Si tienes archivos locales que quieras preservar (p.ej. .env), añade -e '.env'
git clean -fd

echo "🐍 Activando entorno virtual..."
source "$VENV_PATH"

echo "📦 Instalando dependencias Python..."
pip install --upgrade pip
pip install -r requirements.txt

# Usa la misma versión de Node que en desarrollo (opcional pero recomendado)
if [ -f "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  # Si tienes .nvmrc en el repo, usará esa versión; si no, usa LTS
  if [ -f ".nvmrc" ]; then
    nvm install >/dev/null
    nvm use >/dev/null
  else
    nvm install --lts >/dev/null
    nvm use --lts >/dev/null
  fi
fi

echo "🧪 Versiones: node=$(node -v 2>/dev/null || echo 'no-node') npm=$(npm -v 2>/dev/null || echo 'no-npm')"

echo "📦 Instalando dependencias frontend (npm ci)…"
# npm ci NO modifica package-lock.json y requiere lockfile presente
npm ci

echo "🛠️ Compilando frontend (vite build)…"
npm run build

echo "🧹 Limpiando /var/www/html y publicando dist/…"
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/

echo "🚀 Reiniciando backend..."
sudo systemctl restart gunicorn.service

echo "✅ Despliegue completado con éxito."
echo "📄 Logs del backend: sudo tail -f /var/log/grantify/error.log"
