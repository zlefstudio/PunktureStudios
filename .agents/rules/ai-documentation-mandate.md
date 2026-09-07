# AI Documentation & README Maintenance Rule

## 🚨 MANDATORY REQUIREMENT FOR ALL AI SESSIONS

1. **README as Single Source of Truth**:
   - Before exploring multiple files, read `README.md`. It contains the complete architectural map, data contracts, Firestore security schemas, and component workflows.
   - Do NOT burn tokens doing broad directory scans or file re-reads when `README.md` already contains the necessary context.

2. **Mandatory Documentation Update on Changes**:
   - Whenever you (the AI) add, remove, or modify:
     - New public pages or routes (HTML files, `vite.config.ts`, `PublicShell.tsx`)
     - Components in `src/components/` or `src/components/booking/`
     - State actions or interfaces in `src/store.ts` or `src/types.ts`
     - Database schema in `src/db.ts` or synchronization logic in `src/sync.ts`
     - Firestore rules in `firestore.rules`
     - Build or deployment configurations in `firebase.json` or `package.json`
   - **YOU MUST UPDATE `README.md` BEFORE ENDING YOUR TURN.**
   - Keep `README.md` token-dense, accurate, structured, and easy for the next AI session to read.

3. **Verify Everything Before Completion**:
   - `npm test` (must pass 100%)
   - `npm run lint` (0 warnings, 0 errors)
   - `npm run build` (0 errors)
   - `npm run test:rules` (when firestore.rules or cloud behavior is touched)
