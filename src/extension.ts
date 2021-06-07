import * as path from "path";
import * as vscode from "vscode";
import {
  runMesonConfigure,
  runMesonBuild,
  runMesonTests,
  runMesonReconfigure,
  runMesonTarget,
  debugMesonTarget
} from "./meson/runners";
import { getMesonTasks } from "./tasks";
import { MesonProjectExplorer } from "./treeview";
import {
  extensionConfiguration,
  execAsTask,
  workspaceRelative,
  extensionConfigurationSet,
  getTargetName
} from "./utils";
import {
  getMesonTargets,
  getMesonTests,
  getMesonBenchmarks,
  getMesonExecutables
} from "./meson/introspection";

import { CppConfigurationProvider } from './cpptools';
import * as cppt from 'vscode-cpptools';
import { ProjectStructure } from "./project";
import { StatusBar } from './status';
import { targetPrompt } from './prompts';
import { Target } from "./meson/types";

class ExtensionManager implements vscode.Disposable {

  private cpptApi?: cppt.CppToolsApi;
  private readonly cppConfProvider = new CppConfigurationProvider;
  public readonly explorer?: MesonProjectExplorer

  public readonly projectRoot: string
  private buildDir: string

  private _activeTarget?: Target = null
  get activeTarget() { return this._activeTarget; }

  public readonly projectStructure = new ProjectStructure;

  private readonly statusBar = new StatusBar;

  constructor(public readonly extensionContext: vscode.ExtensionContext) {

    this.projectRoot = vscode.workspace.workspaceFolders[0].uri.path;
    if (!this.projectRoot) {
      throw new Error("Invalid project root");
    }

    this.buildDir = workspaceRelative(extensionConfiguration("buildFolder"));

    this.explorer = new MesonProjectExplorer(this.extensionContext, this.buildDir);

  }

  async registerCppToolsProvider() {
    if (!this.cpptApi) {
      this.cpptApi = await cppt.getCppToolsApi(cppt.Version.v5);
      this.cpptApi.registerCustomConfigurationProvider(this.cppConfProvider);
    }
  }

  async registerTaskProvider() {
    this.extensionContext.subscriptions.push(
      vscode.tasks.registerTaskProvider("meson", {
        provideTasks(token) {
          return getMesonTasks(
            workspaceRelative(this.buildFolder)
          );
        },
        resolveTask() {
          return undefined;
        }
      })
    );
  }

  async registerCommands() {

    const reg = (id, handle) => {
      this.extensionContext.subscriptions.push(
        vscode.commands.registerCommand(`mesonbuild.${id}`, handle)
      );
    };

    reg("configure", async () => {
      await runMesonConfigure(
        this.projectRoot,
        workspaceRelative(extensionConfiguration("buildFolder"))
      );
      this.explorer.refresh();
    });

    reg("reconfigure", async () => {
      await runMesonConfigure(
        this.projectRoot,
        workspaceRelative(extensionConfiguration("buildFolder"))
      );
      this.explorer.refresh();
    });

    reg("selectActiveTarget", async () => {
      this._activeTarget = await targetPrompt();
      this.statusBar.setActiveTarget(this.activeTarget);
    });

    reg("build", async (name?: string) => {
      await runMesonBuild(
        workspaceRelative(extensionConfiguration("buildFolder"))
      );
      this.explorer.refresh();
    });

    reg("test", async (name?: string) => {
      const resolvedName = await new Promise<string>((resolve, reject) => {
        if (name) return resolve(name);
        const picker = vscode.window.createQuickPick();
        picker.busy = true;
        picker.onDidAccept(() => {
          const active = picker.activeItems[0];
          if (active.label === "all") resolve(undefined);
          else resolve(active.label);
          picker.dispose();
        });
        picker.onDidHide(() => reject());
        Promise.all([getMesonTests(this.buildDir), getMesonBenchmarks(this.buildDir)])
          .then<vscode.QuickPickItem[]>(([tests, benchmarks]) => [
            {
              label: "all",
              detail: "Run all tests",
              description: "(meta-target)",
              picked: true
            },
            ...tests.map<vscode.QuickPickItem>(t => ({
              label: t.name,
              detail: `Test timeout: ${t.timeout}s, ${t.is_parallel ? "Run in parallel" : "Run serially"
                }`,
              description: t.suite.join(","),
              picked: false
            })),
            ...benchmarks.map<vscode.QuickPickItem>(b => ({
              label: b.name,
              detail: `Benchmark timeout: ${b.timeout
                }s, benchmarks always run serially`,
              description: b.suite.join(","),
              picked: false
            }))
          ])
          .then(items => {
            picker.busy = false;
            picker.items = items;
          });
        picker.show();
      }).catch<null>(() => null);
      if (resolvedName != null)
        await runMesonTests(
          workspaceRelative(extensionConfiguration("buildFolder")),
          resolvedName
        );
      this.explorer.refresh();
    });

    reg("clean", async () => {
      await execAsTask(`${extensionConfiguration("ninjaPath")} clean`, {
        cwd: workspaceRelative(extensionConfiguration("buildFolder"))
      });
    });

    reg("run", async (name?: string) => {
      await runMesonTarget(
        workspaceRelative(extensionConfiguration("buildFolder"))
      );
    });

    reg("debug", async (name?: string) => {
      await debugMesonTarget(
        workspaceRelative(extensionConfiguration("buildFolder"))
      );
    });

    reg("targets-refresh", async () => {
      await this.projectStructure.update(this.projectRoot, this.buildDir);
      await vscode.commands.executeCommand<boolean>("mesonbuild.view-refresh", this.projectStructure);
      // this.cpptApi.didChangeCustomConfiguration(this.cppConfProvider);
    });
  }

  async onLoaded() {
    if (extensionConfiguration("configureOnOpen")) {
      vscode.commands
        .executeCommand<boolean>("mesonbuild.configure")
        .then(isFresh => {
          this.explorer.refresh();
        });
    } else {
      vscode.window
        .showInformationMessage(
          "Meson project detected, would you like VS Code to configure it?",
          "No",
          "This workspace",
          "Yes"
        )
        .then(response => {
          switch (response) {
            case "Yes":
              extensionConfigurationSet(
                "configureOnOpen",
                true,
                vscode.ConfigurationTarget.Global
              );
              break;
            case "This workspace":
              extensionConfigurationSet(
                "configureOnOpen",
                true,
                vscode.ConfigurationTarget.Workspace
              );
              break;
            default:
              extensionConfigurationSet(
                "configureOnOpen",
                false,
                vscode.ConfigurationTarget.Global
              );
          }
          if (response !== "No") {
            vscode.commands
              .executeCommand("mesonbuild.configure")
              .then(() => this.explorer.refresh());
          }
        });
    }
  }

  async cleanup() {
    this.cpptApi.dispose();
  }

  /**
   * Create the instance
   */
  static async create(context: vscode.ExtensionContext) {
    gExtManager = new ExtensionManager(context);

    await gExtManager.registerTaskProvider();
    await gExtManager.registerCommands();
    await gExtManager.onLoaded();
    // await gExtManager.registerCppToolsProvider();
  }

  /**
   * Dispose the instance
   */
  dispose() {
    (async () => {
      this.cleanup();
    })();
  }
}


export let gExtManager: ExtensionManager | null = null;

export async function activate(ctx: vscode.ExtensionContext) {
  await ExtensionManager.create(ctx);
}
