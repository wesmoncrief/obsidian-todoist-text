import {migrateSettings} from "./settingsMigrator";
import {DEFAULT_SETTINGS} from "./DefaultSettings";

test('v0 to v1 migration', () => {
	const v0Settings = {
		excludedDirectories: ["old_exc_dir"],
		templateString: "old_custom_template",
		authToken: "old_auth_token",
		todoistQuery: "old_todoist_query",
		enableAutomaticReplacement: false
	}
	const latestSettings = {
		"authToken": "old_auth_token",
		"enableAutomaticReplacement": false,
		"excludedDirectories": [
			"old_exc_dir"
		],
		"keywordToTodoistQuery": {
			"oldTemplateString": "old_todoist_query"
		},
		"settingsVersion": 1
	}
	expect(migrateSettings(v0Settings)).toStrictEqual(latestSettings);
});

test('v1 default to v1 migration', () => {
	expect(migrateSettings(DEFAULT_SETTINGS)).toStrictEqual(DEFAULT_SETTINGS)
})
