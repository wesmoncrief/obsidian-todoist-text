import {Task, TodoistApi} from '@doist/todoist-api-typescript'
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
			const formattedTodos = await getServerData(keywordToQuery.todoistQuery, settings.authToken);

			// re-read file contents to reduce race condition after slow server call
			fileContents = await app.vault.read(file)
			const newData = fileContents.replace(keywordToQuery.keyword, formattedTodos);
			await app.vault.modify(file, newData)
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
		const tryingToClose = tryingToCloseRegex.test(lineText)
		const tryingToReOpen = tryingToReOpenRegex.test(lineText)

		if (!(lineText.contains("[src](https://todoist.com/showTask?id=")) && (tryingToClose || tryingToReOpen)) {
			return;
		}

		let taskId: string;
		try {
			taskId = lineText.split("https://todoist.com/showTask?id=")[1].split(")")[0];
		} catch (e) {
			console.log(e)
			return;
		}

		const api = new TodoistApi(settings.authToken)
		const serverTaskName = (await api.getTask(taskId)).content;
		if (tryingToClose) {
			await api.closeTask(taskId);
			new Notice(`Todoist Text: Closed "${serverTaskName}" on Todoist`);
		}
		if (tryingToReOpen) {
			await api.reopenTask(taskId);
			new Notice(`Todoist Text: Re-opened "${serverTaskName}" on Todoist`);
		}
	}
	catch (e){
		console.log("todoist text error: ", e);
		new Notice("Todoist Text: Error trying to update task status. See console log for more details.")
	}
}


async function getServerData(todoistQuery: string, authToken: string): Promise<string> {
	const api = new TodoistApi(authToken)
	let tasks: Task[];
	try {
		tasks = await api.getTasks({filter: todoistQuery});
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
	if (tasks.length === 0){
		new Notice(`Todoist text: You have no tasks matching filter "${todoistQuery}"`);
	}
	const formattedTasks = tasks.map(t => {
		const description = t.description.length === 0 ? "" :
`\n\t- ${t.description.trim().replace(/(?:\r\n|\r|\n)+/g, '\n\t- ')}`;
		return `- [ ] ${t.content} -- p${t.priority} -- [src](${t.url}) ${description}`
	})
	return formattedTasks.join("\n");
}

