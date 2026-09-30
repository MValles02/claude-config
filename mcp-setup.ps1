# Usage:
#   $env:DOKPLOY_URL="..."; $env:DOKPLOY_API_KEY="..."; powershell -ExecutionPolicy Bypass -File $HOME\.claude\mcp-setup.ps1

if ([string]::IsNullOrEmpty($env:DOKPLOY_URL)) {
    throw "DOKPLOY_URL is not set"
}
if ([string]::IsNullOrEmpty($env:DOKPLOY_API_KEY)) {
    throw "DOKPLOY_API_KEY is not set"
}

claude mcp add dokploy-mcp -s user -e "DOKPLOY_URL=$env:DOKPLOY_URL" -e "DOKPLOY_API_KEY=$env:DOKPLOY_API_KEY" -e "DOKPLOY_ENABLED_TAGS=project,environment,server,application,compose,domain,deployment,postgres,backup,destination,schedule,volumeBackups" '--' cmd /c npx -y @dokploy/mcp@0.30.7

claude mcp add tailscale-docs -s user --transport http https://tailscale.mcp.kapa.ai/

# Windows has no /usr/bin/chromium: run 'npx playwright install chromium' once, or add --executable-path to a local Chrome.
claude mcp add playwright -s user '--' cmd /c npx -y @playwright/mcp@0.0.83 --headless --isolated --output-dir "$env:TEMP\playwright-mcp"
