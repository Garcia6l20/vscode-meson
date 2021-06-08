import * as vscode from "vscode";
import * as path from "path";
import {
  exec,
  execAsTask,
  getOutputChannel,
  extensionConfiguration,
  execStream,
  getTargetName
} from "@meson/utils";
import { relative } from "path";
import { checkMesonIsConfigured } from "@meson/meson/utils";
import { TargetNode } from "@meson/treeview/nodes/targets";
import { TestNode } from "@meson/treeview/nodes/tests";
import { TestRootNode } from "@meson/treeview/nodes/toplevel";
import { gExtManager } from "@meson/extension";
import { Target, Test } from "@meson/meson/types";
import { targetPrompt } from "@meson/prompts";

export async function runMesonConfigure(source: string, build: string) {
  return vscode.window.withProgress(
    {
      title: "Configuring",
      location: vscode.ProgressLocation.Notification,
      cancellable: false
    },
    async progress => {
      progress.report({
        message: `Checking if Meson is configured in ${relative(
          source,
          build
        )}...`
      });
      if (await checkMesonIsConfigured(build)) {
        progress.report({
          message: "Applying configure options...",
          increment: 30
        });
        await exec(
          `${extensionConfiguration("mesonPath")} configure ${extensionConfiguration("configureOptions").join(
            " "
          )} ${build}`,
          { cwd: source }
        );
        progress.report({ message: "Reconfiguring build...", increment: 60 });
        await exec(`${extensionConfiguration("ninjaPath")} reconfigure`, { cwd: build });
      } else {
        progress.report({
          message: `Configuring Meson into ${relative(source, build)}...`
        });
        const configureOpts = extensionConfiguration("configureOptions").join(
          " "
        );
        const { stdout, stderr } = await exec(
          `${extensionConfiguration("mesonPath")} ${configureOpts} ${build}`,
          { cwd: source }
        );
        getOutputChannel().appendLine(stdout);
        getOutputChannel().appendLine(stderr);
        if (stderr.length > 0) getOutputChannel().show(true);
      }
      progress.report({ message: "Done.", increment: 100 });
      return new Promise(res => setTimeout(res, 2000));
    }
  );
}

type TargetLike = TargetNode | Target;

async function resolveTargetName(target?: TargetLike, acceptAll: boolean = false): Promise<string> {
  if (!target) {
    if (!gExtManager.activeTarget) {
      if (acceptAll) {
        return 'all';
      } else {
        return null;
      }
    } else {
      return await getTargetName(gExtManager.activeTarget);
    }
  } else if (target instanceof TargetNode) {
    return await getTargetName(target.target);
  }
}

export async function runMesonBuild(buildDir: string, target?: TargetLike) {

  const name = await resolveTargetName(target, true);

  let command = `${extensionConfiguration("ninjaPath")} ${name}`;
  const stream = execStream(command, { cwd: buildDir });

  function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  const pathToProjectRoot = path.relative(buildDir, gExtManager.projectRoot);
  const pathPatten = new RegExp(escapeRegExp(pathToProjectRoot) + '\\/([^:]+)', 'gm');
  const filepathWorkaround = extensionConfiguration("filepathWorkaround");

  return vscode.window.withProgress(
    {
      title: `Building target ${name}`,
      location: vscode.ProgressLocation.Notification,
      cancellable: true
    },
    async (progress, token) => {
      token.onCancellationRequested(() => stream.kill());
      let oldPercentage = 0;
      stream.onLine((msg, isError) => {
        const match = /^\[(\d+)\/(\d+)\] (.*)/g.exec(msg);
        if (match) {
          const percentage = (100 * parseInt(match[1])) / parseInt(match[2]);
          const increment = percentage - oldPercentage;
          oldPercentage = percentage;
          if (increment > 0) progress.report({ increment, message: match[3] });
        }
        if (filepathWorkaround) {
          msg = msg.replace(pathPatten, gExtManager.projectRoot + '/$1');
        }
        getOutputChannel().append(msg);
        if (isError) getOutputChannel().show(true);
      });

      await stream.finishP().then(code => {
        if (code !== 0)
          throw new Error(
            "Build failed. See Meson Build output for more details."
          );
      });
      progress.report({ message: "Build finished.", increment: 100 });
      await new Promise(res => setTimeout(res, 5000));
    }
  );
}

type TestLike = TestRootNode | TestNode | Test;

export async function runMesonTests(build: string, test?: TestLike) {
  try {
    if (test && !(test instanceof TestRootNode)) {
      if (test instanceof TestNode) {
        test = test.test;
      }
      return await execAsTask(
        `${extensionConfiguration("mesonPath")} test ${test.name}`,
        { cwd: build },
        vscode.TaskRevealKind.Always
      );
    } else {
      return await execAsTask(
        `${extensionConfiguration("ninjaPath")} test`,
        { cwd: build },
        vscode.TaskRevealKind.Always
      );
    }
  } catch (e) {
    if (e.stderr) {
      vscode.window.showErrorMessage("Tests failed.");
    }
  }
}

async function resolveExecTargetPath(target?: TargetLike): Promise<string> {
  if (!target) {
    if ((!gExtManager.activeTarget) || (gExtManager.activeTarget.type != "executable")) {
      return (await targetPrompt("executable"))?.filename[0];
    } else {
      return gExtManager.activeTarget.filename[0];
    }
  } else if (target instanceof TargetNode) {
    return target.target.filename[0];
  }
}

export async function runMesonTarget(build: string, target?: TargetLike) {
  const targetPath = await resolveExecTargetPath(target);
  if (!targetPath) {
    return;
  }

  try {
    return await execAsTask(
      `${targetPath}`,
      { cwd: build },
      vscode.TaskRevealKind.Always
    );
  } catch (e) {
    if (e.stderr) {
      vscode.window.showErrorMessage("Error while running target.");
    }
  }
}

export async function debugMesonTarget(build: string, target?: TargetLike): Promise<vscode.DebugSession | null> {
  const targetPath = await resolveExecTargetPath(target);
  if (!targetPath) {
    return;
  }
  const targetName = await resolveTargetName(target);

  try {
    const debugConfig = {
      type: 'cppdbg',
      name: `Debug ${targetName}`,
      request: 'launch',
      cwd: build,
      MIMode: 'gdb',
      miDebuggerPath: 'gdb',
      setupCommands: [
        {
          description: 'Enable pretty-printing for gdb',
          text: '-enable-pretty-printing',
          ignoreFailures: true
        }
      ],
      program: targetPath
    };
    await vscode.debug.startDebugging(this.folder, debugConfig);
    return vscode.debug.activeDebugSession!;
  } catch (e) {
    if (e.stderr) {
      vscode.window.showErrorMessage("Error while running target.");
    }
  }
}
