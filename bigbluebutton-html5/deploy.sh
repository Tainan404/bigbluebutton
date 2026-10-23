#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RESET=false
SAFARI=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [--reset] [--safari]

Options:
  --reset     Remove node_modules before installing dependencies (full reset)
  --safari    Build both default and Safari targets and copy them to BBB
  --help      Show this help message
EOF
}

# Parse arguments
for var in "$@"; do
  case "$var" in
    --reset) RESET=true ;;
    --safari) SAFARI=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $var"; usage; exit 2 ;;
  esac
done

if $RESET; then
  echo "Performing a full reset..."
  rm -rf node_modules
fi

# Install missing dependencies if needed
if [ ! -d ./node_modules ] || ! npm ls --depth=0 >/dev/null 2>&1; then
  echo "Running npm install..."
  npm ci --no-progress
fi

# Build
rm -rf dist

if $SAFARI; then
  echo "Running all target builds..."
  npm run build:all
else
  echo "Running regular build (Safari step skipped)..."
  npm run build
fi

echo "Copying dist/* to /usr/share/bigbluebutton/html5-client/..."
sudo cp -rf dist/* /usr/share/bigbluebutton/html5-client/

echo "Switching nginx config to static and restarting nginx..."
sudo ln -sf /usr/share/bigbluebutton/nginx/bbb-html5.nginx.static /usr/share/bigbluebutton/nginx/bbb-html5.nginx
sudo systemctl restart nginx

echo -e '\n\n----------------\nbbb-html5 updated'
