import {Task, TodoistApi} from '@doist/todoist-api-typescript'
import {App, Editor, Notice, TFile} from 'obsidian'
import {TodoistSettings} from "../main";


export async function updateFileFromServer(settings: TodoistSettings, app: App) {
	await new Promise(r => setTimeout(r, 2000));

	const openFile = app.workspace.getActiveFile();
	if (settings.excludedDirectories.some(ed => openFile.path.contains(ed))) {
		console.log("todoist text: not looking at file bc of excluded directories");
		return;
	}

	const abstractFile = await app.vault.getAbstractFileByPath(openFile.path)
	if (!(abstractFile instanceof TFile)) {
		return;
	}
	const file = abstractFile as TFile;
	const fileContents = await app.vault.read(file)
	if (fileContents.contains(settings.templateString)) {
		if (settings.authToken.contains("TODO - ")) {
			new Notice("Todoist Text: You need to configure your Todoist API token in the Todoist Text plugin settings");
			return;
		}
		const formattedTodos = await getServerData(settings)
		const newData = fileContents.replace(settings.templateString, formattedTodos);
		await app.vault.modify(file, newData)
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

		if (!(lineText.contains("[src](https://todoist.com/showTask?id=") && tryingToClose || tryingToReOpen)) {
			return;
		}

		let taskId: number;
		try {
			taskId = parseInt(lineText.split("https://todoist.com/showTask?id=")[1].split(")")[0]);
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


async function getServerData(settings: TodoistSettings): Promise<string> {
	const api = new TodoistApi(settings.authToken)
	let tasks: Task[];
	try {
		tasks = await api.getTasks({filter: settings.todoistQuery});
	} catch (e) {
		const errorMsg = `Todoist text: There was a problem pulling data from Todoist. ${e.responseData}`
		console.log(errorMsg, e)
		new Notice(errorMsg)
	}
	const formattedTasks = tasks.map(t => `- [ ] ${t.content} -- p${t.priority} -- [src](${t.url})`);
	return formattedTasks.join("\n");
}

