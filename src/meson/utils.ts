import * as fs from "fs";
import { join } from "path";

// TODO: Check if this is the canonical way to check if Meson is configured
export async function checkMesonIsConfigured(dir: string) {
  return (await Promise.all([
    exists(join(dir, "meson-info")),
    exists(join(dir, "meson-private"))
  ])).every(v => v);
}

function exists(path: string) {
  return new Promise<boolean>(res => {
    fs.stat(path, (err, stat) => {
      if (err) {
        res(false);
      } else {
        res(true);
      }
    });
  });
}
