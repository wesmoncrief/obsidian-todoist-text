import {App, ButtonComponent, Editor, MarkdownView, Plugin, PluginSettingTab, Setting} from 'obsidian';
import {toggleServerTaskStatus, updateFileFromServer} from "./src/updateFileFromServer";
import {FolderSuggest} from "./src/suggest/folderSuggester";
import {migrateSettings} from "./src/settingsMigrator";
import {DEFAULT_SETTINGS, TodoistSettings} from "./src/DefaultSettings";

export default class TodoistPlugin extends Plugin {
	settings: TodoistSettings;
	hasIntervalFailure: boolean = false;
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
		let storedSettings = await this.loadData() ?? DEFAULT_SETTINGS;
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
		containerEl.createEl('a', {text: 'Important - see usage instructions', href: 'https://github.com/wesmoncrief/obsidian-todoist-text/tree/master#readme'});

		this.addApiKeySetting(containerEl);
		this.addEnableAutomaticReplacementSetting(containerEl);
		this.addIncludeSubttasksSetting(containerEl);
		this.addKeywordTodoistQuerySetting(containerEl);
		this.addExcludedDirectoriesSetting(containerEl);
		this.addOutputFieldsSettings(containerEl);
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
	}

	private addIncludeSubttasksSetting(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('Enable Subtasks')
			.setDesc("When enabled, any Subtasks associated with Todos meeting filter criteria from your keyword will be shown, indented, under the parent Todo.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.showSubtasks)
					.onChange(async (value) => {
							this.plugin.settings.showSubtasks = value;
							await this.plugin.saveSettings();
						}
					));
	}

	private addExcludedDirectoriesSetting(containerEl: HTMLElement) {
		containerEl.createEl('h2', {text: 'Excluded folder'});
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
		containerEl.createEl('h2', {text: 'Keywords and Filter Definitions'});
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
	}

	private addOutputFieldsSettings(containerEl: HTMLElement) {
		containerEl.createEl('h2', {text: 'Task Output Fields'});

		const descFragment = document.createDocumentFragment();
		descFragment.append('Select which additional Todoist fields to display after the task name. Each enabled field will be inserted between -- separators. Use prefix and suffix to format, e.g., [[ and ]] for Obsidian internal links.');

		new Setting(containerEl)
			.setDesc(descFragment);

		containerEl.createEl('h3', {text: 'Basic Fields'});

		// Project
		new Setting(containerEl)
			.setName('Include Project Name')
			.setDesc('Display the Todoist project for the task (previously always included as [Project Name])')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.projectEnabled)
				.onChange(async (value) => {
					this.plugin.settings.projectEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setPlaceholder('[[')
				.setValue(this.plugin.settings.projectPrefix)
				.onChange(async (value) => {
					this.plugin.settings.projectPrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.projectPrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setPlaceholder(']]')
				.setValue(this.plugin.settings.projectSuffix)
				.onChange(async (value) => {
					this.plugin.settings.projectSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.projectSuffix = val;
					await this.plugin.saveSettings();
				})
			);

		containerEl.createEl('h3', {text: 'Advanced Fields'});

		// Section
		new Setting(containerEl)
			.setName('Include Section Name')
			.setDesc('Display the Todoist section within the project, if applicable')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.sectionEnabled)
				.onChange(async (value) => {
					this.plugin.settings.sectionEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.sectionPrefix)
				.onChange(async (value) => {
					this.plugin.settings.sectionPrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.sectionPrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.sectionSuffix)
				.onChange(async (value) => {
					this.plugin.settings.sectionSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.sectionSuffix = val;
					await this.plugin.saveSettings();
				})
			);

		// Labels
		new Setting(containerEl)
			.setName('Include Labels')
			.setDesc('Display comma-separated labels for the task')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.labelsEnabled)
				.onChange(async (value) => {
					this.plugin.settings.labelsEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.labelsPrefix)
				.onChange(async (value) => {
					this.plugin.settings.labelsPrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.labelsPrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.labelsSuffix)
				.onChange(async (value) => {
					this.plugin.settings.labelsSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.labelsSuffix = val;
					await this.plugin.saveSettings();
				})
			);

		// Due Date
		new Setting(containerEl)
			.setName('Include Due Date')
			.setDesc('Display the due date for the task, if set')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.dueEnabled)
				.onChange(async (value) => {
					this.plugin.settings.dueEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.duePrefix)
				.onChange(async (value) => {
					this.plugin.settings.duePrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.duePrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.dueSuffix)
				.onChange(async (value) => {
					this.plugin.settings.dueSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.dueSuffix = val;
					await this.plugin.saveSettings();
				})

			);

		// Assignee
		new Setting(containerEl)
			.setName('Include Assignee')
			.setDesc('Display the assignee name for the task, if assigned')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.assigneeEnabled)
				.onChange(async (value) => {
					this.plugin.settings.assigneeEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.assigneePrefix)
				.onChange(async (value) => {
					this.plugin.settings.assigneePrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.assigneePrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.assigneeSuffix)
				.onChange(async (value) => {
					this.plugin.settings.assigneeSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.assigneeSuffix = val;
					await this.plugin.saveSettings();
				})
			);

		// Comments Count
		new Setting(containerEl)
			.setName('Include Comments Count')
			.setDesc('Display the number of comments on the task')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.commentsEnabled)
				.onChange(async (value) => {
					this.plugin.settings.commentsEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.commentsPrefix)
				.onChange(async (value) => {
					this.plugin.settings.commentsPrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.commentsPrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.commentsSuffix)
				.onChange(async (value) => {
					this.plugin.settings.commentsSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.commentsSuffix = val;
					await this.plugin.saveSettings();
				})
			);

		// Order
		new Setting(containerEl)
			.setName('Include Order')
			.setDesc('Display the task order number')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.orderEnabled)
				.onChange(async (value) => {
					this.plugin.settings.orderEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.orderPrefix)
				.onChange(async (value) => {
					this.plugin.settings.orderPrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.orderPrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.orderSuffix)
				.onChange(async (value) => {
					this.plugin.settings.orderSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.orderSuffix = val;
					await this.plugin.saveSettings();
				})
			);

		// Added At
		new Setting(containerEl)
			.setName('Include Added Date')
			.setDesc('Display when the task was added')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.addedAtEnabled)
				.onChange(async (value) => {
					this.plugin.settings.addedAtEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.addedAtPrefix)
				.onChange(async (value) => {
					this.plugin.settings.addedAtPrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.addedAtPrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.addedAtSuffix)
				.onChange(async (value) => {
					this.plugin.settings.addedAtSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.addedAtSuffix = val;
					await this.plugin.saveSettings();
				})
			);

		// Due Date (ISO)
		new Setting(containerEl)
			.setName('Include Due Date (ISO)')
			.setDesc('Display the due date in ISO format')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.dueDateEnabled)
				.onChange(async (value) => {
					this.plugin.settings.dueDateEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.dueDatePrefix)
				.onChange(async (value) => {
					this.plugin.settings.dueDatePrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.dueDatePrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.dueDateSuffix)
				.onChange(async (value) => {
					this.plugin.settings.dueDateSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.dueDateSuffix = val;
					await this.plugin.saveSettings();
				})
			);

		// Due Recurring
		new Setting(containerEl)
			.setName('Include Due Recurring')
			.setDesc('Display if the due date is recurring')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.dueRecurringEnabled)
				.onChange(async (value) => {
					this.plugin.settings.dueRecurringEnabled = value;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.dueRecurringPrefix)
				.onChange(async (value) => {
					this.plugin.settings.dueRecurringPrefix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.dueRecurringPrefix = val;
					await this.plugin.saveSettings();
				})
			)
			.addText(text => text
				.setValue(this.plugin.settings.dueRecurringSuffix)
				.onChange(async (value) => {
					this.plugin.settings.dueRecurringSuffix = value;
					await this.plugin.saveSettings();
				})
				.inputEl.addEventListener('blur', async () => {
					let val = text.inputEl.value;
					if (val.length > 100) {
						val = val.substring(0, 100);
					}
					text.inputEl.value = val;
					this.plugin.settings.dueRecurringSuffix = val;
					await this.plugin.saveSettings();
				})
			);
	}
}
