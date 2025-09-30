# Changes Made to Todoist Text Plugin for Project Name Integration

## Overview
This modification adds Todoist project names to each task pulled from the Todoist API and displayed in Obsidian notes. Previously, tasks showed content, priority, URL, and description but lacked project context. The changes fetch project details asynchronously and append `[Project Name]` inline after task content for better organization and visibility without altering the overall task structure.

## Rationale
- **User Request**: The original task was to "pull in the Todoist Project Name with each task" by examining the codebase and using the Todoist API.
- **API Compatibility**: The Todoist REST API v2 (via `@doist/todoist-api-typescript` library v2.1.2) provides `projectId` in each Task object but not the name. Fetching names requires separate calls to `GET /projects/{id}`, which the library supports via `api.getProject(id)`.
- **Efficiency**: Fetch only unique project IDs from tasks (via Set) to minimize API calls (typically 1-5 per query, rate-limit safe).
- **Display**: Append `[ProjectName]` after task content (e.g., `- [ ] Task name [Inbox] -- p1 -- [src](url)`) for readability; use '(Unknown Project)' fallback if fetch fails.
- **No Breaking Changes**: Subtask handling, priority mapping, and status toggling remain unchanged. Supports existing settings (e.g., showSubtasks).

## Exact Changes in `src/updateFileFromServer.ts`
All modifications are in this file, as it's the core for task fetching and formatting.

1. **Import Project Type** (line 1):
   - Old: `import {Task, TodoistApi} from '@doist/todoist-api-typescript'`
   - New: `import {Task, TodoistApi, Project} from '@doist/todoist-api-typescript'`
   - Why: Enables typing for project objects returned by `api.getProject`.

2. **Fetch Projects in `getServerData` Function** (lines ~139-145, after `const tasks = await callTasksApi(api, todoistQuery);`):
   - Added:
     ```
     const projectIds = Array.from(new Set(tasks.map(task => task.projectId).filter(id => id)));
     const projectPromises = projectIds.map(id => api.getProject(id).catch(() => null));
     const projects = await Promise.all(projectPromises);
     const projectMap = new Map(projects.filter(p => p !== null).map(p => [p.id, p.name]));
     ```
   - Why: Extracts unique `projectId`s from tasks (Task has `projectId: string`). Batches fetches with `Promise.all` for concurrency. Creates `Map<id, name>` for O(1) lookups. Error handling skips invalid IDs. Placed before `if (tasks.length === 0)` to avoid unnecessary fetches.

3. **Update Function Signatures**:
   - `getFormattedTaskDetail`: Added `projectMap: Map<string, string>` as 5th parameter.
     - Old: `function getFormattedTaskDetail(task: Task, indent: number, showSubtaskSymbol: boolean): string`
     - New: `function getFormattedTaskDetail(task: Task, indent: number, showSubtaskSymbol: boolean, projectMap: Map<string, string>): string`
   - `getSubTasks`: Added `projectMap: Map<string, string>` as 5th parameter (passed recursively).
     - Why: Allows accessing project data in task formatting and subtask recursion.

4. **Add Project Name in `getFormattedTaskDetail`** (line ~210, after `let tabs = "\t".repeat(indent);`):
   - Added:
     ```
     const projectName = projectMap.has(task.projectId) ? projectMap.get(task.projectId) : '(Unknown Project)';
     ```
   - Why: Defines `projectName` for use in the return string (fixes TS2304 error).

5. **Update Return String in `getFormattedTaskDetail`** (line ~222):
   - Old: `return \`${tabs}- [ ] ${subtaskIndicator}${task.content} -- p${priorityMap.get(task.priority)} -- [src](${task.url}) ${description}\n\`;`
   - New: `return \`${tabs}- [ ] ${subtaskIndicator}${task.content} [${projectName}] -- p${priorityMap.get(task.priority)} -- [src](${task.url}) ${description}\n\`;`
   - Why: Inserts project name in brackets after content for clear association.

6. **Pass projectMap in Calls** (lines ~150-167 in `getServerData`, ~202-203 in `getSubTasks`):
   - Updated all invocations:
     - e.g., Old: `getFormattedTaskDetail(task, 0, false)`
     - New: `getFormattedTaskDetail(task, 0, false, projectMap)`
     - Similarly for orphans, non-subtask mode, and recursive subtasks.
   - Why: Propagates the map to where it's needed. All ~6 calls updated; no missed ones.

## Impact and Testing Notes
- **API Usage**: Adds ~1 API call per unique project (e.g., 3-10 for typical queries). Handles async with `await`.
- **Compatibility**: Works with existing filters/queries; subtasks inherit project from parent.
- **Error Handling**: `.catch(() => null)` skips failed fetches; fallback to '(Unknown Project)'.
- **Testing**: Verified build succeeds (`npm run build`). In Obsidian, tasks show projects; toggling unaffected.
- **No Other Files Changed**: `main.ts`, `DefaultSettings.ts`, etc., unchanged as task logic is isolated.

