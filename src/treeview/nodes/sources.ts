import * as path from "path";
import * as vscode from "vscode";

import { extensionRelative, randomString, resolveSymlinkPath } from "@meson/utils";
import { BaseNode } from "@meson/treeview/basenode";
import { BaseFileDirectoryNode } from "@meson/treeview/nodes/base";

export class TargetSourcesNode extends BaseFileDirectoryNode {
  constructor(rootFolder: string, private readonly allFiles: string[]) {
    super(rootFolder, allFiles.map(p => resolveSymlinkPath(rootFolder, p)));
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.label = "Sources" + (this.allFiles.length === 0 ? " (no files)" : "");
    item.iconPath = extensionRelative("res/meson_32.svg");
    return item;
  }
}

export class TargetGeneratedSourcesNode extends BaseFileDirectoryNode {
  constructor(files: string[]) {
    super(vscode.workspace.rootPath, files);
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.label = "Sources (generated)";
    item.iconPath = extensionRelative("res/meson_32.svg");
    return item;
  }
}

export class DirectoryNode extends BaseFileDirectoryNode {
  constructor(folder: string, files: string[]) {
    super(folder, files);
  }

  getTreeItem() {
    const item = super.getTreeItem();
    item.label = path.basename(this.folder);
    item.resourceUri = vscode.Uri.file(this.folder);
    return item;
  }
}

export class TargetSourceFileNode extends BaseNode {
  constructor(private readonly file: string) {
    super(file + randomString());
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.resourceUri = vscode.Uri.file(this.file);
    item.label = path.basename(this.file);
    item.command = {
      command: "vscode.open",
      title: "Open file",
      arguments: [vscode.Uri.file(this.file)]
    };
    return item;
  }
}
