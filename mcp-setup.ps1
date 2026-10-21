# Usage:
#   powershell -ExecutionPolicy Bypass -File $HOME\.claude\mcp-setup.ps1

# The Cloudflare MCP is defined inline in agents/cloudflare.md (agent-scoped) and must NOT be
# registered at user scope. If `claude mcp get cloudflare` shows user scope, remove it by hand:
#   claude mcp remove cloudflare -s user
claude mcp add codegraph -s user '--' codegraph serve --mcp
