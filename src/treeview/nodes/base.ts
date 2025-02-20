import * as path from "path";
import * as vscode from "vscode";
import { randomString, isThenable } from "@meson/utils";
import { DirectoryNode, TargetSourceFileNode } from "@meson/treeview/nodes/sources";
import { BaseNode } from "@meson/treeview/basenode";


export class FileNode extends BaseNode {
  constructor(public readonly root: string, public readonly name: string) {
    super(name + randomString());
  }

  static create(filePath: string) {
    return new FileNode(path.dirname(filePath), path.basename(filePath));
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.resourceUri = vscode.Uri.file(path.join(this.root, this.name));
    item.label = path.basename(this.name);
    item.command = {
      command: "vscode.open",
      title: "Open file",
      arguments: [item.resourceUri]
    };
    return item;
  }
}

export abstract class BaseDirectoryNode<T> extends BaseNode {
  subfolders: Thenable<Map<string, T[]>>;

  constructor(readonly folder: string, readonly filepaths: T[]) {
    super(folder + randomString());
    const subs = this.buildFileTree(filepaths);
    if (isThenable(subs)) {
      this.subfolders = subs;
    } else {
      this.subfolders = Promise.resolve(subs);
    }
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    // item.resourceUri = vscode.Uri.file(this.folder);
    item.label = path.basename(this.folder);
    item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    return item;
  }

  abstract buildFileTree(fpaths: T[]): vscode.ProviderResult<Map<string, T[]>>;
}

export class BaseFileDirectoryNode extends BaseDirectoryNode<string> {
  async getChildren() {
    return Array.from((await this.subfolders).entries())
      .map(([folder, files]) => {
        if (folder === ".") {
          return files.map(f => new TargetSourceFileNode(f));
        } else return new DirectoryNode(folder, files);
      })
      .flat(1);
  }

  buildFileTree(fpaths: string[]) {
    const folders = new Map<string, string[]>();
    folders.set(".", new Array());
    for (const f of fpaths) {
      let folderName = path.relative(this.folder, f);
      if (path.dirname(folderName) === ".") {
        folders.get(".").push(f);
        continue;
      }
      while (path.dirname(folderName) !== ".")
        folderName = path.dirname(folderName);
      const absFolder = path.join(this.folder, folderName);
      if (folders.has(absFolder)) {
        folders.get(absFolder).push(f);
      } else {
        folders.set(absFolder, [f]);
      }
    }

    return folders;
  }
}
