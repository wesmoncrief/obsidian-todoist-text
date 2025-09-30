import {TodoistSettings, keywordTodoistQuery} from "./DefaultSettings";

export function migrateSettings(settings: any) : TodoistSettings {
	let newSettings : any = settings;

	if (getSettingsVersion(newSettings) == 0) {
		newSettings = migrateToV1(newSettings as TodoistSettingV0)
	}

	if (getSettingsVersion(newSettings) == 1) {
		newSettings = migrateToV2(newSettings)
	}

	if (getSettingsVersion(newSettings) == 2) {
		newSettings = migrateToV3(newSettings);
	}

	if (getSettingsVersion(newSettings) == 3) {
		newSettings = migrateToV4(newSettings);
	}

	return newSettings;
}

function getSettingsVersion(settings: any) : number {
	// v0 didn't have this field
	return settings.settingsVersion ?? 0;
}

function migrateToV1(settings: TodoistSettingV0) : TodoistSettingV1 {
	return {
		authToken: settings.authToken,
		enableAutomaticReplacement: settings.enableAutomaticReplacement,
		templateString: settings.templateString,
		excludedDirectories: settings.excludedDirectories,
		keywordToTodoistQuery: [{keyword: settings.templateString, todoistQuery: settings.todoistQuery}],
		settingsVersion: 1
	};
}

function migrateToV2(settings: TodoistSettingV1) : TodoistSettings {
	return {
		authToken: settings.authToken,
		enableAutomaticReplacement: settings.enableAutomaticReplacement,
		excludedDirectories: settings.excludedDirectories,
		keywordToTodoistQuery: settings.keywordToTodoistQuery,
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
		dueRecurringSuffix: '',
		settingsVersion: 2
	};
}

interface TodoistSettingV0 {
	enableAutomaticReplacement: boolean;
	excludedDirectories: string[];
	templateString: string;
	authToken: string;
	todoistQuery: string;
	settingsVersion: number;
}

interface TodoistSettingV1 {
	enableAutomaticReplacement: boolean;
	excludedDirectories: string[];
	templateString: string;
	authToken: string;
	keywordToTodoistQuery: keywordTodoistQuery[];
	settingsVersion: number;
}

function migrateToV3(settings: any): TodoistSettings {
	return {
		...settings,
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
		dueDateEnabled: false,
		dueDatePrefix: '',
		dueDateSuffix: '',
		dueRecurringEnabled: false,
		dueRecurringPrefix: '',
		dueRecurringSuffix: '',
		settingsVersion: 3
	};
}

function migrateToV4(settings: any): TodoistSettings {
	return {
		...settings,
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
		dueRecurringSuffix: '',
		settingsVersion: 4
	};
}
