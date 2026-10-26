# Usage:
#   powershell -ExecutionPolicy Bypass -File $HOME\.claude\mcp-setup.ps1

claude mcp add codegraph -s user '--' codegraph serve --mcp
# Cloudflare: user scope so /mcp can authenticate it; only agents/cloudflare.md uses it
# (the orchestrator denies mcp__cloudflare). After this, run /mcp -> cloudflare -> Authenticate.
claude mcp add --transport http -s user cloudflare https://mcp.cloudflare.com/mcp
