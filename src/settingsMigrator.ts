import {TodoistSettings, keywordTodoistQuery} from "./DefaultSettings";

export function migrateSettings(settings: any) : TodoistSettings {
	let newSettings : any = settings;

	if (getSettingsVersion(newSettings) == 1) {
		newSettings = migrateToV2(settings as TodoistSettingV1)
	}

	if (getSettingsVersion(newSettings) == 0) {
		newSettings = migrateToV1(settings as TodoistSettingV0)
	}

	return newSettings;
}

function getSettingsVersion(settings: any) : number {
	// v0 didn't have this field
	return settings.settingsVersion ?? 0;
}

function migrateToV1(settings: TodoistSettingV0) : TodoistSettings {
	return {
		authToken: settings.authToken,
		enableAutomaticReplacement: settings.enableAutomaticReplacement,
		excludedDirectories: settings.excludedDirectories,
		keywordToTodoistQuery: [{keyword: settings.templateString, todoistQuery: settings.todoistQuery}],
		showSubtasks: true,
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
}

interface TodoistSettingV1 {
	enableAutomaticReplacement: boolean;
	excludedDirectories: string[];
	templateString: string;
	authToken: string;
	keywordToTodoistQuery: keywordTodoistQuery[];
}