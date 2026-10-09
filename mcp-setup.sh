#!/usr/bin/env bash
set -euo pipefail

claude mcp add codegraph -s user -- codegraph serve --mcp
