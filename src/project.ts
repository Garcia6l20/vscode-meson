import * as path from 'path'

import { getMesonBenchmarks, getMesonBuildFiles, getMesonProjectInfo, getMesonTargets, getMesonTests } from '@meson/meson/introspection'
import { ProjectInfo, Targets, TargetSource, Tests } from '@meson/meson/types'
import { resolveSymlinkPath } from '@meson/utils'

/** @brief Copy interface properties from @a source to @a dest
 * 
 * @param source    Source object
 * @param dest      Destination object
 */
function ifCpy<T, Source extends T, Dest extends T>(source: Source, dest: Dest) {
    const createKeys = (keyRecord: Record<keyof T, any>): (keyof T)[] => {
        return Object.keys(keyRecord) as any
    }
    createKeys(source).forEach(k => {
        dest[k.toString()] = source[k.toString()];
    });
}

class MetaData {
    projectInfos: ProjectInfo
    targets: Targets
    tests: Tests
    benchmarks: Tests
    buildSystemFiles: string[]

    private constructor(public readonly projectRoot: string, public readonly buildDir: string) {
    }

    static async create(projectRoot: string, buildDir: string) {
        let metaData = new MetaData(projectRoot, buildDir);
        [metaData.projectInfos,
        metaData.targets,
        metaData.tests,
        metaData.benchmarks,
        metaData.buildSystemFiles] = await Promise.all([
            getMesonProjectInfo(buildDir),
            getMesonTargets(buildDir),
            getMesonTests(buildDir),
            getMesonBenchmarks(buildDir),
            getMesonBuildFiles(buildDir),
        ]);
        return metaData;
    }
}

class SourceModel implements TargetSource {
    language: string
    compiler: string[]
    parameters: string[]
    sources: string[]
    generated_sources: string[]
}

export class ProjectModel implements ProjectInfo {
    public name: string
    public version: string
    public descriptive_name: string

    public tests: Tests
    public benchmarks: Tests

    public subproject_dir: 'subprojects'
    public subprojects: ProjectModel[]

    public parent?: ProjectModel
    public targets: Targets

    public sourceDir: string
    public buildFile: string
    public buildDir: string

    private resolveBuildFile(meta: MetaData) {
        // get build file
        this.buildFile = meta.buildSystemFiles.filter(p => {
            p = path.dirname(resolveSymlinkPath(this.sourceDir, p))
            return p == this.sourceDir;
        })[0];
        if (!this.buildFile) {
            throw Error(`Failed to resolve build file for project ${this.name}`)
        }
        this.buildFile = resolveSymlinkPath(this.sourceDir, this.buildFile)
    }

    private async resolve(meta: MetaData) {

        this.resolveBuildFile(meta)

        this.targets = meta.targets.filter(t => {
            return (path.dirname(t.defined_in) == path.dirname(this.buildFile)) || (t.subproject == this.name);
        });

        this.tests = meta.tests.filter(t => {
            return t.suite.indexOf(this.name) >= 0;
        });
        this.benchmarks = meta.benchmarks.filter(t => {
            return t.suite.indexOf(this.name) >= 0;
        });

        if (this.subprojects) {
            this.subprojects = this.subprojects.map(p => {
                let model = new ProjectModel();
                ifCpy(p, model);
                return model;
            });

            await Promise.all(this.subprojects.map(async (sp) => {
                return sp.subUpdate(this, meta);
            }));
        }
    }

    private async subUpdate(parent: ProjectModel, meta: MetaData) {
        this.parent = parent;
        this.sourceDir = path.join(parent.sourceDir, parent.subproject_dir, this.name);
        this.buildDir = path.join(parent.buildDir, parent.subproject_dir, this.name);
        return this.resolve(meta);
    }

    async update(projectRoot: string, buildDir: string, meta: MetaData) {
        ifCpy(meta.projectInfos, this);
        if (!this.name) {
            this.name = this.descriptive_name;
        }
        this.sourceDir = projectRoot;
        this.buildDir = buildDir;
        return this.resolve(meta)
    }

    private walkProject(callback: CallableFunction, project?: ProjectModel) {
        if (!project) {
            project = this;
        }
        let output = [];
        output.push(...callback(project));
        project.subprojects?.forEach(sp => {
            output.push(...this.walkProject(callback, sp));
        });
        return output;
    }

    get allTargets(): Targets {
        return this.walkProject(p => {
            return p.targets;
        });
    }

    get allTests(): Tests {
        return this.walkProject(p => {
            return p.tests;
        });
    }

    get allBenchmarks(): Tests {
        return this.walkProject(p => {
            return p.benchmarks;
        });
    }
}

export class ProjectStructure {
    public readonly root: ProjectModel = new ProjectModel()

    private metaData: MetaData

    get targets(): Targets {
        return this.root.allTargets;
    }

    get tests(): Tests {
        return this.root.allTests;
    }

    get benchmarks(): Tests {
        return this.root.allBenchmarks;
    }

    async update(projectRoot: string, buildDir: string) {
        this.metaData = await MetaData.create(projectRoot, buildDir);
        await this.root.update(projectRoot, buildDir, this.metaData);
    }
}
