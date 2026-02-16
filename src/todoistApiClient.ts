import {requestUrl} from 'obsidian'

const TODOIST_API_BASE_URL = "https://api.todoist.com/api/v1/";
const TODOIST_TASK_LINK_BASE_URL = "https://app.todoist.com/app/task/";
const MAX_FILTER_PAGES = 50;

type TodoistHttpMethod = "GET" | "POST";

export interface TodoistTask {
	id: string;
	content: string;
	description: string;
	priority: number;
	parentId: string | null;
	url: string;
}

export interface TodoistRequestError extends Error {
	httpStatusCode?: number;
	responseData?: unknown;
}

type TodoistObject = Record<string, unknown>;

function isTodoistObject(value: unknown): value is TodoistObject {
	return typeof value === "object" && value !== null;
}

function getTodoistRequestStatus(error: unknown): number | undefined {
	if (!isTodoistObject(error)) {
		return undefined;
	}

	if (typeof error.status === "number") {
		return error.status;
	}

	if (isTodoistObject(error.response) && typeof error.response.status === "number") {
		return error.response.status;
	}

	return undefined;
}

function getTodoistRequestData(error: unknown): unknown {
	if (!isTodoistObject(error)) {
		return undefined;
	}

	if (error.json !== undefined) {
		return error.json;
	}
	if (error.text !== undefined) {
		return error.text;
	}

	if (!isTodoistObject(error.response)) {
		return undefined;
	}
	if (error.response.data !== undefined) {
		return error.response.data;
	}
	if (error.response.json !== undefined) {
		return error.response.json;
	}

	return undefined;
}

export function toTodoistRequestError(error: unknown): TodoistRequestError {
	if (error instanceof Error) {
		const existingError = error as TodoistRequestError;
		if (existingError.httpStatusCode !== undefined || existingError.responseData !== undefined) {
			return existingError;
		}
	}

	const status = getTodoistRequestStatus(error);
	const requestError = new Error(
		error instanceof Error ? error.message : `Request failed${status !== undefined ? `, status ${status}` : ""}`
	) as TodoistRequestError;
	requestError.httpStatusCode = status;
	requestError.responseData = getTodoistRequestData(error);
	return requestError;
}

function buildTodoistUrl(path: string, queryParams?: Record<string, string>): string {
	const url = new URL(path, TODOIST_API_BASE_URL);
	if (queryParams) {
		Object.keys(queryParams).forEach((key) => {
			const value = queryParams[key];
			if (value !== undefined && value !== null && String(value).length > 0) {
				url.searchParams.append(key, String(value));
			}
		});
	}
	return url.toString();
}

async function todoistRequest(
	authToken: string,
	method: TodoistHttpMethod,
	path: string,
	queryParams?: Record<string, string>,
	body?: unknown
): Promise<{ status: number; data: unknown }> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${authToken}`
	};
	const requestOptions: {
		method: TodoistHttpMethod;
		url: string;
		headers: Record<string, string>;
		body?: string;
	} = {
		method,
		url: buildTodoistUrl(path, queryParams),
		headers
	};

	if (body !== undefined) {
		headers["Content-Type"] = "application/json";
		requestOptions.body = JSON.stringify(body);
	}

	try {
		const response = await requestUrl(requestOptions);
		let responseData: unknown;
		try {
			responseData = response.json;
		} catch {
			responseData = undefined;
		}
		if (responseData === undefined) {
			responseData = response.text;
		}
		return { status: response.status, data: responseData };
	} catch (error: unknown) {
		throw toTodoistRequestError(error);
	}
}

function normalizeTodoistTask(taskValue: unknown): TodoistTask | null {
	if (!isTodoistObject(taskValue) || taskValue.id === undefined) {
		return null;
	}

	const id = String(taskValue.id);
	if (id.length === 0) {
		return null;
	}

	const parentIdValue = taskValue.parentId !== undefined ? taskValue.parentId : taskValue.parent_id;
	const parentId = parentIdValue === null || parentIdValue === undefined || String(parentIdValue).length === 0
		? null
		: String(parentIdValue);
	const priority = typeof taskValue.priority === "number" ? taskValue.priority : 1;
	const taskUrl = typeof taskValue.url === "string" && taskValue.url.length > 0
		? taskValue.url
		: `${TODOIST_TASK_LINK_BASE_URL}${id}`;

	return {
		id,
		content: typeof taskValue.content === "string" ? taskValue.content : "",
		description: typeof taskValue.description === "string" ? taskValue.description : "",
		priority,
		parentId,
		url: taskUrl
	};
}

function getTodoistTaskItems(responseData: unknown): unknown[] {
	if (Array.isArray(responseData)) {
		return responseData;
	}
	if (!isTodoistObject(responseData)) {
		return [];
	}
	if (Array.isArray(responseData.results)) {
		return responseData.results;
	}
	if (Array.isArray(responseData.items)) {
		return responseData.items;
	}
	return [];
}

function getNextCursor(responseData: unknown): string | undefined {
	if (!isTodoistObject(responseData)) {
		return undefined;
	}
	const nextCursor = typeof responseData.nextCursor === "string"
		? responseData.nextCursor
		: typeof responseData.next_cursor === "string"
			? responseData.next_cursor
			: undefined;
	return nextCursor && nextCursor.length > 0 ? nextCursor : undefined;
}

export async function getTodoistTasks(authToken: string, filter: string): Promise<TodoistTask[]> {
	let tasks: TodoistTask[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < MAX_FILTER_PAGES; page++) {
		const queryParams: Record<string, string> = { query: filter };
		if (cursor) {
			queryParams.cursor = cursor;
		}
		const response = await todoistRequest(authToken, "GET", "tasks/filter", queryParams);
		const pageTasks = getTodoistTaskItems(response.data)
			.map((task) => normalizeTodoistTask(task))
			.filter((task): task is TodoistTask => task !== null);
		tasks = tasks.concat(pageTasks);
		cursor = getNextCursor(response.data);
		if (!cursor) {
			break;
		}
	}
	return tasks;
}

export async function getTodoistTask(authToken: string, taskId: string): Promise<TodoistTask> {
	const response = await todoistRequest(authToken, "GET", `tasks/${taskId}`);
	const task = normalizeTodoistTask(response.data);
	if (task === null) {
		throw toTodoistRequestError(new Error("Unable to parse Todoist task data."));
	}
	return task;
}

export async function closeTodoistTask(authToken: string, taskId: string) {
	await todoistRequest(authToken, "POST", `tasks/${taskId}/close`);
}

export async function reopenTodoistTask(authToken: string, taskId: string) {
	await todoistRequest(authToken, "POST", `tasks/${taskId}/reopen`);
}

export function extractTaskIdFromLine(lineText: string): string | null {
	const match = lineText.match(
		/todoist\.com\/(?:showTask\?id=|app\/task\/)([A-Za-z0-9_-]+)/
	);
	return match ? match[1] : null;
}
