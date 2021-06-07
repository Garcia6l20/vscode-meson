import * as vscode from "vscode";

import { BaseNode } from "../basenode";
import { BaseProject, ProjectInfo, Subproject, Tests, Targets } from "../../meson/types";
import { extensionRelative, hash, randomString, resolveSymlinkPath } from "../../utils";
import { TargetDirectoryNode, TargetNode } from "./targets";
import { getMesonBuildFiles, getMesonTargets, getMesonTests } from "../../meson/introspection";
import { TestNode } from "./tests";
import { pathToFileURL } from "url";
import * as path from 'path';
import { gExtManager } from "../../extension";
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
    const buildFileNode = FileNode.create(this.project.buildFile);
    
    return [
      buildFileNode,
      new SubprojectsRootNode(this.project.subprojects),
      new TargetDirectoryNode(
        ".",
        this.project.targets
      ),
      new TestRootNode([...this.project.allTests, ...this.project.allBenchmarks])
    ];
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
    return this.subprojects.map(s => new SubprojectNode(s));
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
    super(hash(tests.map(t => t.suite + t.name).join(";")));
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
