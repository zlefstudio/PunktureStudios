# AGENT GUIDELINES & REPO CONVENTIONS

> **CRITICAL DIRECTIVE**:
> `README.md` is this repository's **Single Source of Truth (SSOT)** and primary architectural context bible.
>
> 1. **Token Economy**: Before reading dozens of source files across `src/`, read `README.md`. It covers architecture, directory layout, dual-surface constraints, data locking, sync protocols, and Firestore schemas.
> 2. **Mandatory Documentation Update**: Whenever you make architectural changes, add/modify components, modify database models or state actions, update Firestore rules, or change public routes, **YOU MUST UPDATE `README.md` BEFORE CONCLUDING YOUR TURN**.
> 3. **Validation**: Always verify changes by running `npm test`, `npm run lint`, and `npm run build`.
