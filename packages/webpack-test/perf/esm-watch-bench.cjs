/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable no-console */
/**
 * Manual benchmark of the ESM check's cost on webpack watch rebuilds, not run in CI: timing noise on shared runners
 * exceeds the 10% budget. Build websmith first (`pnpm build`), then run `pnpm perf:esm` in packages/webpack-test.
 *
 * Generates a project of `--modules` TypeScript modules in a temp directory: a binary import tree, about 10% of the
 * modules changed by a processor or a transformer addon, `"type": "module"` and a few nested package.json files. Every
 * variant compiles the webpack target and a dependent profile writing to lib/, so they differ in the ESM check only:
 *   A  no `esm`
 *   B  `esm: { runtime: "bundler" }` on the webpack target
 *   C  `esm: { runtime: "node" }` on the dependent profile
 * Each process watches one variant and times, from the write to webpack's `done`, `--edits` edits of different leaf
 * modules and `--flips` flips of `"type"` in the project's package.json. Variants run interleaved in `--processes`
 * processes each. The gate is median(B or C) / median(A) <= 1.10 per scenario, on the medians of each process.
 * The time spent in the loader's ESM check is measured in-process and printed per scenario.
 *
 * Options: --processes 5 --modules 1000 --edits 30 --flips 5 --settle 300 --keep
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const VARIANTS = ["A", "B", "C"];
const BUDGET = 1.1;
const ADDON_MARKER = "bench-addon";

const parseOptions = argv => {
    const options = { processes: 5, modules: 1000, edits: 30, flips: 5, settle: 300, keep: false };
    for (let i = 0; i < argv.length; i++) {
        const name = argv[i].replace(/^--/, "");
        if (name === "keep") {
            options.keep = true;
        } else if (name in options) {
            options[name] = Number(argv[++i]);
        } else if (name !== "child") {
            throw new Error(`Unknown option "${argv[i]}"`);
        }
    }
    return options;
};

const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// ---------------------------------------------------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------------------------------------------------

const moduleDir = index => `d${index % 10}`;
const moduleFile = index => `${moduleDir(index)}/m${index}.ts`;

const writeFile = (fileName, content) => {
    fs.mkdirSync(path.dirname(fileName), { recursive: true });
    fs.writeFileSync(fileName, content);
};

const createModuleSource = (index, count, revision = 0) => {
    const children = [2 * index + 1, 2 * index + 2].filter(cur => cur < count);
    const imports = children.map(cur => `import { value${cur}, Service${cur} } from "../${moduleFile(cur).replace(/\.ts$/, ".js")}";`);
    const marker = index % 10 === 3 ? `// ${ADDON_MARKER}\n` : "";
    return `${marker}${imports.join("\n")}

export interface Shape${index} {
    id: number;
    label: string;
    children: Shape${index}[];
}

export class Service${index} {
    private readonly cache = new Map<number, Shape${index}>();

    public async load(id: number): Promise<Shape${index}> {
        const cached = this.cache.get(id);
        if (cached) {
            return cached;
        }
        const shape: Shape${index} = { id, label: \`shape-\${id}-${revision}\`, children: [] };
        this.cache.set(id, shape);
        return shape;
    }
}

export const value${index}: number = ${index + revision}${children.map(cur => ` + value${cur}`).join("")};
export const services${index} = [new Service${index}()${children.map(cur => `, new Service${cur}()`).join("")}];
`;
};

const ADDONS = {
    "bench-processor/addon.ts": `
        export const activate = (ctx: any): void => {
            ctx.registerProcessor((_fileName: string, content: string) =>
                content.includes("${ADDON_MARKER}") ? content.replace(/shape-/g, "processed-shape-") : content
            );
        };
    `,
    "bench-transformer/addon.ts": `
        import ts from "typescript";
        export const activate = (ctx: any): void => {
            ctx.registerTransformer({
                before: [
                    () => (file: ts.SourceFile) =>
                        file.text.includes("${ADDON_MARKER}")
                            ? ts.factory.updateSourceFile(file, [
                                  ...file.statements,
                                  ts.factory.createExpressionStatement(ts.factory.createStringLiteral("transformed")),
                              ])
                            : file,
                ],
            });
        };
    `,
};

const writeFixture = (projectDir, count) => {
    const sourceDir = path.join(projectDir, "src");
    for (let index = 0; index < count; index++) {
        writeFile(path.join(sourceDir, moduleFile(index)), createModuleSource(index, count));
    }
    writeFile(path.join(sourceDir, "index.ts"), `export { value0, services0 } from "./${moduleFile(0).replace(/\.ts$/, ".js")}";\n`);
    writeFile(path.join(projectDir, "package.json"), JSON.stringify({ name: "esm-bench", type: "module" }));
    // Nested package.json files in a few directories of the dependent profile's output
    ["d2", "d5", "d8"].forEach(dir => writeFile(path.join(projectDir, "lib", dir, "package.json"), JSON.stringify({ type: "module" })));
    writeFile(
        path.join(projectDir, "tsconfig.json"),
        JSON.stringify({
            compilerOptions: { target: "es2022", module: "esnext", moduleResolution: "bundler", rootDir: "src", outDir: "tsout", strict: true },
        })
    );
    Object.entries(ADDONS).forEach(([fileName, content]) => writeFile(path.join(projectDir, "addons", fileName), content));
    // The transformer addon imports typescript, which the temp directory resolves through this link
    const typescriptDir = path.dirname(require.resolve("typescript/package.json"));
    fs.mkdirSync(path.join(projectDir, "node_modules"), { recursive: true });
    fs.symlinkSync(typescriptDir, path.join(projectDir, "node_modules", "typescript"), "dir");
};

const writeVariantConfig = (projectDir, variant) => {
    const profiles = {
        target: { depends: ["node"], tsConfig: { outDir: path.join(projectDir, "tsout") }, ...(variant === "B" && { esm: { runtime: "bundler" } }) },
        node: { tsConfig: { outDir: path.join(projectDir, "lib") }, ...(variant === "C" && { esm: { runtime: "node" } }) },
    };
    const config = { addonsDir: path.join(projectDir, "addons"), addons: Object.keys(ADDONS).map(cur => path.dirname(cur)), profiles };
    writeFile(path.join(projectDir, `websmith.${variant}.config.json`), JSON.stringify(config));
};

// ---------------------------------------------------------------------------------------------------------------------
// Child: one watch process of one variant
// ---------------------------------------------------------------------------------------------------------------------

const runChild = ({ projectDir, variant, count, edits, flips, settle }) => {
    const loaderDir = path.dirname(require.resolve("websmith-loader"));
    const { TsCompiler } = require(path.join(loaderDir, "TsCompiler"));
    const webpack = require("webpack");

    // Accumulates the time spent in the loader's ESM check, in-process
    let checkTime = 0;
    const checkLoaderOutput = TsCompiler.prototype.checkLoaderOutput;
    TsCompiler.prototype.checkLoaderOutput = function (...args) {
        const start = process.hrtime.bigint();
        try {
            return checkLoaderOutput.apply(this, args);
        } finally {
            checkTime += Number(process.hrtime.bigint() - start) / 1e6;
        }
    };

    const compiler = webpack({
        mode: "development",
        devtool: false,
        target: "node",
        context: projectDir,
        entry: { main: "./src/index.ts" },
        output: { path: path.join(projectDir, "dist") },
        resolve: { extensions: [".ts", ".js"], extensionAlias: { ".js": [".ts", ".js"] } },
        infrastructureLogging: { level: "error" },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: [
                        {
                            loader: require.resolve("websmith-loader"),
                            options: {
                                transpileOnly: true,
                                tsConfigFile: path.join(projectDir, "tsconfig.json"),
                                configFile: path.join(projectDir, `websmith.${variant}.config.json`),
                                profile: "target",
                            },
                        },
                    ],
                },
            ],
        },
    });

    // Leaves have no imports: the second half of the binary tree
    const leaves = Array.from({ length: edits }, (_, i) => Math.floor(count / 2) + ((i * 7) % Math.floor(count / 2)));
    const packageJson = path.join(projectDir, "package.json");
    const actions = [
        ...leaves.map((leaf, i) => ({
            scenario: "edit",
            run: () => fs.writeFileSync(path.join(projectDir, "src", moduleFile(leaf)), createModuleSource(leaf, count, i + 1)),
        })),
        ...Array.from({ length: flips }, (_, i) => ({
            scenario: "flip",
            run: () => fs.writeFileSync(packageJson, JSON.stringify({ name: "esm-bench", type: i % 2 === 0 ? "commonjs" : "module" })),
        })),
    ];
    const results = { variant, initial: undefined, edit: [], flip: [], unchanged: { edit: 0, flip: 0 } };
    let step = 0;
    let pending;
    let watchdog;
    let next;

    const watching = compiler.watch({ aggregateTimeout: 20 }, (err, stats) => {
        if (err) {
            console.error(err);
            process.exit(2);
        }
        clearTimeout(watchdog);
        const now = performance.now();
        const built = [...stats.compilation.modules].filter(cur => stats.compilation.builtModules.has(cur)).length;
        const sample = { ms: pending ? now - pending.start : stats.endTime - stats.startTime, checkMs: checkTime, built };
        checkTime = 0;
        if (pending) {
            results[pending.scenario].push(sample);
        } else {
            results.initial = sample;
        }
        next();
    });

    next = () => {
        const action = actions[step++];
        if (!action) {
            return watching.close(() => {
                fs.writeFileSync(packageJson, JSON.stringify({ name: "esm-bench", type: "module" }));
                console.log(`BENCH ${JSON.stringify(results)}`);
            });
        }
        setTimeout(() => {
            pending = { scenario: action.scenario, start: performance.now() };
            action.run();
            // A change that triggers no compilation is counted, not timed
            watchdog = setTimeout(() => {
                results.unchanged[action.scenario]++;
                pending = undefined;
                next();
            }, 300000);
        }, settle);
    };
};

// ---------------------------------------------------------------------------------------------------------------------
// Main: interleaved processes and the gate
// ---------------------------------------------------------------------------------------------------------------------

const summarize = (runs, scenario) => {
    const byVariant = Object.fromEntries(
        VARIANTS.map(variant => {
            const processRuns = runs.filter(cur => cur.variant === variant);
            const processMedians = processRuns.map(cur => median(cur[scenario].map(sample => sample.ms)));
            const checkMedians = processRuns.map(cur => median(cur[scenario].map(sample => sample.checkMs)));
            const builtMedians = processRuns.map(cur => median(cur[scenario].map(sample => sample.built)));
            return [variant, { median: median(processMedians), processMedians, checkMs: median(checkMedians), built: median(builtMedians) }];
        })
    );
    return byVariant;
};

const main = () => {
    const options = parseOptions(process.argv.slice(2));
    // The real path: TypeScript expects the file names webpack passes, which resolve symlinks such as macOS' /var
    const projectDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "websmith-esm-bench-")));
    console.log(`Fixture: ${options.modules} modules in ${projectDir}`);
    writeFixture(projectDir, options.modules);
    VARIANTS.forEach(variant => writeVariantConfig(projectDir, variant));

    const runs = [];
    try {
        for (let round = 0; round < options.processes; round++) {
            for (const variant of VARIANTS) {
                // Every process starts from the same outputs and caches
                ["dist", "tsout", ".websmith-cache"].forEach(dir => fs.rmSync(path.join(projectDir, dir), { recursive: true, force: true }));
                const child = { projectDir, variant, count: options.modules, edits: options.edits, flips: options.flips, settle: options.settle };
                const result = spawnSync(process.execPath, [__filename, "--child"], {
                    cwd: projectDir,
                    encoding: "utf-8",
                    env: { ...process.env, ESM_BENCH_CHILD: JSON.stringify(child) },
                    maxBuffer: 64 * 1024 * 1024,
                });
                const line = result.stdout.split("\n").find(cur => cur.startsWith("BENCH "));
                if (!line) {
                    throw new Error(`Variant ${variant} reported no result:\n${result.stdout.slice(-4000)}\n${result.stderr.slice(-4000)}`);
                }
                const run = JSON.parse(line.slice("BENCH ".length));
                runs.push(run);
                console.log(
                    `round ${round + 1} ${variant}: initial ${run.initial.ms.toFixed(0)} ms (check ${run.initial.checkMs.toFixed(0)} ms), ` +
                        `edit median ${median(run.edit.map(cur => cur.ms)).toFixed(1)} ms, flip median ${median(run.flip.map(cur => cur.ms)).toFixed(1)} ms`
                );
            }
        }
    } finally {
        if (!options.keep) {
            fs.rmSync(projectDir, { recursive: true, force: true });
        }
    }

    let passed = true;
    ["edit", "flip"].forEach(scenario => {
        const summary = summarize(runs, scenario);
        console.log(`\nScenario ${scenario} (${scenario === "edit" ? options.edits : options.flips} per process, ${options.processes} processes per variant)`);
        VARIANTS.forEach(variant => {
            const { median: value, processMedians, checkMs, built } = summary[variant];
            const ratio = value / summary.A.median;
            const gated = variant !== "A";
            passed = passed && (!gated || ratio <= BUDGET);
            console.log(
                `  ${variant}: median ${value.toFixed(1)} ms, ratio ${ratio.toFixed(3)}${gated ? (ratio <= BUDGET ? " ok" : " OVER BUDGET") : ""}, ` +
                    `ESM check ${checkMs.toFixed(1)} ms, modules built ${built}, per process [${processMedians.map(cur => cur.toFixed(1)).join(", ")}]`
            );
        });
    });
    console.log(`\nGate median(B or C) / median(A) <= ${BUDGET}: ${passed ? "passed" : "FAILED"}`);
    process.exitCode = passed ? 0 : 1;
};

if (process.env.ESM_BENCH_CHILD) {
    runChild(JSON.parse(process.env.ESM_BENCH_CHILD));
} else {
    main();
}
