#!/usr/bin/env sh
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# One-shot installer that downloads the matching caracal binary from a GitHub Release.

set -eu

REPO="Garudex-Labs/caracal"
INSTALL_DIR="${CARACAL_INSTALL_DIR:-${HOME}/.local/bin}"
VERSION="${CARACAL_VERSION:-latest}"

err() {
    printf 'caracal-install: %s\n' "$1" >&2
    exit 1
}

require() {
    command -v "$1" >/dev/null 2>&1 || err "missing required command: $1"
}

require uname
require mkdir
require chmod

if command -v curl >/dev/null 2>&1; then
    fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
    fetch() { wget -qO "$2" "$1"; }
else
    err "neither curl nor wget is installed"
fi

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "${arch}" in
    x86_64|amd64) arch=x64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) err "unsupported architecture: ${arch}" ;;
esac
case "${os}" in
    linux) target="caracal-linux-${arch}"; tui_target="caracal-tui-linux-${arch}" ;;
    darwin) target="caracal-darwin-${arch}"; tui_target="caracal-tui-darwin-${arch}" ;;
    msys*|mingw*|cygwin*|windowsnt) target="caracal-windows-x64.exe"; tui_target="caracal-tui-windows-x64.exe" ;;
    *) err "unsupported OS: ${os}" ;;
esac

if [ "${VERSION}" = "latest" ]; then
    base="https://github.com/${REPO}/releases/latest/download"
else
    base="https://github.com/${REPO}/releases/download/${VERSION}"
fi

mkdir -p "${INSTALL_DIR}"
dest="${INSTALL_DIR}/caracal"
tui_dest="${INSTALL_DIR}/caracal-tui"
case "${target}" in *.exe) dest="${dest}.exe"; tui_dest="${tui_dest}.exe" ;; esac

printf 'caracal-install: downloading %s/%s -> %s\n' "${base}" "${target}" "${dest}"
fetch "${base}/${target}" "${dest}"
chmod +x "${dest}"

if [ "${CARACAL_SKIP_TUI:-0}" != "1" ]; then
    printf 'caracal-install: downloading %s/%s -> %s\n' "${base}" "${tui_target}" "${tui_dest}"
    if fetch "${base}/${tui_target}" "${tui_dest}"; then
        chmod +x "${tui_dest}"
    else
        printf 'caracal-install: optional caracal-tui binary not available for this release; skipping\n' >&2
        rm -f "${tui_dest}"
    fi
fi

case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *) printf 'caracal-install: add %s to PATH (e.g. export PATH="%s:$PATH")\n' "${INSTALL_DIR}" "${INSTALL_DIR}" ;;
esac

printf 'caracal-install: installed. Next steps:\n'
printf '  caracal up         # start stack (Docker required)\n'
printf '  caracal init       # provision local zone\n'
printf '  caracal run -- env # smoke test ambient tokens\n'
printf '  caracal-tui        # interactive TUI to inspect zones, audit, agents\n'
