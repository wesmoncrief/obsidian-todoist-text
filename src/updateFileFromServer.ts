import {Task, TodoistApi} from '@doist/todoist-api-typescript'
import {Vault, App, TAbstractFile, Editor, Notice} from 'obsidian'
import {TodoistSettings} from "../main";


export async function updateFileFromServer(settings: TodoistSettings, app: App){
	await new Promise(r => setTimeout(r, 2000));
	// @ts-ignore
	const openFileName = app.workspace.activeLeaf.view.file.path
	if (settings.excludedDirectories.some(ed => openFileName.contains(ed))){
		console.log("NOT LOOKING AT FILE BC OF EXCLUDED DIRECTORIES");
		return;
	}

	const fileContents = await app.vault.adapter.read(openFileName)
	if (fileContents.contains(settings.templateString)){
		if (settings.authToken.contains("TODO - ")){
			new Notice("You need to configure your Todoist API token in the Todoist text plugin settings");
			return;
		}
		const formattedTodos = await getServerData(settings)
		const newData = fileContents.replace(settings.templateString, formattedTodos);
		await app.vault.adapter.write(openFileName, newData)
	}
}

export async function toggleServerTaskStatus(e: Editor, settings: TodoistSettings){
	console.log("UPDATINg SERVER DATA")
	const lineText = e.getLine(e.getCursor().line);
	console.log(lineText);
	if (!lineText.contains("[src](https://todoist.com/showTask?id=")){
		console.log("not a todoist task here");
	}
	const api = new TodoistApi(settings.authToken)

	const tryingToClose = lineText.contains("- [ ]");
	const tryingToOpen = lineText.contains("- [x]");
	if ((tryingToClose && tryingToOpen) || (!tryingToClose && !tryingToOpen)){
		console.log("todoist err")
		return;
	}
	let taskId: number;
	try {
		taskId = parseInt(lineText.split("https://todoist.com/showTask?id=")[1].split(")")[0]);
	} catch (e) {
		console.log(e)
		return;
	}
	const serverTaskName = (await api.getTask(taskId)).content;
	console.log(taskId);
	if (tryingToClose){
		await api.closeTask(taskId);
		new Notice(`Closed "${serverTaskName}" on Todoist`);
	}
	if (tryingToOpen){
		await api.reopenTask(taskId);
		new Notice(`Re-opened "${serverTaskName}" on Todoist`);
	}
}


async function getServerData(settings: TodoistSettings) : Promise<string> {
	console.log("GETTING SERVER DATA")
	const api = new TodoistApi(settings.authToken)
	let tasks: Task[];
	try {
		tasks = await api.getTasks({filter: settings.todoistQuery});
	}
	catch (e){
		const errorMsg = `Todoist text: There was a problem pulling data from Todoist. ${e.responseData}`
		console.log(errorMsg, e)
		new Notice(errorMsg)
	}
	// const tasksByPriority = tasks.sort((a, b) => a.priority > b.priority);
	console.log(tasks)
	const formattedTasks = tasks.map(t => `- [ ] ${t.content} -- p${t.priority} -- [src](${t.url})`);
	return formattedTasks.join("\n");
}

