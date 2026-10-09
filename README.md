# claude-config

Configuración personal de Claude Code (`~/.claude`), sincronizada como repo privado.

## Uso en un PC nuevo

Si `~/.claude` ya tiene contenido:

```bash
git clone git@github.com:MValles02/claude-config.git /tmp/cc
cp -rn /tmp/cc/. ~/.claude/
```

Si `~/.claude` está vacío, clona directo ahí: `git clone git@github.com:MValles02/claude-config.git ~/.claude`

Luego:

1. Ejecuta `/login` dentro de Claude Code para autenticarte.
2. Exporta las variables de entorno necesarias y corre el script de MCP:
   ```bash
   export DOKPLOY_URL="..."
   export DOKPLOY_API_KEY="..."
   ~/.claude/mcp-setup.sh
   ```
   En Windows, `export` no aplica; usa PowerShell:
   ```powershell
   $env:DOKPLOY_URL="..."; $env:DOKPLOY_API_KEY="..."; powershell -ExecutionPolicy Bypass -File $HOME\.claude\mcp-setup.ps1
   ```
3. Los plugins se instalan a partir de `enabledPlugins` y `extraKnownMarketplaces` en `settings.json`. Si no se instalan solos, usa `/plugin` para agregarlos manualmente.

## Cómo se trabaja

- `settings.json` fija `"agent": "orchestrator"`: cada sesión arranca con el orquestador como líder. Describe el objetivo en lenguaje natural; él elige la ruta (respuesta directa, edición trivial, una tarea de `implementer` o el pipeline completo con `explorer`/`planner`/`implementer`/`verifier`) y los agentes de infra (`dokploy`, `vps`, `cloudflare`). Solo pregunta por decisiones de producto, alcance ambiguo o acciones de riesgo.
- Al terminar un cambio de código en un repo con remoto de GitHub, crea rama, commitea, pushea y abre el PR (el push pide confirmación; nunca mergea). Di "sin commit" o "solo el diff" para evitarlo.
- Para una sesión normal sin orquestador: `claude --agent claude`.
- Hooks: `auto-title.js` nombra la sesión con Haiku en el primer prompt (sin cargar plugins, hooks ni MCP); `guard-subagent-git.js` bloquea escrituras de git/`gh` dentro de sub-agentes.

## PC + VPS

- Claude Code corre en el PC (Windows); los repos viven en `~/code`.
- El VPS se alcanza con `ssh vps` usando el OpenSSH de Windows (`C:/Windows/System32/OpenSSH/ssh.exe`); el `ssh` de Git Bash no ve el agente de Windows.
- Solo el agente `vps` toca el servidor.
- El Claude instalado en el VPS no se usa.

## Herramientas externas

- CodeGraph: `npm i -g @colbymchenry/codegraph@1.6.1`, luego `codegraph telemetry off` y `codegraph init` en cada repo. `.codegraph/` se ignora vía `~/.config/git/ignore`.
- Engram v3.1.0: descarga el binario de GitHub releases (verifica el checksum) a un directorio del PATH (en este PC, `~/go/bin`), luego:
  ```bash
  claude plugin marketplace add Gentleman-Programming/engram && claude plugin install engram
  engram setup claude-code   # registra el MCP server (el plugin solo trae hooks); requiere jq y curl
  ```

- `~/.claude/dev-credentials.md` (no versionado): logins de desarrollo por proyecto que usa el `verifier` para los chequeos de UI con Playwright. Cópialo desde el VPS en un PC nuevo.

## Sincronizar cambios

Como en cualquier repo: rama `chore/...`, commit, PR a `main` (corre gitleaks) y squash merge. Después, `git pull` en `~/.claude`.

## Qué queda excluido a propósito

Credenciales, historial de conversaciones, sesiones, cache y `settings.local.json` nunca se suben (ver `.gitignore`). Las skills locales (`~/.claude/skills`) tampoco se versionan, y `syncClaudeAiSkills: false` evita cargar las skills de la cuenta de claude.ai.
