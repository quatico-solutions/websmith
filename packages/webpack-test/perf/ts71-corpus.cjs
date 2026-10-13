/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/**
 * Seeded corpus generator for ts71-bench.cjs. No side effects on load.
 *
 * A corpus of `size` modules is the 9 webpack-test fixtures (packages/webpack-test/src, copied to fixtures/) plus
 * `size - 9` generated modules under src/, so the size is an exact total. The generated modules form the binary
 * import tree of esm-watch-bench.cjs: module i imports 2i+1 and 2i+2 through relative ".js" specifiers, lives in
 * d<i % 10>/m<i>.ts, and every tenth module (i % 10 === 3) carries the `// bench-addon` marker that the in-process
 * variants' before-transformer reacts to. Each module is filled to a line count drawn from websmith's own source
 * line-count distribution (LINE_COUNTS) with repeated blocks of an interface, a class with a method and exported
 * consts. All draws come from a mulberry32 PRNG seeded with `seed`, never from Math.random, so that the same size and
 * seed give the same files and the same hash on every Node version.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SEED = 20261013;
const ADDON_MARKER = "bench-addon";
const FIXTURES_DIR = path.resolve(__dirname, "..", "src");
const FIXTURE_COUNT = 9;

/**
 * Line counts of the 167 files under packages/*\/src (*.ts and *.tsx, without *.spec.*, *.test.* and *.d.ts) at
 * develop 9dccca77, sorted. Min 2, p25 12, p50 29, p75 81, p90 236, max 1654. Produced by:
 *   find packages/*\/src -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.spec.*' ! -name '*.test.*' ! -name '*.d.ts' | xargs wc -l | grep -v total | awk '{print $1}' | sort -n
 */
// prettier-ignore
const LINE_COUNTS = [
    2, 3, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 11, 11, 11, 11,
    12, 12, 12, 12, 13, 13, 13, 14, 14, 14, 14, 14, 15, 16, 16, 17, 17, 17, 18, 18, 19, 20, 20, 21, 22, 23, 23, 23, 24, 24,
    25, 26, 26, 26, 26, 26, 26, 27, 27, 28, 28, 29, 30, 32, 32, 35, 35, 35, 35, 35, 36, 36, 38, 39, 40, 41, 42, 43, 43, 45,
    47, 50, 50, 53, 54, 55, 56, 58, 58, 60, 61, 62, 63, 63, 63, 65, 67, 68, 70, 72, 73, 76, 79, 80, 81, 82, 83, 84, 85, 85,
    86, 86, 89, 90, 90, 90, 95, 101, 103, 120, 136, 138, 157, 175, 180, 188, 190, 216, 232, 236, 239, 264, 274, 326, 437,
    499, 517, 519, 524, 525, 534, 582, 636, 648, 891, 1318, 1654,
];

const mulberry32 = seed => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const moduleDir = index => `d${index % 10}`;
const moduleFile = index => `${moduleDir(index)}/m${index}.ts`;
const editMarker = (index, revision) => `revision-${index}-${revision}`;

const createBlock = (index, block) => {
    const suffix = block === 0 ? `${index}` : `${index}_${block}`;
    return `
export interface Shape${suffix} {
    id: number;
    label: string;
    children: Shape${suffix}[];
}

export class Service${suffix} {
    private readonly cache = new Map<number, Shape${suffix}>();

    public async load(id: number): Promise<Shape${suffix}> {
        const cached = this.cache.get(id);
        if (cached) {
            return cached;
        }
        const shape: Shape${suffix} = { id, label: \`shape-\${id}-${block}\`, children: [] };
        this.cache.set(id, shape);
        return shape;
    }
}

export const value${suffix}: number = ${index + block};
export const services${suffix} = [new Service${suffix}()];
`;
};

/**
 * Source of generated module `index` in a tree of `count` modules, filled with blocks until it has at least `lines`
 * lines. `revision` marks an edit: the emitted JavaScript of revision r contains editMarker(index, r).
 */
const createModuleSource = (index, count, lines, revision = 0) => {
    const children = [2 * index + 1, 2 * index + 2].filter(cur => cur < count);
    const imports = children.map(cur => `import { value${cur}, Service${cur} } from "../${moduleFile(cur).replace(/\.ts$/, ".js")}";`);
    const marker = index % 10 === 3 ? `// ${ADDON_MARKER}\n` : "";
    const head = `${marker}${imports.join("\n")}
export const revision${index} = "${editMarker(index, revision)}";
export const total${index}: number = ${index}${children.map(cur => ` + value${cur}`).join("")};
export const tree${index} = [${children.map(cur => `new Service${cur}()`).join(", ")}];
`;
    let source = head + createBlock(index, 0);
    for (let block = 1; source.split("\n").length < lines; block++) {
        source += createBlock(index, block);
    }
    return source;
};

const listFiles = dir =>
    fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap(entry => (entry.isDirectory() ? listFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))
        .sort();

const writeFile = (fileName, content) => {
    fs.mkdirSync(path.dirname(fileName), { recursive: true });
    fs.writeFileSync(fileName, content);
};

const fixtureFiles = () => listFiles(FIXTURES_DIR).filter(cur => /\.(ts|tsx)$/.test(cur));

/**
 * Writes the corpus into `dir` (which must exist) and returns its absolute file paths, the marker files and the
 * sha256 over the sorted relative paths and contents. Writing twice into the same directory restores every file.
 */
const writeCorpus = (dir, { size, seed = DEFAULT_SEED } = {}) => {
    if (!Number.isInteger(size) || size < FIXTURE_COUNT) {
        throw new Error(`Corpus size must be an integer of at least ${FIXTURE_COUNT} (the fixtures), got ${size}`);
    }
    const fixtures = fixtureFiles();
    if (fixtures.length !== FIXTURE_COUNT) {
        throw new Error(`Expected ${FIXTURE_COUNT} fixtures in ${FIXTURES_DIR}, found ${fixtures.length}`);
    }
    const random = mulberry32(seed);
    const count = size - FIXTURE_COUNT;
    const entries = [];
    fixtures.forEach(fixture => {
        const relative = path.join("fixtures", path.relative(FIXTURES_DIR, fixture));
        entries.push({ relative, content: fs.readFileSync(fixture, "utf-8"), marker: false });
    });
    const modules = [];
    for (let index = 0; index < count; index++) {
        const lines = LINE_COUNTS[Math.floor(random() * LINE_COUNTS.length)];
        const relative = path.join("src", moduleFile(index));
        modules.push({ index, lines, file: path.join(dir, relative), marker: index % 10 === 3 });
        entries.push({ relative, content: createModuleSource(index, count, lines, 0), marker: index % 10 === 3 });
    }
    entries.forEach(entry => writeFile(path.join(dir, entry.relative), entry.content));

    const hash = crypto.createHash("sha256");
    [...entries]
        .sort((a, b) => (a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0))
        .forEach(entry => {
            hash.update(entry.relative.split(path.sep).join("/"));
            hash.update("\0");
            hash.update(entry.content);
            hash.update("\0");
        });
    const files = entries.map(entry => path.join(dir, entry.relative));
    const markerFiles = entries.filter(entry => entry.marker).map(entry => path.join(dir, entry.relative));
    return { files, markerFiles, modules, count, hash: hash.digest("hex"), seed, size };
};

module.exports = { ADDON_MARKER, DEFAULT_SEED, FIXTURE_COUNT, LINE_COUNTS, createModuleSource, editMarker, moduleFile, mulberry32, writeCorpus };
