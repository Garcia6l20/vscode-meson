import * as path from "path";
import * as vscode from "vscode";
import {
  runMesonConfigure,
  runMesonBuild,
  runMesonTests,
  runMesonTarget,
  debugMesonTarget
} from "./meson/runners";
import { MesonProjectExplorer } from "./treeview";
import {
  extensionConfiguration,
  execAsTask,
  workspaceRelative,
  extensionConfigurationSet
} from "./utils";

import { CppConfigurationProvider } from './cpptools';
import * as cppt from 'vscode-cpptools';
import { ProjectStructure } from "./project";
import { StatusBar } from './status';
import { targetPrompt, testPrompt } from './prompts';
import { Target, Test } from "./meson/types";

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

    reg("selectActiveTarget", async () => {
      this._activeTarget = await targetPrompt();
      this.statusBar.setActiveTarget(this.activeTarget);
    });

    reg("build", async (target?: Target) => {
      await runMesonBuild(
        workspaceRelative(extensionConfiguration("buildFolder")),
        target
      );
      // this.explorer.refresh();
    });

    reg("test", async (test?: Test) => {
      if (!test) {
        test = await testPrompt();
      }
      await runMesonTests( 
        workspaceRelative(extensionConfiguration("buildFolder")),
        test
      );
      // this.explorer.refresh();
    });

    reg("clean", async () => {
      await execAsTask(`${extensionConfiguration("ninjaPath")} clean`, {
        cwd: workspaceRelative(extensionConfiguration("buildFolder"))
      });
    });

    reg("run", async (target?: Target) => {
      await runMesonTarget(
        workspaceRelative(extensionConfiguration("buildFolder")),
        target
      );
    });

    reg("debug", async (target: Target) => {
      await debugMesonTarget(
        workspaceRelative(extensionConfiguration("buildFolder")),
        target
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

    await gExtManager.registerCommands();
    await gExtManager.onLoaded();
    // await gExtManager.registerCppToolsProvider();

    vscode.commands.executeCommand("setContext", "inMesonProject", true);
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
