import * as vscode from 'vscode';
import { Target } from './meson/types';


abstract class Button {

    protected readonly button: vscode.StatusBarItem;

    constructor(protected readonly priority: number) {
        this.button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, this.priority);
    }

    private _text: string = ''
    get text() { return this._text; }
    set text(text: string) {
        this._text = text;
        this.update();
    }

    private _tooltip?: string = null
    get tooltip() { return this._tooltip; }
    set tooltip(text: string) {
        this._tooltip = text;
        this.update();
    }

    private _icon: string | null = null;
    protected set icon(v: string | null) { this._icon = v ? `$(${v})` : null; }

    protected set command(v: string | null) { this.button.command = v || undefined; }

    dispose(): void { this.button.dispose(); }

    private _getText(icon: boolean = false): string {
        if (this._icon) {
            return `${this._icon} ${this._text}`;
        } else {
            return `${this._text}`;
        }
    }

    update() {
        if (this._text === '') {
            this.button.hide();
        } else {
            const text = this._getText(true);
            if (text === '') {
                this.button.hide();
                return;
            }
            this.button.text = text;
            this.button.tooltip = this._tooltip || undefined;
            this.button.show();
        }
    }
}

class TargetSelectionButton extends Button {
    constructor() {
        super(4);
        this.text = '[all]'
        this.command = 'mesonbuild.selectActiveTarget'
        this.tooltip = 'Set the default build target'
    }
}

class BuildSelectedTargetButton extends Button {
    constructor() {
        super(3);
        this.text = 'Build';
        this.command = 'mesonbuild.build';
        this.tooltip = 'Build selected target';
        this.icon = 'tools';
    }
}

class RunSelectedTargetButton extends Button {
    constructor() {
        super(2);
        this.text = 'Run';
        this.command = 'mesonbuild.run';
        this.tooltip = 'Debug selected target';
        this.icon = 'run';
    }
}

class DebugSelectedTargetButton extends Button {
    constructor() {
        super(1);
        this.text = 'Debug';
        this.command = 'mesonbuild.debug';
        this.tooltip = 'Debug selected target';
        this.icon = 'bug'
    }
}

class TestButton extends Button {
    constructor() {
        super(1);
        this.text = 'Run tests';
        this.command = 'mesonbuild.test';
        this.tooltip = 'Run meson unit tests';
        this.icon = 'test-view-icon'
    }
}

export class StatusBar implements vscode.Disposable {

    private readonly targetSelectionButton = new TargetSelectionButton;
    private readonly buildSelectedTargetButton = new BuildSelectedTargetButton;
    private readonly runSelectedTargetButton = new RunSelectedTargetButton;
    private readonly debugSelectedTargetButton = new DebugSelectedTargetButton;
    private readonly testButton = new TestButton;
    private readonly buttons = [
        this.targetSelectionButton,
        this.buildSelectedTargetButton,
        this.runSelectedTargetButton,
        this.debugSelectedTargetButton,
        this.testButton,
    ];

    constructor() {
        this.update();
    }

    update(): void { this.buttons.forEach(btn => btn.update()); }

    setActiveTarget(target?: Target) {
        if (target) {
            this.targetSelectionButton.text = `[${target.name}]`;
        } else {
            this.targetSelectionButton.text = '[all]';
        }
    }

    dispose() {
    }
}
