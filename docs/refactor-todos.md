# Refactoring and Improvement Tasks for Todoist Plugin

Based on senior engineering review of recent changes (project integration and extensible fields). Prioritize in order; test after each. Mark with [x] when done.

- [ ] **Fix assignee fetching**: Populate `assigneeMap` in `getServerData` with batched `api.getUser` calls if `assigneeEnabled`. Update fields logic to use map or fallback to 'Unknown Assignee'.

- [ ] **Remove unused settings**: Delete `dueLangEnabled` and related fields (including `updatedAt` if redundant) from `DefaultSettings.ts`, `settingsMigrator.ts` (migrations v3/v4), `main.ts` (UI), and tests. Clean up any references.

- [ ] **Conditional API fetches**: In `getServerData` (`src/updateFileFromServer.ts`), wrap project/section/assignee fetches in `if (settings.projectEnabled)` etc. to avoid unnecessary API calls when disabled.

- [ ] **Add unit tests**: In `src/` or test dir:
  - Test `getFormattedTaskDetail` for field output, fallbacks (e.g., no assignee), empty labels.
  - Test `getServerData` for fetches, maps population, and edge cases (no tasks, failed fetches).
  - Update/expand `settingsMigrator.test.ts` for v4.

- [ ] **Refactor fields handling**: In `getFormattedTaskDetail` (`src/updateFileFromServer.ts`):
  - Use `reduce` or template literals for `fieldsStr` to improve readability.
  - Escape labels for Markdown (e.g., `@label` to `\@label`).
  - Make fallbacks configurable via settings (e.g., `projectFallback: '(Unknown)'`).

- [ ] **Optimize settings/UI**: In `addOutputFieldsSettings` (`main.ts`):
  - Group fields under an accordion or "Advanced" section to reduce clutter.
  - Default more fields (e.g., order, addedAt) to false; validate inputs (e.g., prefixes).

- [ ] **Add caching**: In `updateFileFromServer.ts`, implement simple in-memory `Map` cache for project/section/user fetches per session (e.g., reset on plugin load) to handle repeated queries efficiently.

- [ ] **Update docs**:
  - Expand `docs/plugin-changes.md` with assignee implementation details, removed fields, testing notes, and efficiency improvements.
  - Add inline comments to `updateFileFromServer.ts` (fetches, fields logic).
  - Regenerate `npm run build` and test in Obsidian after all changes.