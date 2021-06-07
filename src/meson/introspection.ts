import * as path from "path";
import { types } from "util";
import { workspace } from "vscode";
import { exec, parseJSONFileIfExists, extensionConfiguration, resolveSymlinkPath } from "../utils";
import {
  Targets,
  Dependencies,
  BuildOptions,
  Test,
  Tests,
  ProjectInfo
} from "./types";

const MESON_VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)/g;

async function introspect<T>(t: string, build: string) {
  const parsed = await parseJSONFileIfExists<T>(
    path.join(build, `meson-info/intro-${t}.json`)
  );
  if (parsed) {
    return parsed;
  } else {
    const { stdout } = await exec(`${extensionConfiguration("mesonPath")} introspect --${t}`, { cwd: build });
    return JSON.parse(stdout) as T;
  }
}

export async function getMesonTargets(build: string) {
  let parsed = await introspect<Targets>("targets", build);

  if (getMesonVersion()[1] < 50) {
    return parsed.map(t => {
      if (typeof t.filename === "string") t.filename = [t.filename]; // Old versions would directly pass a string with only 1 filename on the target
      return t;
    });
  }
  const root = workspace.workspaceFolders[0].uri.path;
  let adapt = (p) => {
    const bname = path.basename(p);
    const dname = path.dirname(p);
    return path.join(resolveSymlinkPath(root, dname), bname);
  };
  parsed = parsed.map(t => {
    t.defined_in = adapt(t.defined_in);
    t.extra_files.map(adapt);
    t.filename = t.filename.map(adapt);
    t.target_sources.map(s => {
      s.generated_sources.map(adapt);
      s.sources.map(adapt);
    });
    return t;
  });
  return parsed;
}

export async function getMesonExecutables(build: string) {
  return (await getMesonTargets(build)).filter(t => { return t.type == "executable"; });
}

export async function getMesonBuildFiles(build: string) {
  return introspect<string[]>("buildsystem_files", build);
}

export async function getMesonBuildOptions(build: string) {
  return introspect<BuildOptions>("buildoptions", build);
}

export async function getMesonProjectInfo(build: string) {
  return introspect<ProjectInfo>("projectinfo", build);
}

export async function getMesonDependencies(build: string) {
  return introspect<Dependencies>("dependencies", build);
}

export async function getMesonTests(build: string) {
  return await introspect<Tests>("tests", build);
}

export async function getMesonBenchmarks(build: string) {
  return await introspect<Tests>("benchmarks", build);
}

export async function getMesonVersion(): Promise<[number, number, number]> {
  const { stdout } = await exec(`${extensionConfiguration("mesonPath")} --version`, {});
  const match = stdout.trim().match(MESON_VERSION_REGEX);
  if (match) {
    return match.slice(1, 3).map(s => Number.parseInt(s)) as [
      number,
      number,
      number
    ];
  } else
    throw new Error(
      "Meson version doesn't match expected output: " + stdout.trim()
    );
}
