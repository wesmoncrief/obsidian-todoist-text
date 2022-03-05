// If you ever update these, be sure to update the settings migration too!
export interface TodoistSettings {
	settingsVersion: number;
	excludedDirectories: string[];
	// can't use a dictionary/object because it doesn't have first-class support
	// for indexing, which is needed for settings manipulation/persistence
	keywordToTodoistQuery: keywordTodoistQuery[];
	authToken: string;
	enableAutomaticReplacement: boolean;
}

export interface keywordTodoistQuery {
	keyword: string;
	todoistQuery: string;
}

export const DEFAULT_SETTINGS: TodoistSettings = {
	settingsVersion: 1,
	excludedDirectories: [],
	keywordToTodoistQuery: [{keyword: "@@TODOIST@@", todoistQuery: "today|overdue"}],
	authToken: "TODO - get your auth token",
	enableAutomaticReplacement: true
}
