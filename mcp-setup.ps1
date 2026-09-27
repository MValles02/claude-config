# Usage:
#   $env:DOKPLOY_URL="..."; $env:DOKPLOY_API_KEY="..."; powershell -ExecutionPolicy Bypass -File $HOME\.claude\mcp-setup.ps1

if ([string]::IsNullOrEmpty($env:DOKPLOY_URL)) {
    throw "DOKPLOY_URL is not set"
}
if ([string]::IsNullOrEmpty($env:DOKPLOY_API_KEY)) {
    throw "DOKPLOY_API_KEY is not set"
}

claude mcp add dokploy-mcp -s user -e "DOKPLOY_URL=$env:DOKPLOY_URL" -e "DOKPLOY_API_KEY=$env:DOKPLOY_API_KEY" '--' cmd /c npx -y @dokploy/mcp

claude mcp add tailscale-docs -s user --transport http https://tailscale.mcp.kapa.ai/
