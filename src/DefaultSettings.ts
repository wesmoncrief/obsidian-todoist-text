export interface TodoistSettings {
	settingsVersion: number;
	excludedDirectories: string[];
	// can't use a dictionary/object because it doesn't have first-class support
	// for indexing, which is needed for settings manipulation/persistence
	keywordToTodoistQuery: keywordTodoistQuery[];
	authToken: string;
	enableAutomaticReplacement: boolean;
	showSubtasks: boolean;
	projectEnabled: boolean;
	projectPrefix: string;
	projectSuffix: string;
	sectionEnabled: boolean;
	sectionPrefix: string;
	sectionSuffix: string;
	labelsEnabled: boolean;
	labelsPrefix: string;
	labelsSuffix: string;
	dueEnabled: boolean;
	duePrefix: string;
	dueSuffix: string;
	assigneeEnabled: boolean;
	assigneePrefix: string;
	assigneeSuffix: string;
	commentsEnabled: boolean;
	commentsPrefix: string;
	commentsSuffix: string;
	orderEnabled: boolean;
	orderPrefix: string;
	orderSuffix: string;
	addedAtEnabled: boolean;
	addedAtPrefix: string;
	addedAtSuffix: string;
	updatedAtEnabled: boolean;
	updatedAtPrefix: string;
	updatedAtSuffix: string;
	dueDateEnabled: boolean;
	dueDatePrefix: string;
	dueDateSuffix: string;
	dueLangEnabled: boolean;
	dueLangPrefix: string;
	dueLangSuffix: string;
	dueRecurringEnabled: boolean;
	dueRecurringPrefix: string;
	dueRecurringSuffix: string;
	// never rely on adding a new default value. Any change should entail bumping the settingsVersion
	// and adding a settings migration
}

export interface keywordTodoistQuery {
	keyword: string;
	todoistQuery: string;
}

export const DEFAULT_SETTINGS: TodoistSettings = {
	settingsVersion: 4,
	excludedDirectories: [],
	keywordToTodoistQuery: [{keyword: "@@TODOIST@@", todoistQuery: "today|overdue"}],
	authToken: "TODO - get your auth token",
	enableAutomaticReplacement: true,
	showSubtasks: true,
		projectEnabled: true,
		projectPrefix: '[',
		projectSuffix: ']',
		sectionEnabled: false,
		sectionPrefix: '',
		sectionSuffix: '',
		labelsEnabled: false,
		labelsPrefix: '',
		labelsSuffix: '',
		dueEnabled: false,
		duePrefix: '',
		dueSuffix: '',
		assigneeEnabled: false,
		assigneePrefix: '',
		assigneeSuffix: '',
		commentsEnabled: false,
		commentsPrefix: '',
		commentsSuffix: '',
		orderEnabled: false,
		orderPrefix: '',
		orderSuffix: '',
		addedAtEnabled: false,
		addedAtPrefix: '',
		addedAtSuffix: '',
		updatedAtEnabled: false,
		updatedAtPrefix: '',
		updatedAtSuffix: '',
		dueDateEnabled: false,
		dueDatePrefix: '',
		dueDateSuffix: '',

		dueLangEnabled: false,

		dueLangPrefix: '',

		dueLangSuffix: '',
		dueRecurringEnabled: false,
		dueRecurringPrefix: '',
		dueRecurringSuffix: ''
}
