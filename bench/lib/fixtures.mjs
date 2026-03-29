import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const FIXTURE_ITEMS = [
  "package.json",
  "src/lang",
  "tests/mil.test.mjs",
  "tests/mil_benchmark.test.mjs",
  "tests/compliance.test.mjs",
  "bench",
];

export async function createFixtureWorkspace({ workspaceRoot, destinationRoot, fixtureName }) {
  const fixtureRoot = path.join(destinationRoot, fixtureName);
  await mkdir(fixtureRoot, { recursive: true });

  for (const item of FIXTURE_ITEMS) {
    const source = path.join(workspaceRoot, item);
    const destination = path.join(fixtureRoot, item);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, force: true });
  }

  return fixtureRoot;
}
