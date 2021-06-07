import * as vscode from "vscode";

import { BaseNode } from "../basenode";
import { BaseProject, Tests, Targets } from "../../meson/types";
import { extensionRelative, hash, randomString } from "../../utils";
import { TargetDirectoryNode, TargetNode } from "./targets";
import { TestNode } from "./tests";
import { FileNode } from "./base";
import { ProjectModel } from "../../project";

function getProjectName(project: BaseProject) {
  let name = project.descriptive_name;
  if (project.version != "undefined") {
    name += ` (${project.version})`;
  }
  return name;
}

export class ProjectNode extends BaseNode {

  constructor(
    private readonly project: ProjectModel
  ) {
    super(getProjectName(project));
  }
  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.iconPath = extensionRelative("res/meson_32.svg");
    item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    item.contextValue = "isRoot=true"
    return item;
  }
  async getChildren() {    
    let children:BaseNode[] = [FileNode.create(this.project.buildFile)];
    if (this.project.subprojects && this.project.subprojects.length) {
      children.push(new SubprojectsRootNode(this.project.subprojects));
    }
    if (this.project.targets && this.project.targets.length) {
      // const relPath = path.relative(gExtManager.projectRoot, this.project.sourceDir);
      children.push(new TargetsRootNode(this.project.targets));
    }
    const tests = [...this.project?.allTests, ...this.project?.allBenchmarks];
    if (tests.length) {
      children.push(new TestRootNode(tests))
    }
    return children;
  }
}

export class SubprojectsRootNode extends BaseNode {
  constructor(
    private readonly subprojects: ProjectModel[]
  ) {
    super(
      hash(subprojects.map(s => `${s.descriptive_name} ${s.version}`).join(";"))
    );
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.label = "Subprojects";
    item.iconPath = extensionRelative("res/icon-subprojects.svg");
    item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    return item;
  }

  getChildren() {
    return this.subprojects.map(s => {
      return new ProjectNode(s);
    });
  }
}

export class TargetsRootNode extends BaseNode {
  constructor(private readonly targets: Targets) {
    super(hash(targets.map(t => `${t.subproject}/${t.name}`).join(";")));
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.label = "Targets";
    item.iconPath = extensionRelative("res/meson_32.svg");
    item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    return item;
  }

  getChildren() {
    return this.targets.map(t => new TargetNode(t));
  }
}

export class TestRootNode extends BaseNode {
  constructor(private readonly tests: Tests) {
    super(hash(tests.map(t => t.suite + t.name).join(";")) + randomString());
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.label = "Tests";
    item.iconPath = extensionRelative("res/meson_32.svg");
    item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    item.contextValue = "isTestRoot=true";
    return item;
  }

  getChildren() {
    return this.tests.map(t => new TestNode(t));
  }
}

export class SubprojectNode extends BaseNode {
  constructor(
    private readonly subproject: ProjectModel
  ) {
    super(getProjectName(subproject));
  }

  getTreeItem() {
    const item = super.getTreeItem() as vscode.TreeItem;
    item.iconPath = extensionRelative("res/icon-subproject.svg");
    item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    return item;
  }

  async getChildren() {
    return this.subproject.targets.map(t => { return new TargetNode(t); });
  }
}
