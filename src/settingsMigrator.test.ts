import {migrateSettings} from "./settingsMigrator";
import {DEFAULT_SETTINGS, TodoistSettings} from "./DefaultSettings";

test('v0 to v2 migration', () => {
	const v0Settings = {
		excludedDirectories: ["old_exc_dir"],
		templateString: "old_custom_template",
		authToken: "old_auth_token",
		todoistQuery: "old_todoist_query",
		enableAutomaticReplacement: false
	}
	const expected = {
		authToken: "old_auth_token",
		"enableAutomaticReplacement": false,
		"excludedDirectories": [
			"old_exc_dir"
		],
		"keywordToTodoistQuery": [
			{"keyword": "old_custom_template", "todoistQuery": "old_todoist_query"},
		],
		"showSubtasks": true,
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
		"settingsVersion": 3,
	}
	expect(migrateSettings(v0Settings)).toStrictEqual(expected);
});

test('v1 to v2 migration', () => {
	const v0Settings = {
		excludedDirectories: ["old_exc_dir"],
		templateString: "old_custom_template",
		authToken: "old_auth_token",
		todoistQuery: "old_todoist_query",
		enableAutomaticReplacement: false,
	}
	const expected = {
		authToken: "old_auth_token",
		enableAutomaticReplacement: false,
		excludedDirectories: [
			"old_exc_dir"
		],
		keywordToTodoistQuery: [
			{"keyword": "old_custom_template", "todoistQuery": "old_todoist_query"},
		],
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
		settingsVersion: 3,
	}
	expect(migrateSettings(v0Settings)).toStrictEqual(expected);
});

test('v1 default to v1 migration', () => {
	expect(migrateSettings(DEFAULT_SETTINGS)).toStrictEqual(DEFAULT_SETTINGS)
})

test('v2 custom to v2 migration', () => {
	const v1alreadySetSettings: any = {
		authToken: "some_auth_token",
		enableAutomaticReplacement: false,
		excludedDirectories: ["some_exc_dir"],
		keywordToTodoistQuery: [{keyword: "key_a", todoistQuery: "query_a"}, {keyword: "key_b", todoistQuery: "query_b"}],
		settingsVersion: 2,
		showSubtasks: false
	}
	const expectedV2 = {
		...v1alreadySetSettings,
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
		settingsVersion: 3
	};
	expect(migrateSettings(v1alreadySetSettings)).toStrictEqual(expectedV2)
})

