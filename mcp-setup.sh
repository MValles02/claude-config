#!/usr/bin/env bash
set -euo pipefail

: "${DOKPLOY_URL:?set DOKPLOY_URL}"
: "${DOKPLOY_API_KEY:?set DOKPLOY_API_KEY}"

claude mcp add -s user -e DOKPLOY_URL="$DOKPLOY_URL" -e DOKPLOY_API_KEY="$DOKPLOY_API_KEY" dokploy-mcp -- npx -y @dokploy/mcp

claude mcp add -s user --transport http tailscale-docs https://tailscale.mcp.kapa.ai/
