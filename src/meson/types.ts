type Dict<T> = { [x: string]: T };

export type LanguageID = string;
export type TargetType =
  | "executable"
  | "static library"
  | "shared library"
  | "shared module"
  | "custom"
  | "run"
  | "jar";
export type OptionType = "string" | "boolean" | "combo" | "integer" | "array";
export interface OptionTypeMap {
  string: string;
  boolean: boolean;
  combo: string[];
  integer: number;
  array: string[];
}
export type SectionType =
  | "core"
  | "backend"
  | "base"
  | "compiler"
  | "directory"
  | "user"
  | "test";
export interface TargetSource {
  language: LanguageID;
  compiler: string[];
  parameters: string[];
  sources: string[];
  generated_sources: string[];
}
export interface Target {
  name: string;
  id: string;
  type: TargetType;
  defined_in: string;
  extra_files?: string[];
  subproject: string | null;
  filename: string[];
  build_by_default: boolean;
  target_sources?: TargetSource[];
  installed: boolean;
  install_filename?: string;
}

export interface BaseProject {
  name: string;
  version: string;
  descriptive_name: string;
}

export interface Subproject extends BaseProject {
}

export interface ProjectInfo extends BaseProject {
  subproject_dir: "subprojects";
  subprojects: Subproject[];
}

export interface BuildOption<T extends OptionType> {
  name: string;
  desciption: string;
  type: T;
  value: OptionTypeMap[T];
}
export interface Dependency {
  name: string;
  required: boolean;
  conditional: boolean;
  has_fallback: boolean;
}
export interface Test {
  name: string;
  workdir?: string;
  timeout: string;
  suite: string[];
  is_parallel: boolean;
  cmd: string[];
  env: Dict<string>;
  priority?: number
  depends?: string[];
}

export type Targets = Target[];
export type BuildOptions = BuildOption<any>[];
export type Dependencies = Dependency[];
export type Tests = Test[];
