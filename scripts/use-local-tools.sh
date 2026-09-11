# Run with: source scripts/use-local-tools.sh
# Changes only the current terminal's PATH; does not install or deploy anything.
_punkture_node_bin="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' 2>/dev/null; then
  if [ -x "$_punkture_node_bin/node" ]; then
    export PATH="$_punkture_node_bin:$PATH"
  else
    printf '%s\n' 'Node 24+ is required. Install/select Node 24, then source this file again.'
    unset _punkture_node_bin
    return 1
  fi
fi
# Optional temporary Java runtime prepared for this Mac during validation.
_punkture_java_bin='/private/tmp/punkture-jre21/jdk-21.0.12.1+1-jre/Contents/Home/bin'
if [ -x "$_punkture_java_bin/java" ]; then
  export PATH="$_punkture_java_bin:$PATH"
fi
# Reuse the already downloaded CLIs rather than installing them again.
export npm_config_cache="$PWD/node_modules/.tmp/npm-cache"
node --version
printf '%s\n' 'Project tools selected for this terminal. Java 21+ is required for npm run test:rules.'
unset _punkture_node_bin _punkture_java_bin
