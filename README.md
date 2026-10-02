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

## Herramientas externas

- CodeGraph: `npm i -g @colbymchenry/codegraph@1.6.1`, luego `codegraph telemetry off` y `codegraph init` en cada repo. `.codegraph/` se ignora vía `~/.config/git/ignore`.
- Engram v3.0.0: descarga el binario de GitHub releases (verifica el checksum) a `~/.local/bin`, luego:
  ```bash
  claude plugin marketplace add Gentleman-Programming/engram && claude plugin install engram
  ```

## Sincronizar cambios

```bash
git pull
# ... hacer cambios ...
git add -A && git commit -m "mensaje" && git push
```

## Qué queda excluido a propósito

Credenciales, historial de conversaciones, sesiones, cache y `settings.local.json` nunca se suben (ver `.gitignore`). Las skills se excluyen porque se sincronizan solas a través de la cuenta de claude.ai.
