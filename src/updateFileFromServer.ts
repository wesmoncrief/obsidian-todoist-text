import {Task, TodoistApi, Project, Section, User} from '@doist/todoist-api-typescript'
import {App, Editor, Notice, } from 'obsidian'
import {TodoistSettings} from "./DefaultSettings";

export async function updateFileFromServer(settings: TodoistSettings, app: App) {
	const file = app.workspace.getActiveFile();
	// if length too short, probably didn't set the settings and just left the placeholder empty string
	if (settings.excludedDirectories.filter(ed => ed.length > 1).some(ed => file.path.contains(ed))) {
		console.log("todoist text: not looking at file bc of excluded directories");
		return;
	}

	let fileContents = await app.vault.read(file)
	for (const keywordToQuery of settings.keywordToTodoistQuery) {
		// if length too short, probably didn't set the settings and just left the placeholder empty string
		// If you wanted to pull all tasks, you can always use `view all` filter definition.
		if (keywordToQuery.keyword.length > 1 && keywordToQuery.todoistQuery.length > 1 && fileContents.contains(keywordToQuery.keyword)) {
			if (settings.authToken.contains("TODO - ")) {
				new Notice("Todoist Text: You need to configure your Todoist API token in the Todoist Text plugin settings");
				throw("Todoist text: missing auth token.")
			}
			console.log("Todoist Text: Updating keyword with todos. If this happened automatically and you did not intend for this " +
				"to happen, you should either disable automatic replacement of your keyword with todos (via the settings), or" +
				" exclude this file from auto replace (via the settings).")
			const formattedTodos = await getServerData(keywordToQuery.todoistQuery, settings);

			// re-read file contents to reduce race condition after slow server call
			fileContents = await app.vault.read(file)
			const newData = fileContents.replace(keywordToQuery.keyword, formattedTodos);
			await app.vault.modify(file, newData)
		}
	}
}

function extractTaskIdFromLine(lineText: string): string | null {
	const match = lineText.match(
		/todoist\.com\/(?:showTask\?id=|app\/task\/)(\d+)/
	);
	return match ? match[1] : null;
}

export async function toggleServerTaskStatus(e: Editor, settings: TodoistSettings) {
	try {
		const lineText = e.getLine(e.getCursor().line);
		// The line must start with only whitespace, then have a dash. A currently checked off box
		// can have any non-whitespace character. This matches the behavior of Obsidian's
		// editor:toggle-checklist-status command.
		const tryingToCloseRegex = /^\s*- \[\s]/;
		const tryingToReOpenRegex = /^\s*- \[\S]/;
		const tryingToClose = tryingToCloseRegex.test(lineText)
		const tryingToReOpen = tryingToReOpenRegex.test(lineText)

		if (
			!(
				lineText.contains("[src](https://todoist.com/showTask?id=") ||
				lineText.contains("[src](https://app.todoist.com/app/task/")
			) &&
			(tryingToClose || tryingToReOpen)
		) {
			return;
		}

		const taskId = extractTaskIdFromLine(lineText);
		if(!taskId) {
		  console.warn("cannot find task ID in ", lineText);
		  return;
		}

		const api = new TodoistApi(settings.authToken)
		const serverTaskName = (await api.getTask(taskId)).content;
		if (tryingToClose) {
			await api.closeTask(taskId);

			const actionedTaskTabCount = lineText.split(/[^\t]/)[0].length;

			// check if there are any subtasks and mark them closed
			let subtasksClosed = 0;
			for (let line = e.getCursor().line + 1; line < e.lineCount(); line++) {
				const lineText = e.getLine(line);
				const tabCount = lineText.split(/[^\t]/)[0].length;
				if (tabCount==0) break;

				if (tabCount > actionedTaskTabCount) {
					const replacedText = lineText.replace("- [ ]", "- [x]");
					if (replacedText != lineText) { subtasksClosed++};
					e.setLine(line, replacedText);
				}
			}

			// advise user task is closed, along with any subtasks if they were found
			let taskClosedMessage = `Todoist Text: Closed "${serverTaskName}" on Todoist`;
			if (subtasksClosed > 0) {
				const plural = subtasksClosed == 1 ? "" : "s";
				taskClosedMessage = taskClosedMessage + ` and ${subtasksClosed} subtask${plural}.`;
			}
			new Notice(taskClosedMessage);
		}

		if (tryingToReOpen) {
			await api.reopenTask(taskId);

			const actionedTaskTabCount = lineText.split(/[^\t]/)[0].length;

			// check if there are any parent tasks and mark them opened
			let parentTasksOpened = 0;
			for (let line = e.getCursor().line - 1; line > 1; line--) {
				const lineText = e.getLine(line);
				const tabCount = lineText.split(/[^\t]/)[0].length;

				if (tabCount < actionedTaskTabCount) {
					const replacedText = lineText.replace("- [X]", "- [ ]").replace("- [x]", "- [ ]");
					if (replacedText != lineText) { parentTasksOpened++};
					e.setLine(line, replacedText);
				}

				if (tabCount==0 && parentTasksOpened > 0) break; // found the topmost task
			}

			// advise user task is open, along with any parent tasks if they were found
			let taskOpenedMessage = `Todoist Text: Re-opened "${serverTaskName}" on Todoist`;
			if (parentTasksOpened > 0) {
				const plural = parentTasksOpened == 1 ? "" : "s";
				taskOpenedMessage = taskOpenedMessage + ` and its parent task${plural}.`;
			}
			new Notice(taskOpenedMessage);

		}
	}
	catch (e){
		console.log("todoist text error: ", e);
		new Notice("Todoist Text: Error trying to update task status. See console log for more details.")
	}
}

