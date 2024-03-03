import {Task, TodoistApi} from '@doist/todoist-api-typescript';
import {App, Editor, Notice, } from 'obsidian';
import {TodoistSettings} from "./DefaultSettings";


export async function updateFileFromServer(settings: TodoistSettings, app: App) {
	const file = app.workspace.getActiveFile();
	// if length too short, probably didn't set the settings and just left the placeholder empty string
	if (settings.excludedDirectories.filter(ed => ed.length > 1).some(ed => file.path.contains(ed))) {
		console.log("todoist text: not looking at file bc of excluded directories");
		return;
	}
	let fileContents = await app.vault.read(file);
	for (const keywordToQuery of settings.keywordToTodoistQuery) {
		// if length too short, probably didn't set the settings and just left the placeholder empty string
		// If you wanted to pull all tasks, you can always use `view all` filter definition.
		if (keywordToQuery.keyword.length > 1 && keywordToQuery.todoistQuery.length > 1 && fileContents.contains(keywordToQuery.keyword)) {
			if (settings.authToken.contains("TODO - ")) {
				new Notice("Todoist Text: You need to configure your Todoist API token in the Todoist Text plugin settings");
				throw ("Todoist text: missing auth token.");
			}
			console.log("Todoist Text: Updating keyword with todos. If this happened automatically and you did not intend for this " +
				"to happen, you should either disable automatic replacement of your keyword with todos (via the settings), or" +
				" exclude this file from auto replace (via the settings).");
			const formattedTodos = await getServerData(keywordToQuery.todoistQuery, settings.authToken, settings.showSubtasks, settings.showPriority, settings.showLink);

			// re-read file contents to reduce race condition after slow server call
			fileContents = await app.vault.read(file);
			const newData = fileContents.replace(keywordToQuery.keyword, formattedTodos);
			await app.vault.modify(file, newData);
		}
	}
}

export async function toggleServerTaskStatus(e: Editor, settings: TodoistSettings) {
	try {
		const lineText = e.getLine(e.getCursor().line);
		// The line must start with only whitespace, then have a dash. A currently checked off box
		// can have any non-whitespace character. This matches the behavior of Obsidian's
		// editor:toggle-checklist-status command.
		const tryingToCloseRegex = /^\s*- \[\s]/;
		const tryingToReOpenRegex = /^\s*- \[\S]/;
		const tryingToClose = tryingToCloseRegex.test(lineText);
		const tryingToReOpen = tryingToReOpenRegex.test(lineText);

		if (!(lineText.contains("[src](https://todoist.com/showTask?id=")) && (tryingToClose || tryingToReOpen)) {
			return;
		}

		let taskId: string;
		try {
			taskId = lineText.split("https://todoist.com/showTask?id=")[1].split(")")[0];
		} catch (e) {
			console.log(e);
			return;
		}

		const api = new TodoistApi(settings.authToken);
		const serverTaskName = (await api.getTask(taskId)).content;
		if (tryingToClose) {
			await api.closeTask(taskId);
			const actionedTaskTabCount = lineText.split(/[^\t]/)[0].length;

			// check if there are any subtasks and mark them closed
			let subtasksClosed = 0;
			for (let line = e.getCursor().line + 1; line < e.lineCount(); line++) {
				const lineText = e.getLine(line);
				const tabCount = lineText.split(/[^\t]/)[0].length;
				if (tabCount==0)
					break;
				if (tabCount > actionedTaskTabCount) {
					const replacedText = lineText.replace("- [ ]", "- [x]");
					if (replacedText != lineText) { 
						subtasksClosed++;
					}
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
					if (replacedText != lineText) { 
						parentTasksOpened++;
					}
					e.setLine(line, replacedText);
				}

				if (tabCount==0 && parentTasksOpened > 0) 
				break; // found the topmost task
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
		new Notice("Todoist Text: Error trying to update task status. See console log for more details.");
	}
}

async function getServerData(todoistQuery: string, authToken: string, showSubtasks: boolean, showPriority: boolean, showLink: boolean): Promise<string> {
	const api = new TodoistApi(authToken);
	const tasks = await callTasksApi(api, todoistQuery);

	if (tasks.length === 0){
		new Notice(`Todoist text: You have no tasks matching filter "${todoistQuery}"`);
	}
	
	let returnString = "";
	if (showSubtasks) {
		const allSubtasks = await callTasksApi(api, "subtask"); //pull query of all subtasks

		// work through all the top-level parent tasks
		const parentTasks = tasks.filter(task => task.parentId == null);
		const subtasks = tasks.filter(task => task.parentId != null); // only pulls subtasks from the filtered list

		let parentIds = "";
		parentTasks.forEach(parentTask => {
			parentIds = parentIds.concat(parentTask.id);
			returnString = returnString.concat(getFormattedTaskDetail(parentTask, 0, false, showPriority, showLink));
			returnString = returnString.concat(getSubTasks(allSubtasks, parentTask.id, 1, showPriority, showLink));
		});

		// determine subtasks that have a parent that wasn't returned in the query **
		const orphans = subtasks.filter(task => !parentIds.includes(task.parentId));

		// show the orphaned subtasks with a subtask indicator
		orphans.forEach(orphan => {
			returnString = returnString.concat(getFormattedTaskDetail(orphan, 0, true, showPriority, showLink));
			returnString = returnString.concat(getSubTasks(allSubtasks, orphan.id, 1, showPriority, showLink));
		});
	} else {
		tasks.forEach(t => {
			// show the tasks, inlcude a subtask indicator (since subtask display is disabled)
			returnString = returnString.concat(getFormattedTaskDetail(t, 0, true, showPriority, showLink));
		});
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
				errorMsg = `Todoist text: There was a problem pulling data from Todoist. Is your internet connection working?`;
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

function getSubTasks(allSubtasks: Task[], parentId: string, indent: number, showPriority: boolean, showLink: boolean): string {
	let returnString = "";
	const filtered = allSubtasks.filter(sub => sub.parentId == parentId);
	filtered.forEach(subt => {
		returnString = returnString.concat(getFormattedTaskDetail(subt, indent, false, showPriority, showLink));
		returnString = returnString.concat(getSubTasks(allSubtasks, subt.id, indent + 1, showPriority, showLink));
	});
	return returnString;
}

function getFormattedTaskDetail(task: Task, indent: number, showSubtaskSymbol: boolean, showPriority: boolean, showLink: boolean): string {	
	const description = getTaskDescription(task.description, indent);
	const tabs = "\t".repeat(indent);

	// used to fix the difference between the app and API (https://github.com/Doist/todoist-python/issues/18)
	const priorityMap = new Map<number, number>([
		[1, 4],
		[2, 3],
		[3, 2],
		[4, 1]
	]);
	const subtaskIndicator = (showSubtaskSymbol && task.parentId != null) ? "⮑ " : "";
	let formatString = `${tabs}- [ ] ${subtaskIndicator}${task.content} - task ${task.id}`; 
	// include priority and link here optionally
	if (showPriority) {
		formatString = formatString.concat(`-- p${priorityMap.get(task.priority)} `);
	}
	if (showLink) {
		formatString = formatString.concat(`-- [src](${task.url}) `);
	}
	formatString = formatString.concat(`${description}\n`);
	return formatString;	
} 

function getTaskDescription(description: string, indent: number): string {
	const tabs = "\t".repeat(indent);
	return description.length === 0 ? "" : `\n${tabs}\t- ${description.trim().replace(/(?:\r\n|\r|\n)+/g, '\n\t- ')}`;
}
