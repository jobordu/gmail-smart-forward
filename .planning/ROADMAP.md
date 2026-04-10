# Roadmap: Gmail Smart Forward — Better Configuration Experience

## Overview

This milestone transforms Gmail Smart Forward from a tool for technical users into one anyone can set up without touching code. Four phases deliver the complete configuration experience: an interactive wizard that guides first-time setup, config validation that fails fast before deployment, a guided rollout flow that walks users through the three forwarding states, and allowlist management commands that remove the need to hand-edit `.env` files.

## Phases

- [ ] **Phase v1.0-01: Setup Wizard** - Interactive `npm run setup` that collects and writes a complete, valid `.env`
- [ ] **Phase v1.0-02: Config Validation** - Pre-push validation that catches missing or malformed config keys before Apps Script sees them
- [ ] **Phase v1.0-03: Rollout + Status** - Guided state-by-state rollout flow and a status command showing current forwarding configuration
- [ ] **Phase v1.0-04: Allowlist Management** - CLI commands to add, remove, and list allowed senders without opening `.env`

## Phase Details

### Phase v1.0-01: Setup Wizard
**Goal**: Users can configure Gmail Smart Forward from scratch by answering prompts — no `.env` editing, no guessing what values are valid.
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05, SETUP-06, SETUP-07, SETUP-08
**Success Criteria** (what must be TRUE):
  1. User runs `npm run setup` and is guided through all required fields via interactive prompts
  2. Invalid email addresses and file types are rejected with clear messages before anything is written
  3. User sees a summary of all collected values and must confirm before `.env` is written
  4. After a completed setup run, `.env` contains all required keys with valid values
  5. Re-running setup on an existing `.env` updates values without losing comments or unrelated keys
**Plans**: TBD

### Phase v1.0-02: Config Validation
**Goal**: Invalid configuration is caught and described precisely before it can cause a silent failure in Apps Script.
**Depends on**: Phase v1.0-01
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05
**Success Criteria** (what must be TRUE):
  1. User runs `npm run validate` and sees a list of every missing or malformed key with a plain-language description of what's wrong
  2. Running `npm run push` with an invalid `.env` fails immediately with a clear error — the push does not proceed
  3. Validation error messages name the exact key, show its current value (if any), and give an example of a valid value
  4. Email format errors and boolean format errors are each reported distinctly, not as a generic "invalid config"
**Plans**: TBD

### Phase v1.0-03: Rollout + Status
**Goal**: Users can progress through the three forwarding states (Preview → Backfill → Live) through a single guided command, and check current state at any time.
**Depends on**: Phase v1.0-02
**Requirements**: ROLL-01, ROLL-02, ROLL-03, ROLL-04, ROLL-05, STAT-01, STAT-02, STAT-03
**Success Criteria** (what must be TRUE):
  1. User runs `npm run status` and immediately sees which rollout state they are in, which flags are set, and what the forward-to address is
  2. User runs `npm run rollout` and the command shows current state and prompts for confirmation before advancing to the next state
  3. Rollout command updates `.env`, runs push, and prints the exact Apps Script function name the user must run next — with instructions on where to find it
  4. Attempting to skip a rollout state (e.g., Preview directly to Live) is blocked with an explanation of why the sequence matters
  5. Running `npm run status` when `.env` is missing or incomplete tells the user to run `npm run setup` rather than showing a cryptic error
**Plans**: TBD

### Phase v1.0-04: Allowlist Management
**Goal**: Users can manage the sender allowlist from the terminal without ever opening `.env`.
**Depends on**: Phase v1.0-03
**Requirements**: ALIST-01, ALIST-02, ALIST-03, ALIST-04, ALIST-05
**Success Criteria** (what must be TRUE):
  1. User runs `npm run allowlist add sender@example.com` and the sender appears in `.env` without any other values changing
  2. User runs `npm run allowlist remove sender@example.com` and the sender is removed; the command is a no-op if the sender wasn't listed
  3. User runs `npm run allowlist list` and sees a clean table of all currently allowed senders and domains
  4. Invalid email or domain format is rejected before any write, with a message showing what a valid format looks like
  5. After any add or remove operation, the command reminds the user to run `npm run push` to deploy the change
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in sequence: v1.0-01 → v1.0-02 → v1.0-03 → v1.0-04

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v1.0-01. Setup Wizard | 0/TBD | Not started | - |
| v1.0-02. Config Validation | 0/TBD | Not started | - |
| v1.0-03. Rollout + Status | 0/TBD | Not started | - |
| v1.0-04. Allowlist Management | 0/TBD | Not started | - |