async function getServerData(todoistQuery: string, settings: TodoistSettings): Promise<string> {
	const api = new TodoistApi(settings.authToken)

	const tasks = await callTasksApi(api, todoistQuery);

	let projectMap: Map<string, string> = new Map();
	if (settings.projectEnabled) {
		// Fetch unique project IDs from tasks and batch-fetch project details for efficient mapping
		const projectIds = Array.from(new Set(tasks.map(task => task.projectId).filter(id => id)));
		const projectPromises = projectIds.map(id => api.getProject(id).catch(() => null));
		const projects = await Promise.all(projectPromises);
		projectMap = new Map(projects.filter(p => p !== null).map(p => [p.id, p.name]));
	}

	let sectionMap: Map<string, string> = new Map();
	if (settings.sectionEnabled) {
		// Fetch unique section IDs from tasks and batch-fetch section details for efficient mapping
		const sectionIds = Array.from(new Set(tasks.map(task => task.sectionId).filter(id => id !== null)));
		const sectionPromises = sectionIds.map(id => api.getSection(id).catch(() => null)) as Promise<Section | null>[];
		const sections = await Promise.all(sectionPromises);
		sectionMap = new Map(sections.filter(s => s !== null).map(s => [s.id, s.name]));
	}

	const assigneeMap = new Map();

	if (settings.assigneeEnabled) {
		// Fetch all users via direct API call (efficient for teams) and create map for assignee lookups; only if enabled
		try {
			const response = await fetch('https://api.todoist.com/rest/v2/users', {
				headers: {
					'Authorization': `Bearer ${settings.authToken}`,
					'Content-Type': 'application/json',
				},
			});
			if (response.ok) {
				const allUsers: User[] = await response.json();
				allUsers.forEach(user => {
					assigneeMap.set(user.id, user.name || 'Unknown Assignee');
				});
			} else {
				console.error('Failed to fetch users from Todoist API');
			}
		} catch (error) {
			console.error('Error fetching users:', error);
		}
	}

	if (tasks.length === 0){
		new Notice(`Todoist text: You have no tasks matching filter "${todoistQuery}"`);
	}

	let returnString = "";
	if (settings.showSubtasks) {
		// work through all the parent tasks
		let parentTasks = tasks.filter(task => task.parentId == null);
		parentTasks.forEach(task => {
			returnString = returnString.concat(getFormattedTaskDetail(task, 0, false, projectMap, sectionMap, assigneeMap, settings));
			returnString = returnString.concat(getSubTasks(tasks, task.id, 1, projectMap, sectionMap, assigneeMap, settings));
		})

		// determine subtasks that have a parent that wasn't returned in the query
		let subtasks = tasks.filter(task => task.parentId != null);
		const parentIds = parentTasks.map(p => p.id);
		const orphans = subtasks.filter(st => st.parentId && !parentIds.includes(st.parentId));

		// show the orphaned subtasks with a subtask indicator
		orphans.forEach(task => {
			returnString = returnString.concat(getFormattedTaskDetail(task, 0, true, projectMap, sectionMap, assigneeMap, settings));
			returnString = returnString.concat(getSubTasks(tasks, task.id, 1, projectMap, sectionMap, assigneeMap, settings));
		})

	} else {
		tasks.forEach(t => {
			// show the tasks, include a subtask indicator (since subtask display is disabled)
			returnString = returnString.concat(getFormattedTaskDetail(t, 0, true, projectMap, sectionMap, assigneeMap, settings));
		})
	}

	return returnString;
}

async function callTasksApi(api: TodoistApi, filter: string): Promise<Task[]> {
	let tasks: Task[];
	try {
		tasks = await api.getTasks({filter: filter});
	} catch (e) {
		let errorMsg : string;
		switch (e.httpStatusCode) {
			case undefined:
				errorMsg = `Todoist text: There was a problem pulling data from Todoist. Is your internet connection working?`
				break;
			case 403:
				errorMsg ="Todoist text: Authentication with todoist server failed. Check that" +
					" your API token is set correctly in the settings.";
				break;
			default:
				`Todoist text: There was a problem pulling data from Todoist. ${e.responseData}`;
		}
		console.log(errorMsg, e);
		new Notice(errorMsg);
		throw(e)
	}
	return tasks;
}

