#!/usr/bin/env bash
# Programa el radar diario (6:30 a. m.) en esta Mac. Pide que exista la llave en app/radar/.env.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
if ! grep -qE '^ANTHROPIC_API_KEY=.+' "$AQUI/.env" 2>/dev/null; then
  echo "Falta ANTHROPIC_API_KEY en $AQUI/.env (copia .env.ejemplo y pon tu llave)." >&2
  exit 1
fi
label=com.mecha.radar-diario
target="$HOME/Library/LaunchAgents/$label.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/mecha/logs"
sed "s|__HOME__|$HOME|g" "$AQUI/launchagent/$label.plist" > "$target"
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$target"
echo "instalado: $label (todos los días 6:30). Log: ~/mecha/logs/radar-diario.log"
echo "Correrlo ya: launchctl kickstart -k gui/$(id -u)/$label"
