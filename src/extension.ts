import * as path from "path";
import * as vscode from "vscode";
import {
  runMesonConfigure,
  runMesonBuild,
  runMesonTests,
  runMesonReconfigure,
  runMesonTarget
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
import { CodeModel } from "./codemodel";


class ExtensionManager implements vscode.Disposable {

  private cpptApi?: cppt.CppToolsApi;
  private readonly cppConfProvider = new CppConfigurationProvider();
  public readonly explorer?: MesonProjectExplorer

  public readonly projectRoot: string
  private buildDir: string

  public readonly codeModel = new CodeModel()

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

    reg("build", async (name?: string) => {
      const resolvedName = await new Promise<string>((resolve, reject) => {
        if (name) {
          return resolve(name);
        }
        const itemsP: Promise<vscode.QuickPickItem[]> = getMesonTargets(
          this.buildDir
        ).then<vscode.QuickPickItem[]>(tt => [
          {
            label: "all",
            detail: "Build all targets",
            description: "(meta-target)",
            picked: true
          },
          ...tt.map<vscode.QuickPickItem>(t => ({
            label: t.name,
            detail: path.relative(this.projectRoot, path.dirname(t.defined_in)),
            description: t.type,
            picked: false
          }))
        ]);
        const picker = vscode.window.createQuickPick();
        picker.busy = true;
        picker.placeholder =
          "Select target to build. Defaults to all targets";
        picker.show();
        itemsP.then(items => {
          picker.items = items;
          picker.busy = false;
          picker.onDidAccept(async () => {
            const active = picker.activeItems[0];
            if (active.label === "all") resolve(undefined);
            else
              resolve(
                getTargetName(
                  (await getMesonTargets(this.buildDir)).filter(
                    t => t.name === active.label
                  )[0]
                )
              );
            picker.dispose();
          });
          picker.onDidHide(() => reject());
        });
      }).catch<null>(() => null);
      if (resolvedName !== null)
        await runMesonBuild(
          workspaceRelative(extensionConfiguration("buildFolder")),
          resolvedName
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
      await execAsTask(`extensionConfiguration("ninjaPath") clean`, {
        cwd: workspaceRelative(extensionConfiguration("buildFolder"))
      });
    });

    reg("run", async (name?: string) => {
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
        getMesonExecutables(this.buildDir)
          .then<vscode.QuickPickItem[]>(execs => [
            ...execs.map<vscode.QuickPickItem>(t => ({
              label: t.name,
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
        await runMesonTarget(
          workspaceRelative(extensionConfiguration("buildFolder")),
          resolvedName
        );
      this.explorer.refresh();
    });

    reg("targets-refresh", async () => {
      await this.codeModel.update(this.projectRoot, this.buildDir);
      await vscode.commands.executeCommand<boolean>("mesonbuild.view-refresh");
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
    // await self.registerCppToolsProvider();
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