function getSubTasks(subtasks: Task[], parentId: string, indent: number, projectMap: Map<string, string>, sectionMap: Map<string, string>, assigneeMap: Map<string, string>, settings: TodoistSettings): string {
	let returnString = "";
	let filtered = subtasks.filter(sub => sub.parentId == parentId);
	filtered.forEach(st => {
		returnString = returnString.concat(getFormattedTaskDetail(st, indent, false, projectMap, sectionMap, assigneeMap, settings));
		returnString = returnString.concat(getSubTasks(subtasks, st.id ,indent+1, projectMap, sectionMap, assigneeMap, settings))
	})
	return returnString;
}

function getFormattedTaskDetail(task: Task, indent: number, showSubtaskSymbol: boolean, projectMap: Map<string, string>, sectionMap: Map<string, string>, assigneeMap: Map<string, string>, settings: TodoistSettings): string {
	let description = getTaskDescription(task.description, indent);
	let tabs = "\t".repeat(indent);

	// used to fix the difference between the app and API (https://github.com/Doist/todoist-python/issues/18)
	const priorityMap = new Map<number, number>([
		[1, 4],
		[2, 3],
		[3, 2],
		[4, 1]
	])

	const subtaskIndicator = (showSubtaskSymbol && task.parentId != null) ? "⮑ " : "";

	let fields: string[] = [];
	// Build array of optional fields (project, section, labels, due, assignee, etc.) based on settings and task data

	// Add project field if enabled and task has projectId
	if (settings.projectEnabled && task.projectId) {
		const projectName = projectMap.get(task.projectId) || '(Unknown Project)';
		fields.push(`${settings.projectPrefix}${projectName}${settings.projectSuffix}`);
	}

	// Add section field if enabled and task has sectionId
	if (settings.sectionEnabled && task.sectionId) {
		const sectionName = sectionMap.get(task.sectionId) || '(Unknown Section)';
		fields.push(`${settings.sectionPrefix}${sectionName}${settings.sectionSuffix}`);
	}

	if (settings.labelsEnabled && task.labels && task.labels.length > 0) {
		const labelsStr = task.labels.join(', ');
		fields.push(`${settings.labelsPrefix}${labelsStr}${settings.labelsSuffix}`);
	}

	if (settings.dueEnabled && task.due && task.due.string) {
		const dueStr = task.due.string;
		fields.push(`${settings.duePrefix}${dueStr}${settings.dueSuffix}`);
	}

	// Add assignee field if enabled and task has assigneeId (Pro/Business feature)
	if (settings.assigneeEnabled && task.assigneeId) {
		const assigneeName = assigneeMap.get(task.assigneeId) || 'Unknown Assignee';
		fields.push(`${settings.assigneePrefix}${assigneeName}${settings.assigneeSuffix}`);
	}

	// Add comments count field if enabled and task has comments
	if (settings.commentsEnabled && task.commentCount > 0) {
		fields.push(`${settings.commentsPrefix}${task.commentCount}${settings.commentsSuffix}`);
	}

	// Add order field if enabled (always show if set)
	if (settings.orderEnabled) {
		fields.push(`${settings.orderPrefix}${task.order}${settings.orderSuffix}`);
	}

	// Add creation date field if enabled (uses task.createdAt)
	if (settings.addedAtEnabled) {
		fields.push(`${settings.addedAtPrefix}${task.createdAt}${settings.addedAtSuffix}`);
	}

	// Add due date field if enabled and task has due.date (ISO format)
	if (settings.dueDateEnabled && task.due?.date) {
		fields.push(`${settings.dueDatePrefix}${task.due.date}${settings.dueDateSuffix}`);
	}

	// Add recurring flag if enabled and task due is recurring
	if (settings.dueRecurringEnabled && task.due?.isRecurring) {
		fields.push(`${settings.dueRecurringPrefix}recurring${settings.dueRecurringSuffix}`);
	}

	const fieldsStr = fields.length > 0 ? ` -- ${fields.join(' -- ')} -- ` : ' -- ';

	return `${tabs}- [ ] ${subtaskIndicator}${task.content}${fieldsStr}p${priorityMap.get(task.priority)} -- [src](${task.url}) ${description}\n`;
}

function getTaskDescription(description: string, indent: number): string {
	let tabs = "\t".repeat(indent);
	return description.length === 0 ? "" : `\n${tabs}\t- ${description.trim().replace(/(?:\r\n|\r|\n)+/g, '\n\t- ')}`;
}