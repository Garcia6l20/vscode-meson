import * as vscode from 'vscode';
import { gExtManager } from './extension';
import { Target } from './meson/types';


/**
 * Prompt for a meson target
 */
export async function targetPrompt() {
    const items = [
        {
            label: "all",
            detail: "Build all targets",
            description: "(meta-target)",
            picked: true
        },
        ...gExtManager.projectStructure.targets.map<vscode.QuickPickItem>(t => ({
            label: t.name,
            //   detail: path.relative(this.projectRoot, path.dirname(t.defined_in)),
            description: t.type,
            picked: false
        }))
    ];
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
