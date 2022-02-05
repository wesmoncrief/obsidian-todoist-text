import {App, ButtonComponent, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';
import {toggleServerTaskStatus, updateFileFromServer} from "./src/updateFileFromServer";
import {FolderSuggest} from "./src/suggest/folderSuggester";

export interface TodoistSettings {
	enableAutomaticReplacement: boolean;
	excludedDirectories: string[];
	templateString: string;
	authToken: string;
	todoistQuery: string;
}

const DEFAULT_SETTINGS: TodoistSettings = {
	excludedDirectories: [],
	templateString: "@@TODOIST@@",
	authToken: "TODO - get your auth token",
	todoistQuery: "today|overdue",
	enableAutomaticReplacement: true
}

export default class TodoistPlugin extends Plugin {
	settings: TodoistSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'toggle-todoist-task',
			name: 'Toggle todoist task',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor)
				console.log(view)
				toggleServerTaskStatus(editor, this.settings);
				// I think this is undocumented API/usage. If so, should find another approach
				// @ts-ignore
				view.app.commands.findCommand("editor:toggle-checklist-status").editorCallback(editor, view)
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
			this.app.workspace.on('file-open', () => updateFileFromServer(this.settings, this.app));
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TodoistPluginSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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

		containerEl.createEl('h2', {text: 'Settings for todoist text plugin.'});
		containerEl.createEl('h2', {text: "See https://github.com/wesmoncrief/obsidian-todoist-text/tree/master#readme for usage instructions."});

		const tokenDescription = document.createDocumentFragment();
		tokenDescription.createEl("span", null, (span) => {
			span.innerText = 'This is your personal authentication token for Todoist. Be aware that anyone with this token ' +
				'could access all of your Todoist data. This is stored in plain text in your .obsidian/plugins folder.' +
				' Ensure that you are comfortable with the security implications before proceeding. ' +
				'Restart Obsidian after updating this token. ' +
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
				}));

		const filterDescription = document.createDocumentFragment();
		filterDescription.createEl("span", null, (span) => {
			span.innerText = 'This is the filter query used to pull your tasks. You can use filter definition supported by Todoist, ';
			span.createEl("a", null, (link) => {
				link.href = "https://todoist.com/help/articles/introduction-to-filters";
				link.innerText = "as defined here.";
			});
		});
		new Setting(containerEl)
			.setName('Todoist Query')
			.setDesc(filterDescription)
			.addText(text => text
				.setValue(this.plugin.settings.todoistQuery)
				.onChange(async (value) => {
					this.plugin.settings.todoistQuery = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Template Keyword')
			.setDesc('This is the keyword that this plugin will replace with your todos from Todoist.')
			.addText(text => text
				.setValue(this.plugin.settings.templateString)
				.onChange(async (value) => {
					this.plugin.settings.templateString = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable automatic replacement of your key word with todos')
			.setDesc("When enabled, any time the keyword is seen in a non-blacklisted file, it will be automatically " +
				"replaced with your todos whenever the file is opened." +
				" When disabled, you will have to manually use the 'Replace keyword with todos' command." +
				" Restart Obsidian for changes to take effect.")
			.addToggle(t =>
				t.setValue(this.plugin.settings.enableAutomaticReplacement)
					.onChange(async (value) => {
							this.plugin.settings.enableAutomaticReplacement = value;
							await this.plugin.saveSettings();
						}
					));

		containerEl.createEl('h2', {text: 'Excluded folder'});
		const excludedFolderDescription = containerEl.createEl('h4', {
			text:
				"It is useful to" +
				" add your template file locations here, so that your template files will create files that can themselves" +
				" pull down todos. If you use template files, and you don't set their locations here, your template file " +
				"itself will have convert its keyword into todos at the moment you open the template file."
		});
		excludedFolderDescription.style.fontWeight = "normal";

		this.plugin.settings.excludedDirectories.forEach(
			(dir, index) => {
				new Setting(this.containerEl)
					.setName("Excluded folders")
					.setDesc("This folder will not work for replacing your key word with todos.")
					.addSearch((cb) => {
						new FolderSuggest(this.app, cb.inputEl);
						cb.setPlaceholder("Example: folder1/folder2")
							.setValue(dir)
							.onChange(async (new_folder) => {
								this.plugin.settings.excludedDirectories[index] = new_folder;
								await this.plugin.saveSettings();
							});
						// @ts-ignore
						cb.containerEl.addClass("templater_search");
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
			.setDesc("Add excluded folder")
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
}
