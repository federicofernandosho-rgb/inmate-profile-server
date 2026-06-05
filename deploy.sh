#!/usr/bin/env bash
set -euo pipefail

# deploy.sh - simple deployment helper for Inmate Profile
# Usage:
#   ./deploy.sh <repo-url> [branch]
#   OR if repository already exists on the server:
#   APP_DIR=/opt/inmate-profile PORT=3000 ./deploy.sh

REPO_URL=${1:-}
BRANCH=${2:-main}
APP_DIR=${APP_DIR:-/opt/inmate-profile}
PORT=${PORT:-3000}
SERVICE_NAME=${SERVICE_NAME:-inmate-profile}

echo "Deploy starting: APP_DIR=$APP_DIR BRANCH=$BRANCH PORT=$PORT"

if [ -n "$REPO_URL" ] && [ ! -d "$APP_DIR/.git" ]; then
  echo "Cloning $REPO_URL (branch: $BRANCH) into $APP_DIR"
  mkdir -p "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  if [ ! -d "$APP_DIR" ]; then
    echo "ERROR: $APP_DIR does not exist and no repo URL provided."
    echo "Either create the directory and clone manually, or pass the repo URL as the first argument."
    exit 1
  fi
  echo "Updating existing repo in $APP_DIR"
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
fi

cd "$APP_DIR"

# Backup data folder
if [ -d data ]; then
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p backups
  tar -czf "backups/data-backup-$ts.tar.gz" data
  echo "Backed up data to backups/data-backup-$ts.tar.gz"
fi

echo "Installing dependencies (production)..."
if command -v npm >/dev/null 2>&1; then
  npm ci --production || npm install --production
else
  echo "npm not found. Install Node.js and npm before running this script."
  exit 1
fi

# Start with pm2 if available
if command -v pm2 >/dev/null 2>&1; then
  echo "pm2 detected — starting/updating process"
  # Try to start or restart the named process
  if pm2 describe "$SERVICE_NAME" >/dev/null 2>&1; then
    pm2 restart "$SERVICE_NAME" --update-env || pm2 start server.js --name "$SERVICE_NAME" --update-env -- PORT=$PORT
  else
    pm2 start server.js --name "$SERVICE_NAME" --update-env -- PORT=$PORT
  fi
  pm2 save || true
  echo "pm2 started $SERVICE_NAME. View logs: pm2 logs $SERVICE_NAME"
else
  echo "pm2 not found. Attempting systemd install if running as root."
  if [ "$(id -u)" -eq 0 ]; then
    NODE_BIN=$(command -v node || true)
    if [ -z "$NODE_BIN" ]; then
      echo "node not found in PATH. Install Node.js before proceeding."
      exit 1
    fi
    SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
    echo "Writing systemd unit to $SERVICE_FILE"
    cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Inmate Profile Service
After=network.target

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN server.js
Restart=always
Environment=PORT=$PORT
Environment=NODE_ENV=production
User=${RUN_AS_USER:-www-data}

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"
    echo "systemd service installed and started: sudo journalctl -u $SERVICE_NAME -f"
  else
    echo "Not running as root and pm2 is not installed."
    echo "Install pm2 (npm i -g pm2) or run as root to install a systemd unit."
    exit 1
  fi
fi

echo "Deploy complete."
