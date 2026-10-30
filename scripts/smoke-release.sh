#!/usr/bin/env bash
# ---------------------------------------------------------------------------------------------
#   Copyright (c) Quatico Solutions AG. All rights reserved.
#   Licensed under the MIT License. See LICENSE in the project root for license information.
# ---------------------------------------------------------------------------------------------
#
# Smoke test for a published websmith release: installs the packages from npm into a fresh project
# outside the repository and checks the CLI, the Vite plugin and the webpack loader against one
# asset addon, including their watch modes. The CI e2e suites test the workspace build; this
# tests what users install. The release workflow runs it after publishing.
#
# Usage: scripts/smoke-release.sh <version> [workdir]
#   workdir  defaults to a new temporary directory; it is kept so you can look around afterwards
set -u

VERSION="${1:?usage: smoke-release.sh <version> [workdir]}"
WORK="${2:-$(mktemp -d "${TMPDIR:-/tmp}/websmith-smoke.XXXXXX")}"
REGISTRY="https://registry.npmjs.org"
TIMEOUT=30

PASS=0
FAIL=0
BG_PIDS=()

pass() {
    PASS=$((PASS + 1))
    printf '  PASS %s\n' "$1"
}
fail() {
    FAIL=$((FAIL + 1))
    printf '  FAIL %s\n' "$1"
    [ -n "${2:-}" ] && printf '       %s\n' "$2"
}
section() { printf '\n%s\n' "$1"; }

stop_bg() {
    pkill -P "$1" 2>/dev/null
    kill "$1" 2>/dev/null
    wait "$1" 2>/dev/null
}
cleanup() {
    local pid
    for pid in "${BG_PIDS[@]:-}"; do
        [ -n "$pid" ] && stop_bg "$pid"
    done
}
trap cleanup EXIT

# wait_for <file-glob> <text>: succeeds once a file matching the glob contains the text
wait_for() {
    local glob="$1" text="$2" i
    for ((i = 0; i < TIMEOUT * 2; i++)); do
        # shellcheck disable=SC2086
        grep -qs -- "$text" $glob && return 0
        sleep 0.5
    done
    return 1
}

# watch_edits <label> <file-glob>: edits data.txt three times and expects each value in the output
watch_edits() {
    local label="$1" glob="$2" n want
    for n in 1 2 3; do
        sleep 1
        want="edit-$n-$RANDOM"
        echo "$want" > data.txt
        if ! wait_for "$glob" "$want"; then
            fail "$label: edit $n not rebuilt within ${TIMEOUT}s" "expected '$want' in $glob"
            return
        fi
    done
    pass "$label: 3/3 asset edits rebuilt"
}

echo "websmith $VERSION smoke test in $WORK"
cd "$WORK" || exit 2

section "Setup"
echo '{ "name": "websmith-smoke", "private": true }' > package.json
if npm install --save-dev --registry "$REGISTRY" --no-audit --no-fund --loglevel=error \
    typescript@^6 vite@^7 webpack@^5 webpack-cli@^6 \
    "@quatico/websmith-compiler@$VERSION" "@quatico/websmith-api@$VERSION" \
    "@quatico/websmith-vite@$VERSION" "websmith-loader@$VERSION" > npm-install.log 2>&1; then
    pass "installed $VERSION from npmjs"
else
    fail "npm install failed" "see $WORK/npm-install.log"
    cat npm-install.log
    exit 1
fi