For further modifications, review this as the baseline for project integration.

## Configurable Todoist API Fields Integration

### Overview
This extension adds support for all major displayable fields from the Todoist Task REST API v2 in the task output formatting. Previously, only project name (via extension) was added; now users can configure toggles for fields like assignee, comments count, order, creation/update dates, and detailed due components (ISO date, recurring flag). Each field can be enabled/disabled and wrapped with custom prefixes/suffixes (e.g., [[Project]] for Obsidian links). Fields insert between -- separators after task content, maintaining non-breaking compatibility.

Examples (before/after enabling fields):
- Before: `- [ ] Wash sheets [Home] -- p4 -- [src](https://app.todoist.com/app/task/6933086492)`
- After (with example prefixes configured): `- [ ] Wash sheets -- [[Home]] -- assignee: John -- 3 comments -- 2023-10-01 -- recurring -- p4 -- [src](https://app.todoist.com/app/task/6933086492)`\n  - Default (empty prefixes/suffixes): `- [ ] Wash sheets -- [[Home]] -- John -- 3 -- 2023-10-01T12:00:00.000Z -- recurring -- p4 -- [src](https://app.todoist.com/app/task/6933086492)`

### Rationale
- **User Request**: "Add the ability to add any field available in the API" to further customize output beyond project.
- **API Compatibility**: Uses Todoist REST API v2 via `@doist/todoist-api-typescript` (v2.1.2). Key fields from Task: `assigneeId` (fetched via all users from `/rest/v2/users`), `commentCount`, `order`, `createdAt` (for addedAt), `due.date` (ISO), `due.string` (natural), `due.isRecurring`. `due.lang` not used (not in API); `updatedAt` included in settings but not displayed (redundant). No breaking changes to core task sync/toggling.
- **Efficiency**: Batch unique ID fetches for assignee (similar to project/section, 1-3 calls typically). Direct access for others (no extra API).
- **Customization**: Per-field toggles in settings; defaults disable new fields to avoid output bloat. Supports Obsidian-specific formatting (e.g., links).
- **Display**: Fields optional; fallback to empty if unavailable (e.g., no assignee shows nothing).

### Exact Changes
Changes span multiple files for settings, UI, migration, and logic.

#### Assignee Implementation Details
- Assignee fetching uses a direct API call to `https://api.todoist.com/rest/v2/users` (instead of per-ID `api.getUser` for efficiency), retrieving all users once per query and building a `Map<id, name>`.
- Only proceeds if `assigneeEnabled` is true; handles errors with console logging, falls back to 'Unknown Assignee'.
- In formatting: If `task.assigneeId` exists and enabled, appends `${assigneePrefix}${name}${assigneeSuffix}`; no output if unassigned.
- Requires Todoist Pro/Business for assignees; free plans show nothing.

#### Removed Fields
- `dueLang`: Not part of Todoist API v2 `due` object; removed to avoid invalid access.
- `updatedAt`: Redundant with `addedAt` (`createdAt`); omitted to reduce output clutter—use `addedAtEnabled` for creation time.

#### Efficiency Improvements
- **Batching**: Projects/sections: Collect unique IDs, fetch concurrently with `Promise.all`, filter nulls—limits to 1 call per unique ID (typically 1-5 total).
- **Assignee**: Single fetch of all users (~10-50 for teams) via direct API, O(1) map lookups; avoids per-task calls.
- **Conditional Fetching**: Only fetch if enabled in settings, preventing unnecessary API calls.
- **No Extra Calls**: Direct properties (e.g., `commentCount`, `order`, `createdAt`, `due.date/isRecurring`) use no additional API.
- Rate-limit safe: Total ~1-10 calls per full sync; async handling prevents blocking.

#### Expanded Testing Notes
- **Build/Compile**: Run `npm run build`—verifies no TS errors (e.g., type guards on IDs, map typing).
- **Settings UI**: Toggle fields in Obsidian settings; save/load persists via migration (v4 adds defaults).
- **Output Verification**:
  - Enable assignee: Tasks with assignees show `-- ${assigneeName} --` (e.g., `-- John --`; configure prefix like 'assignee: '); unassigned omit.
  - Enable comments: Only if `commentCount > 0`, e.g., `-- 3 --` (configure prefix/suffix like '3 comments' if desired).
  - dueEnabled: natural language due (e.g., "Tomorrow"); dueDateEnabled: ISO date for `due.date` (e.g., "2023-10-01T00:00:00.000Z"); dueRecurringEnabled: 'recurring' flag if `isRecurring`.
  - Fallbacks: '(Unknown Project/Section/Assignee)' if fetch fails.
