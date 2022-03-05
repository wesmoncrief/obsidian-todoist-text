
// input is guaranteed to either be a valid older settings version, or the current default settings.
import {TodoistSettings} from "./DefaultSettings";

export function migrateSettings(settings: any) : TodoistSettings {
	let newSettings : any = settings;
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
		settingsVersion: 1
	};
}

interface TodoistSettingV0 {
	enableAutomaticReplacement: boolean;
	excludedDirectories: string[];
	templateString: string;
	authToken: string;
	todoistQuery: string;
}
