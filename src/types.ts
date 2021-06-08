export interface ExtensionConfiguration {
  configureOnOpen: boolean;
  configureOptions: string[];
  buildFolder: string;
  mesonPath: string;
  ninjaPath: string;
  filepathWorkaround: boolean;
}
