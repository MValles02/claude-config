#!/usr/bin/env bash
set -euo pipefail

: "${DOKPLOY_URL:?set DOKPLOY_URL}"
: "${DOKPLOY_API_KEY:?set DOKPLOY_API_KEY}"

claude mcp add dokploy-mcp -s user -e DOKPLOY_URL="$DOKPLOY_URL" -e DOKPLOY_API_KEY="$DOKPLOY_API_KEY" -e DOKPLOY_ENABLED_TAGS="project,environment,server,application,compose,domain,deployment,postgres,backup,destination,schedule,volumeBackups" -- npx -y @dokploy/mcp

claude mcp add tailscale-docs -s user --transport http https://tailscale.mcp.kapa.ai/
