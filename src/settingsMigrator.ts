import {TodoistSettings, keywordTodoistQuery} from "./DefaultSettings";

export function migrateSettings(settings: any) : TodoistSettings {
	let newSettings : any = settings;

	if (getSettingsVersion(newSettings) == 0) {
		newSettings = migrateToV1(newSettings as TodoistSettingV0);
	}

	if (getSettingsVersion(newSettings) == 1) {
		newSettings = migrateToV2(newSettings as TodoistSettingV1);
	}

	if (getSettingsVersion(newSettings) == 2) {
		newSettings = migrateToV3(newSettings as TodoistSettingV2);
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

function migrateToV2(settings: TodoistSettingV1) : TodoistSettingV2 {
	return {
		authToken: settings.authToken,
		enableAutomaticReplacement: settings.enableAutomaticReplacement,
		excludedDirectories: settings.excludedDirectories,
		keywordToTodoistQuery: settings.keywordToTodoistQuery,
		showSubtasks: true,
		settingsVersion: 2
	};
}

function migrateToV3(settings: TodoistSettingV2) : TodoistSettings {
	return {
		authToken: settings.authToken,
		enableAutomaticReplacement: settings.enableAutomaticReplacement,
		excludedDirectories: settings.excludedDirectories,
		keywordToTodoistQuery: settings.keywordToTodoistQuery,
		showSubtasks: true,
		noDateSubtasks: true,
		todaysSubtasks: false,
		showPriority: true,
		showLink: true,
		showDescription: true,
		settingsVersion: 3
	};
}

interface TodoistSettingV0 {
	enableAutomaticReplacement: boolean,
	excludedDirectories: string[],
	templateString: string,
	authToken: string,
	todoistQuery: string,
	settingsVersion: number
}

interface TodoistSettingV1 {
	enableAutomaticReplacement: boolean,
	excludedDirectories: string[],
	templateString: string,
	authToken: string,
	keywordToTodoistQuery: keywordTodoistQuery[],
	settingsVersion: number
}

interface TodoistSettingV2 {
	enableAutomaticReplacement: boolean,
	excludedDirectories: string[],
	authToken: string,
	keywordToTodoistQuery: keywordTodoistQuery[],
	settingsVersion: number,
	showSubtasks: boolean
}
