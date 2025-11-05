#!/usr/bin/env node

import { type SpawnOptions, spawn } from "node:child_process";
import { glob, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import type { PackageJSON } from "./PackageJSON.ts";

async function exec(command: string, options: SpawnOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        const p = spawn(command, [], { shell: true, stdio: "inherit", ...options });
        p.on("exit", code => {
            if (code !== 0) {
                reject(new Error(`Command failed with error code ${code}`));
            }
            resolve();
        });
    });
}

const varRegExp = /\$\{(\w+)\}/g;

const projectDir = process.argv[2];
if (projectDir == null) {
    throw new Error("No project name given");
}
const projectName = basename(projectDir);
const templateDir = resolve(import.meta.dirname, "../../template");

const templateVars: Record<string, string> = {
    projectName,
    year: String(new Date().getFullYear())
};

for await (const filename of glob([ "**/*.tmpl", ".*/**/*.tmpl", ".*.tmpl" ], { cwd: templateDir })) {
    const source = await readFile(join(templateDir, filename), "utf-8");
    const replaced = source.replace(varRegExp, (substring, varName: string) => templateVars[varName]);
    const target = join(projectDir, filename.replace(/\.tmpl$/, ""));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, replaced, "utf-8");
}

// Create empty .git directory because oxlint ignores .gitignore when .git is missing
await mkdir(join(projectDir, ".git"), { recursive: true });

const packageJSON = JSON.parse(await readFile(join(projectDir, "package.json"), "utf-8")) as PackageJSON;
const devDependencies = Object.keys(packageJSON.devDependencies ?? {});
const dependencies = Object.keys(packageJSON.dependencies ?? {});

await exec(`npm install -DE ${devDependencies.join(" ")}`, { cwd: projectDir });
await exec(`npm install ${dependencies.join(" ")}`, { cwd: projectDir });
await exec("npm i", { cwd: projectDir });
await exec("npm run test apidoc", { cwd: projectDir });