mkdir -p src addons/stamp
echo 'export const msg: string = "@@STAMP@@";' > src/index.ts
echo 'hello from asset' > data.txt
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "module": "esnext", "target": "es2022", "moduleResolution": "bundler", "declaration": true },
  "include": ["src"]
}
EOF
cat > websmith.config.json << 'EOF'
{ "addonsDir": "./addons", "addons": ["stamp"] }
EOF
cat > addons/stamp/addon.js << 'EOF'
const fs = require("fs"), path = require("path");
exports.activate = (ctx) => {
  ctx.registerProcessor((file, content) => {
    if (!content.includes("@@STAMP@@")) return content;
    const data = path.join(process.cwd(), "data.txt");
    ctx.addAssetDependency(data, file);
    return content.replace(/@@STAMP@@/g, fs.readFileSync(data, "utf8").trim());
  });
};
EOF
cat > vite.config.mjs << 'EOF'
import { defineConfig } from "vite";
import websmith from "@quatico/websmith-vite";
export default defineConfig({
  plugins: [websmith()],
  build: { minify: false, outDir: "dist-vite", lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" } },
});
EOF
cat > webpack.config.cjs << 'EOF'
const { join } = require("path");
module.exports = {
  mode: "development",
  devtool: false,
  entry: "./src/index.ts",
  output: { path: join(__dirname, "dist-wp"), filename: "main.js", library: { type: "commonjs2" } },
  resolve: { extensions: [".ts", ".js"] },
  module: {
    rules: [{
      test: /\.tsx?$/,
      use: [{
        loader: "websmith-loader",
        options: {
          tsConfigFile: join(__dirname, "tsconfig.json"),
          config: { addonsDir: join(__dirname, "addons"), addons: ["stamp"] },
        },
      }],
    }],
  },
};
EOF
BIN=./node_modules/.bin

section "CLI"
if $BIN/websmith --configFile websmith.config.json > cli.log 2>&1 && grep -q "hello from asset" dist/index.js; then
    pass "websmith runs the addon"
else
    fail "websmith build" "see $WORK/cli.log"
fi
if [ -f dist/index.d.ts ]; then
    pass "declaration emitted"
else
    fail "dist/index.d.ts missing"
fi

$BIN/websmith --noEmit --outDir dist-noemit > cli-noemit.log 2>&1
if [ ! -e dist-noemit ]; then
    pass "--noEmit writes nothing"
else
    fail "--noEmit wrote into dist-noemit"
fi

if $BIN/websmith -p . --outDir dist-p > cli-p.log 2>&1 && [ -f dist-p/index.js ]; then
    pass "-p <directory> compiles its tsconfig.json"
else
    fail "-p ." "see $WORK/cli-p.log"
fi

$BIN/websmith -p does-not-exist > cli-missing.log 2>&1
rc=$?
if [ "$rc" -eq 1 ] && grep -q "5058" cli-missing.log; then
    pass "-p <missing> reports error 5058 and exits 1"
else
    fail "-p <missing> exited $rc" "see $WORK/cli-missing.log"
fi

echo 'hello from asset' > data.txt
$BIN/websmith --configFile websmith.config.json --outDir dist-watch --watch > cli-watch.log 2>&1 &
pid=$!
BG_PIDS+=("$pid")
if wait_for dist-watch/index.js "hello from asset"; then
    watch_edits "websmith --watch" dist-watch/index.js
else
    fail "websmith --watch: no first build" "see $WORK/cli-watch.log"
fi
stop_bg "$pid"

section "Vite"
echo 'hello from asset' > data.txt
if $BIN/vite build > vite.log 2>&1 && grep -rqs "hello from asset" dist-vite; then
    pass "vite build runs the addon"
else
    fail "vite build" "see $WORK/vite.log"
fi

$BIN/vite build --watch --outDir dist-vite-watch > vite-watch.log 2>&1 &
pid=$!
BG_PIDS+=("$pid")
if wait_for "dist-vite-watch/*" "hello from asset"; then
    watch_edits "vite build --watch" "dist-vite-watch/*"
else
    fail "vite build --watch: no first build" "see $WORK/vite-watch.log"
fi
stop_bg "$pid"

section "webpack loader"
echo 'hello from asset' > data.txt
if $BIN/webpack -c webpack.config.cjs > webpack.log 2>&1 && grep -q "hello from asset" dist-wp/main.js; then
    pass "webpack runs the addon"
else
    fail "webpack build" "see $WORK/webpack.log"
fi

$BIN/webpack -c webpack.config.cjs --watch --output-path dist-wp-watch > webpack-watch.log 2>&1 &
pid=$!
BG_PIDS+=("$pid")
if wait_for dist-wp-watch/main.js "hello from asset"; then
    watch_edits "webpack --watch" dist-wp-watch/main.js
else
    fail "webpack --watch: no first build" "see $WORK/webpack-watch.log"
fi
stop_bg "$pid"

section "Result"
printf '  %d passed, %d failed; project kept in %s\n' "$PASS" "$FAIL" "$WORK"
if [ "$FAIL" -ne 0 ]; then
    for log in "$WORK"/*.log; do
        printf '\n--- %s\n' "$(basename "$log")"
        tail -n 30 "$log"
    done
    exit 1
fi
