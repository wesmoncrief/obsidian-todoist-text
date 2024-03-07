import {migrateSettings} from "./settingsMigrator";
import {DEFAULT_SETTINGS, TodoistSettings} from "./DefaultSettings";

test('v0 to v3 migration', () => {
	const v0Settings = {
		excludedDirectories: ["old_exc_dir"],
		templateString: "old_custom_template",
		authToken: "old_auth_token",
		todoistQuery: "old_todoist_query",
		enableAutomaticReplacement: false
	};
	const expected = {
		authToken: "old_auth_token",
		"enableAutomaticReplacement": false,
		"excludedDirectories": [
			"old_exc_dir"
		],
		"keywordToTodoistQuery": [
			{"keyword": "old_custom_template", "todoistQuery": "old_todoist_query"},
		],
		"settingsVersion": 3,
		"showSubtasks": true,
		"noDateSubtasks": true,
		"todaysSubtasks": false,
		"showPriority": true,
		"showLink": true,
		"showDescription": true
	};
	expect(migrateSettings(v0Settings)).toStrictEqual(expected);
});

test('v1 to v3 migration', () => {
	const v0Settings = {
		excludedDirectories: ["old_exc_dir"],
		templateString: "old_custom_template",
		authToken: "old_auth_token",
		todoistQuery: "old_todoist_query",
		enableAutomaticReplacement: false,
	};
	const expected = {
		authToken: "old_auth_token",
		enableAutomaticReplacement: false,
		excludedDirectories: [
			"old_exc_dir"
		],
		keywordToTodoistQuery: [
			{"keyword": "old_custom_template", "todoistQuery": "old_todoist_query"},
		],
		settingsVersion: 3,
		showSubtasks: true,
		noDateSubtasks: true,
		todaysSubtasks: false,
		showPriority: true,
		showLink: true,
		showDescription: true
	};
	expect(migrateSettings(v0Settings)).toStrictEqual(expected);
});

test('v2 to v3 migration', () => {
	const v0Settings = {
		excludedDirectories: ["old_exc_dir"],
		templateString: "old_custom_template",
		authToken: "old_auth_token",
		todoistQuery: "old_todoist_query",
		enableAutomaticReplacement: false,
	};
	const expected = {
		authToken: "old_auth_token",
		enableAutomaticReplacement: false,
		excludedDirectories: [
			"old_exc_dir"
		],
		keywordToTodoistQuery: [
			{ "keyword": "old_custom_template", "todoistQuery": "old_todoist_query" },
		],
		settingsVersion: 3,
		showSubtasks: true,
		noDateSubtasks: true,
		todaysSubtasks: false,
		showPriority: true,
		showLink: true,
		showDescription: true
	};
	expect(migrateSettings(v0Settings)).toStrictEqual(expected);
});

test('v1 default to v1 migration', () => {
	expect(migrateSettings(DEFAULT_SETTINGS)).toStrictEqual(DEFAULT_SETTINGS);
});

test('v2 custom to v3 migration', () => {
	const v2alreadySetSettings: TodoistSettings = {
		authToken: "some_auth_token",
		enableAutomaticReplacement: false,
		excludedDirectories: ["some_exc_dir"],
		keywordToTodoistQuery: [{keyword: "key_a", todoistQuery: "query_a"}, {keyword: "key_b", todoistQuery: "query_b"}],
		settingsVersion: 3,
		showSubtasks: false,
		noDateSubtasks: true,
		todaysSubtasks: false,
		showPriority: true,
		showLink: true,
		showDescription: true
	};
	expect(migrateSettings(v2alreadySetSettings)).toStrictEqual(v2alreadySetSettings);
});

test('v3 custom to v3 migration', () => {
	const v3alreadySetSettings: TodoistSettings = {
		authToken: "some_auth_token",
		enableAutomaticReplacement: false,
		excludedDirectories: ["some_exc_dir"],
		keywordToTodoistQuery: [{ keyword: "key_a", todoistQuery: "query_a" }, { keyword: "key_b", todoistQuery: "query_b" }],
		settingsVersion: 3,
		showSubtasks: false,
		noDateSubtasks: true,
		todaysSubtasks: false,
		showPriority: true,
		showLink: true,
		showDescription: true
	};
	expect(migrateSettings(v3alreadySetSettings)).toStrictEqual(v3alreadySetSettings);
});

