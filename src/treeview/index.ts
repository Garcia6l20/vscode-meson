import * as vscode from "vscode";
import { BaseNode } from "@meson/treeview/basenode";
import { ProjectNode } from "@meson/treeview/nodes/toplevel";
import { ProjectStructure } from "@meson/project";

export class MesonProjectDataProvider
  implements vscode.TreeDataProvider<BaseNode> {
  private _onDataChangeEmitter = new vscode.EventEmitter<BaseNode>();
  readonly onDidChangeTreeData = this._onDataChangeEmitter.event;

  private projectStructure?: ProjectStructure
  private projectNode?: ProjectNode

  constructor(ctx: vscode.ExtensionContext, private buildDir: string) {
    ctx.subscriptions.push(
      vscode.commands.registerCommand("mesonbuild.view-refresh", (projectStructure: ProjectStructure) => {
        this.projectStructure = projectStructure;
        this.refresh();
      })
    );
  }

  refresh() {
    this._onDataChangeEmitter.fire();
  }

  getTreeItem(element: BaseNode) {
    return element.getTreeItem();
  }

  async getChildren(element?: BaseNode) {
    if (element) {
      return element.getChildren();
    }
    if (!this.projectStructure) {
      return []
    } else if (!this.projectNode) {
      this.projectNode = new ProjectNode(this.projectStructure.root);
    }
    return [
      this.projectNode,
    ];
  }
}

export class MesonProjectExplorer {
  private viewer: vscode.TreeView<BaseNode>;
  public readonly treeDataProvider: MesonProjectDataProvider

  constructor(ctx: vscode.ExtensionContext, buildDir: string) {
    this.treeDataProvider = new MesonProjectDataProvider(ctx, buildDir);
    this.viewer = vscode.window.createTreeView("meson-project", {
      treeDataProvider: this.treeDataProvider
    });
  }

  public refresh() {
    vscode.commands.executeCommand("mesonbuild.targets-refresh");
  }
}
