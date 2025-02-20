import * as vscode from 'vscode';
import * as path from 'path';

import { gExtManager } from '@meson/extension';
import { Target, Test } from '@meson/meson/types';


/**
 * Prompt for a meson target
 */
export async function targetPrompt(targetType?: string) {
    let items = []
    if (!targetType) {
        items.push(
            {
                label: "all",
                detail: "Build all targets",
                description: "(meta-target)",
                picked: true
            });
    }
    items.push(
        ...gExtManager.projectStructure.targets.filter(t => {
            return !targetType || (t.type == targetType);
        }).map<vscode.QuickPickItem>(t => ({
            label: t.name,
            detail: path.relative(gExtManager.projectRoot, t.filename[0]),
            description: t.type,
            picked: false
        })));
    const picker = vscode.window.createQuickPick();
    picker.busy = true;
    picker.placeholder =
        "Select target to build. Defaults to all targets";
    picker.show();
    picker.items = items;
    picker.busy = false;
    return new Promise<Target | null>((resolve, reject) => {
        let active = undefined;
        let accepted = false;
        picker.onDidChangeActive(() => {
            active = picker.activeItems[0];
        });
        picker.onDidAccept(() => {
            accepted = true;
            picker.dispose();
            const selected = gExtManager.projectStructure.targets.filter(t => active.label == t.name)[0] || null
            resolve(selected);
        });
        picker.onDidHide(() => {
            if (!accepted) {
                reject()
            }
        });
    });
}

/**
 * Prompt for a meson test
 */
export async function testPrompt() {
    const items = [
        {
          label: "all",
          detail: "Run all tests",
          description: "(meta-target)",
          picked: true
        },
        ...gExtManager.projectStructure.tests.map<vscode.QuickPickItem>(t => ({
            label: t.name,
              detail: `Test timeout: ${t.timeout}s, ${t.is_parallel ? "Run in parallel" : "Run serially"
            }`,
            description: t.suite.join(","),
            picked: false
        })),
        ...gExtManager.projectStructure.benchmarks.map<vscode.QuickPickItem>(b => ({
          label: b.name,
          detail: `Benchmark timeout: ${b.timeout
            }s, benchmarks always run serially`,
          description: b.suite.join(","),
          picked: false
        }))
    ];
    const picker = vscode.window.createQuickPick();
    picker.busy = true;
    picker.placeholder =
        "Select test to execute. Defaults to all";
    picker.show();
    picker.items = items;
    picker.busy = false;
    return new Promise<Test | null>((resolve, reject) => {
        let active = undefined;
        let accepted = false;
        picker.onDidChangeActive(() => {
            active = picker.activeItems[0];
        });
        picker.onDidAccept(() => {
            accepted = true;
            picker.dispose();
            const selected = gExtManager.projectStructure.tests.filter(t => active.label == t.name)[0] ||
                gExtManager.projectStructure.benchmarks.filter(t => active.label == t.name)[0] ||
                null;
            resolve(selected);
        });
        picker.onDidHide(() => {
            if (!accepted) {
                reject()
            }
        });
    });
}
