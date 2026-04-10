#!/bin/sh
# Install git hooks for this repo.
# Run once after cloning: npm run install-hooks

HOOKS_DIR=".git/hooks"
SCRIPTS_DIR="scripts/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "Error: $HOOKS_DIR not found. Are you in the repo root?"
  exit 1
fi

cp "$SCRIPTS_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"
echo "Installed pre-commit hook."
