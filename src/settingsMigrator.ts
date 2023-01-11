import {TodoistSettings, keywordTodoistQuery} from "./DefaultSettings";

export function migrateSettings(settings: any) : TodoistSettings {
	let newSettings : any = settings;

	if (getSettingsVersion(newSettings) == 0) {
		newSettings = migrateToV1(newSettings as TodoistSettingV0)
	}

	if (getSettingsVersion(newSettings) == 1) {
		newSettings = migrateToV2(newSettings)
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
