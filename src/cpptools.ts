import { Uri, CancellationToken } from 'vscode';
import * as cpt from 'vscode-cpptools';
import { gExtManager } from './extension';

export class CppConfigurationProvider implements cpt.CustomConfigurationProvider {
    readonly name: string = "meson";
    readonly extensionId: string = "vscode.meson";

    async canProvideConfiguration() { return true; }

    provideConfigurations(uris: Uri[], token?: CancellationToken): Thenable<cpt.SourceFileConfigurationItem[]> {
        return {
            then: (accept, reject) => {
                return reject;
            }
        }
    }

    async canProvideBrowseConfiguration() { return false; }

    provideBrowseConfiguration(token?: CancellationToken): Thenable<cpt.WorkspaceBrowseConfiguration> {
        throw new Error('Method not implemented.');
    }

    async canProvideBrowseConfigurationsPerFolder() { return false; }

    private readonly workspaceBrowseConfigurations = new Map<string, cpt.WorkspaceBrowseConfiguration>();

    provideFolderBrowseConfiguration(uri: Uri, token?: CancellationToken): Thenable<cpt.WorkspaceBrowseConfiguration> {
        // let config = new cpt.WorkspaceBrowseConfiguration()
        // gExtManager.explorer.
        // gExtManager.projectStructure.root

        throw new Error('Method not implemented.');
    }

    dispose() {
        console.log("Meson's cpptools is gone :/");
    }
}