- **Compatibility**: Existing project-only output unchanged (others default false). Subtasks inherit maps. Toggle close/reopen unaffected.
- **Edge Cases**: Empty query (no tasks), invalid token (error notice), no assignee (silent), large teams (users fetch handles 100+).
- **Obsidian Integration**: Reload plugin after build; query keywords update with new fields. Test with mixed tasks (assigned/unassigned, recurring/non).
- Manual: Create test tasks in Todoist (assign, comment, due), sync in Obsidian, verify formatting/links.

No changes to toggleServerTaskStatus, callTasksApi, or getTaskDescription.

1. **DefaultSettings.ts** (lines ~7-46, ~55-98):
   - Added interface fields: `assigneeEnabled: boolean; assigneePrefix: string; assigneeSuffix: string;`, similarly for comments, order, addedAt, updatedAt, dueDate, dueLang (removed), dueRecurring.
   - DEFAULT_SETTINGS: Added toggles (false) and empty strings for prefixes/suffixes.
   - Bumped `settingsVersion` to 4.
   - Why: Enables persistence and typing for new configs.

2. **settingsMigrator.ts** (lines ~14-22):
   - Added `migrateToV4` in `migrateSettings`: If version == 3, add new fields (defaults) and set version 4.
   - Updated `migrateToV3`: Return type `TodoistSettings` (includes all fields); added new fields to its object.
   - Why: Ensures old installs get new defaults without data loss.

3. **main.ts** (TodoistPluginSettingTab class, lines ~97-292):
   - Expanded `display()`: After `this.addExcludedDirectoriesSetting(containerEl);`, call `this.addOutputFieldsSettings(containerEl);`.
   - Added `addOutputFieldsSettings` method: New 'h2' for "Task Output Fields" with desc. Added Setting blocks for each new field (toggle + prefix/suffix inputs), mirroring existing (e.g., project).
   - Removed dueLang (not in final impl); kept dueDate/Recurring.
   - Why: Provides UI for users to configure per-field inclusion/formatting.

4. **updateFileFromServer.ts** (lines ~1, ~136-182, ~207-217, ~233-288):
   - Import: Added `User` (for assignee).
   - `getServerData`: Declared maps (projectMap, sectionMap, assigneeMap) early. If `projectEnabled`, fetch unique projectIds with type guards (filter non-null), batch `api.getProject`, map id->name. Similarly for `sectionEnabled` (sectionId, `api.getSection`, map to Section). For `assigneeEnabled`, fetch unique assigneeIds via `api.getUser`, map id->name.
   - Updated all calls: Pass all maps (project/section/assignee) to `getFormattedTaskDetail` and `getSubTasks` in parentTasks loop, orphans, non-subtask mode, and recursion.
   - `getFormattedTaskDetail` & `getSubTasks` signatures: Added `assigneeMap: Map<string, string>` as 6th param (after sectionMap, before settings).
   - In fields array (getFormattedTaskDetail):
     - Existing: project (from map), section (from map), labels (join array), due.string (formatted).
     - New: Assignee (if assigneeId and enabled, name from map or 'Unknown'); comments (if commentCount > 0, show count); order (if enabled); addedAt (task.createdAt ISO); dueDate (if due?.date, ISO); dueRecurring (if due?.isRecurring, 'recurring').
     - Removed: dueLang (not in API due object); updatedAt (redundant with addedAt).
   - Why: Ensures conditional API fetches (only if enabled) for efficiency; proper scoping/type guards prevent errors. Uses exact library types/properties (e.g., `commentCount`, `isRecurring`). Fixes prior scope issues by declaring maps before conditionals and passing consistently.

No changes to toggleServerTaskStatus, callTasksApi, or getTaskDescription.

### Impact and Testing Notes
- **API Usage**: +1-3 calls for unique assignees (rate-limit safe). Total ~5-15 for full config.
- **Output**: Flexible; e.g., enable assignee/comments for collaborative views. Fields only add if value exists/enabled.
- **Compatibility**: Preserves existing output (project default enabled). Subtasks inherit maps. No impact on task closing/reopening.
- **Error Handling**: `.catch(() => null)` for fetches; fallbacks like 'Unknown' for assignee.
- **Testing**: `npm run build` succeeds post-fixes. In Obsidian: Settings toggle fields, pull tasks—verify output (e.g., -- assignee: John --). Test with tasks having no assignee (nothing shows). UI saves correctly.
- **Limitations**: Assignee requires Pro/Business plan. Dates in ISO; no auto-formatting. No fetch for comments content (count only).

For future mods, this provides full API field extensibility.

Last Modified: 2025-09-30 (updated for configurable fields implementation)
