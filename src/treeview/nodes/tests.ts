import * as vscode from "vscode";

import { BaseNode } from "@meson/treeview/basenode";
import { Test } from "@meson/meson/types";
import { extensionRelative, randomString } from "@meson/utils";

export class TestNode extends BaseNode {
  constructor(public readonly test: Test) {
    super(test.name + randomString());
  }

  getChildren() {
    return [];
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.label = this.test.name;
    item.iconPath = extensionRelative("res/meson_32.svg");
    item.command = {
      title: "Run test",
      command: "mesonbuild.test",
      arguments: [this.test]
    };

    return item;
  }
}
