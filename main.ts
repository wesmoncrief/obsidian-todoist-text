import {App, ButtonComponent, Editor, MarkdownView, Plugin, PluginSettingTab, Setting, setIcon} from 'obsidian';
import {toggleServerTaskStatus, updateFileFromServer} from "./src/updateFileFromServer";
import {FolderSuggest} from "./src/suggest/folderSuggester";
import {migrateSettings} from "./src/settingsMigrator";
import {DEFAULT_SETTINGS, TodoistSettings} from "./src/DefaultSettings";

export default class TodoistPlugin extends Plugin {
	settings: TodoistSettings;
	hasIntervalFailure = false;
	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'toggle-todoist-task',
			name: 'Toggle todoist task',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				toggleServerTaskStatus(editor, this.settings);
				// @ts-ignore undocumented but was recommended to use here - https://github.com/obsidianmd/obsidian-releases/pull/768#issuecomment-1038441881
				view.app.commands.executeCommandById("editor:toggle-checklist-status")
			}
		});

		this.addCommand({
			id: 'todoist-task-pull',
			name: 'Replace keyword with todos',
			editorCallback: () => {
				updateFileFromServer(this.settings, this.app)
			}
		});


		if (this.settings.enableAutomaticReplacement) {
			this.registerEvent(this.app.workspace.on('file-open', async () => {
				if (this.hasIntervalFailure) {
					console.log("Todoist text: not checking for replacement keyword because of previous server " +
						"failure. Either use the manual keyword, or restart the app.")
					return;
				}
				try {
					await updateFileFromServer(this.settings, this.app)
				} catch {
					this.hasIntervalFailure = true;
				}
			}));
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TodoistPluginSettingTab(this.app, this));

		/* This is in addition to the on file-open callback. This helps with
				 1. manually adding the keyword to a new spot in a file
				 2. when you make a setting change, such as changing your keyword
			If this notices a keyword, it should wait at least 2 seconds before updating the text - this avoids a shocking
			user experience.
		 */
		// 5 sec sleep because we want to ensure the file-open event finishes before this loop starts
		await new Promise(r => setTimeout(r, 3000));
		this.registerInterval(window.setInterval(() => this.updateFileFromServerIfEnabled(), 4 * 1000))
	}


	async updateFileFromServerIfEnabled() {
		if (this.settings.enableAutomaticReplacement && !this.hasIntervalFailure) {
			await new Promise(r => setTimeout(r, 2000));
			try {
				await updateFileFromServer(this.settings, this.app)
			}
			catch {
				this.hasIntervalFailure = true;
			}
		}
	}

	onunload() {

	}

	async loadSettings() {
		const storedSettings = await this.loadData() ?? DEFAULT_SETTINGS;
		this.settings = migrateSettings(storedSettings);
		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TodoistPluginSettingTab extends PluginSettingTab {
	plugin: TodoistPlugin;

	constructor(app: App, plugin: TodoistPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h1', {text: 'Todoist Text'});
		const warning = containerEl.createEl("div");
		warning.addClasses(["todoist-setting-warning", "callout"]);
		const warningInner = warning.createEl("div");
		const icon = warningInner.createEl("span");
		setIcon(icon,"lucide-alert-triangle");
		icon.addClass("callout-icon");
		const warnLink = warningInner.createEl("a", null, (link) => {
				link.href = "https://github.com/wesmoncrief/obsidian-todoist-text/tree/master#usage";
				link.innerHTML = ("Important: See usage instructions");
			});
		warnLink.addClasses(["callout-title-inner", "callout-title-color", "warningLink"])
		warningInner.addClasses(["callout-title","callout-title-padding", "callout-title-color"]);
		
		this.addApiKeySetting(containerEl);
		this.addEnableAutomaticReplacementSetting(containerEl);
		this.addIncludeSubttasksSetting(containerEl);
		this.addFormatSetting(containerEl);
		this.addKeywordTodoistQuerySetting(containerEl);
		this.addExcludedDirectoriesSetting(containerEl);
	}

	private addEnableAutomaticReplacementSetting(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('Enable automatic replacement of keyword with Todos')
			.setDesc("When enabled, any time a keyword is seen in a non-excluded file, it will be automatically" +
				" replaced with your Todos whenever the file is opened." +
				" When disabled, manually use the 'Replace keyword with todos' command to replace your keyword with Todos.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.enableAutomaticReplacement)
					.onChange(async (value) => {
							this.plugin.settings.enableAutomaticReplacement = value;
							await this.plugin.saveSettings();
						}
					));
		containerEl.createEl('hr').addClass("dashed");
	}

	private addIncludeSubttasksSetting(containerEl: HTMLElement) {
		containerEl.createEl('h2', {text: 'Subtask Handling'}).addClass("heading");
		new Setting(containerEl)
			.setName('Enable Subtasks')
			.setDesc("When enabled, any Subtasks associated with Tasks meeting filter criteria from your keyword will be shown, indented, under the parent Task.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.showSubtasks)
					.onChange(async (value) => {
							this.plugin.settings.showSubtasks = value;
							if (this.plugin.settings.showSubtasks == false) {
								subtaskDiv.toggleClass('hide',true);
							} else {
								subtaskDiv.toggleClass('hide',false);
							}
							await this.plugin.saveSettings();
						}
					));
		const subtaskDiv = containerEl.createEl("div");
		subtaskDiv.addClass("todoist-setting-div");
		new Setting(subtaskDiv)
			.setName('Include Subtasks with no due dates')
			.setDesc("This includes showing subtasks with no due dates that are associated with any parent tasks included in the filter criteria. On by default.")
			.setClass("todoist-setting-item")
			.addToggle(t =>
				t.setValue(this.plugin.settings.noDateSubtasks)
					.onChange(async (value) => {
							this.plugin.settings.noDateSubtasks = value;
							await this.plugin.saveSettings();
						}
					));
		new Setting(subtaskDiv)
			.setName('Limit Subtasks by due date assigned')
			.setDesc("When this and Enable Subtasks is on, this filters out subtasks with due date assigned that are not today. Off by default.")
			.setClass("todoist-setting-item")
			.addToggle(t =>
				t.setValue(this.plugin.settings.todaysSubtasks)
					.onChange(async (value) => {
							this.plugin.settings.todaysSubtasks = value;
							await this.plugin.saveSettings();
						}
					));
		//containerEl.createEl('hr').addClass("dashed");
	}
	private addFormatSetting(containerEl: HTMLElement) {
		this.containerEl.addClass("todoist-setting-section");
		containerEl.createEl('h2', {text: 'Task Formatting'}).addClass("heading");
		new Setting(this.containerEl)
			.setName('Priority')
			.setDesc("Include Priority.")
			.setClass("todoist-setting-item")
			.addToggle(t =>
				t.setValue(this.plugin.settings.showPriority)
					.onChange(async (value) => {
							this.plugin.settings.showPriority = value;
							await this.plugin.saveSettings();
						}
					)); 
		new Setting(this.containerEl)
			.setName('Link')
			.setDesc("Include Link to task in Todoist.")
			.setClass("todoist-setting-item")
			.addToggle(t =>
				t.setValue(this.plugin.settings.showLink)
					.onChange(async (value) => {
							this.plugin.settings.showLink = value;
							await this.plugin.saveSettings();
						}
					)); 
		//containerEl.createEl('hr').addClass("dashed");
	}

	private addExcludedDirectoriesSetting(containerEl: HTMLElement) {
		this.containerEl.addClass("todoist-setting-section");
		containerEl.createEl('h2', {text: 'Excluded folder'}).addClass("heading");
		const excludedFolderDescription = document.createDocumentFragment();
		excludedFolderDescription.append(
			"If you use template files (e.g. for daily notes) and you want to use a keyword in that template file, this plugin would replace the keyword in your template file with Todos immediately, rendering the template useless.",
			excludedFolderDescription.createEl("br"),
			"To prevent this, exclude the folder containing your template file.",
		);
		new Setting(this.containerEl).setDesc(excludedFolderDescription)

		this.plugin.settings.excludedDirectories.forEach(
			(dir, index) => {
				new Setting(this.containerEl)
					.setClass("todoist-setting-item")
					.setName("Excluded folder")
					.addSearch((cb) => {
						new FolderSuggest(this.app, cb.inputEl);
						cb.setPlaceholder("Example: folder1/folder2")
							.setValue(dir)
							.onChange(async (new_folder) => {
								this.plugin.settings.excludedDirectories[index] = new_folder;
								await this.plugin.saveSettings();
							});
					})
					.addExtraButton(eb => {
						eb.setIcon("cross")
							.setTooltip("Delete")
							.onClick(async () => {
								this.plugin.settings.excludedDirectories.splice(
									index,
									1
								);
								await this.plugin.saveSettings();
								await this.display()
							})
					});
			}
		)

		new Setting(this.containerEl)
			.setName("Add another excluded folder")
			.setClass("todoist-setting-last-item")
			.addButton((button: ButtonComponent) => {
				button
					.setButtonText("+")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.excludedDirectories.push("");
						await this.plugin.saveSettings();
						this.display();
					});
			});
	}

	private addKeywordTodoistQuerySetting(containerEl: HTMLElement) {
		// todo add warning/stop if multiple same keywords
		containerEl.createEl('h2', {text: 'Keywords and Filter Definitions'}).addClass("heading");
		const filterDescription = document.createDocumentFragment();
		filterDescription.append('This plugin will find the specified keyword in a currently open file and replace ' +
			'the keyword with your Todos. Your Todos will be pulled from Todoist based on the specified ',
			containerEl.createEl("a", null, (link) => {
				link.href = "https://todoist.com/help/articles/introduction-to-filters";
				link.innerText = "filter definition.";
			}),
			containerEl.createEl("br"),
			"Each keyword you use should be unique."
		)
		new Setting(containerEl).setDesc(filterDescription);

		this.plugin.settings.keywordToTodoistQuery.forEach(
			(keywordToTodoistQuery, index) => {
				const div = this.containerEl.createEl("div");
				div.addClass("todoist-setting-div");
				new Setting(containerEl)
					.addText(text => text
						.setPlaceholder("@@TODOIST_KEYWORD@@")
						.setValue(
							this.plugin.settings.keywordToTodoistQuery[index].keyword
						)
						.onChange(async (value) => {
							this.plugin.settings.keywordToTodoistQuery[index].keyword = value;
							await this.plugin.saveSettings();
						})
						.inputEl.addClass("todoist-query-setting")
					)
					.addText(text => text
						.setPlaceholder("today|overdue")
						.setValue(
							this.plugin.settings.keywordToTodoistQuery[index].todoistQuery
						)
						.onChange(async (value) => {
							this.plugin.settings.keywordToTodoistQuery[index].todoistQuery = value;
							await this.plugin.saveSettings();
						})
						.inputEl.addClass("todoist-query-setting")
					)
					.addExtraButton(eb => {
						eb.setIcon("cross")
							.setTooltip("Delete")
							.onClick(async () => {
								this.plugin.settings.keywordToTodoistQuery.splice(
									index,
									1
								);
								await this.plugin.saveSettings();
								await this.display()
							})
					})
				div.appendChild(this.containerEl.lastChild);
			});


		new Setting(this.containerEl)
			.setName("Add another keyword and Todoist query")
			.setClass("todoist-setting-last-item")
			.addButton((button: ButtonComponent) => {
				button
					.setButtonText("+")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.keywordToTodoistQuery.push({
							keyword: "",
							todoistQuery: ""
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});

	}

	private addApiKeySetting(containerEl: HTMLElement) {
		const tokenDescription = document.createDocumentFragment();
		tokenDescription.createEl("span", null, (span) => {
			span.innerText = 'This is your personal authentication token for Todoist. Be aware that anyone with this token ' +
				'could access all of your Todoist data. This is stored in plain text in your .obsidian/plugins folder.' +
				' Ensure that you are comfortable with the security implications before proceeding. ' +
				'You can get your token from the "API token" section ';

			span.createEl("a", null, (link) => {
				link.href = "https://todoist.com/prefs/integrations";
				link.innerText = "here.";
			});
		});
		new Setting(containerEl)
			.setName('API token')
			.setDesc(tokenDescription)
			.addText(text => text
				.setValue(this.plugin.settings.authToken)
				.onChange(async (value) => {
					this.plugin.settings.authToken = value;
					await this.plugin.saveSettings();
					// give another chance for auto-updates to happen
					this.plugin.hasIntervalFailure = false;
				}));
		containerEl.createEl('hr').addClass("dashed");
	}
}
