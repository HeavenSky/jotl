#!/usr/bin/env bash
# 下载固定版本的官方 JSON-Schema-Test-Suite 到 vendor/json-schema-test-suite/, 供 migrate(升级部分)与 data 的测试使用.
set -euo pipefail

# 2026-10-08 时官方仓库默认分支的最新 commit; 升级测试集时只改这一行.
COMMIT=5b0ee1613e45fcc2bddac00e07c19cd49b00d8a8

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEST="$ROOT/vendor/json-schema-test-suite"
STAMP="$DEST/.commit"

if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$COMMIT" ]; then
  echo "已是 $COMMIT, 跳过下载"
  exit 0
fi

mkdir -p "$ROOT/vendor"
ARCHIVE="$ROOT/vendor/json-schema-test-suite-$COMMIT.tar.gz"
curl -fsSL "https://codeload.github.com/json-schema-org/JSON-Schema-Test-Suite/tar.gz/$COMMIT" -o "$ARCHIVE"
rm -rf "$DEST"
mkdir -p "$DEST"
tar -xzf "$ARCHIVE" -C "$DEST" --strip-components=1
rm -f "$ARCHIVE"
echo "$COMMIT" > "$STAMP"
echo "已下载 $COMMIT 到 vendor/json-schema-test-suite/"
