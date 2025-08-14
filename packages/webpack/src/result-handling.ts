/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type TscArguments } from "@quatico/websmith-api";
import { type CompileFragment } from "@quatico/websmith-core";
import fs from "node:fs";
import path from "node:path";
import type ts from "typescript";
import { type LoaderContext } from "webpack";
import { getCompilerInstance } from "./compiler-instances";
import { getLoaderOptions } from "./loader-options";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

type TsConfig = {
    extends?: string;
    compilerOptions?: TscArguments;
    references?: {
        path: string;
        configPath: string;
        prepend: boolean;
    }[];
    include?: string[];
    exclude?: string[];
    files?: string[];
};

/**
 * Comprehensive TypeScript configuration analyzer that supports:
 * - tsconfig extends inheritance
 * - Complex include/exclude patterns
 * - Path mapping from tsconfig paths
 * - Project references for monorepos
 * - Multiple source directories
 */
class TsConfigAnalyzer {
    private configCache = new Map<string, TsConfig>();

    /**
     * Analyzes a tsconfig.json file and returns comprehensive configuration info
     */
    analyzeConfig(configFilePath: string): TsConfigAnalysis {
        try {
            const resolvedConfig = this.resolveConfigWithInheritance(configFilePath);
            const projectDir = path.dirname(configFilePath);

            return {
                projectDir,
                configFilePath,
                rootDirs: this.inferRootDirectories(resolvedConfig, projectDir),
                pathMappings: this.extractPathMappings(resolvedConfig, projectDir),
                projectReferences: this.extractProjectReferences(resolvedConfig, projectDir),
                sourceDirectories: this.analyzeSourceDirectories(resolvedConfig, projectDir),
                outputDirectory: this.resolveOutputDirectory(resolvedConfig, projectDir),
            };
        } catch (_error) {
            // Fallback to basic analysis
            return {
                projectDir: path.dirname(configFilePath),
                configFilePath,
                rootDirs: [],
                pathMappings: {},
                projectReferences: [],
                sourceDirectories: [],
                outputDirectory: undefined,
            };
        }
    }

    /**
     * Resolves tsconfig.json with full extends inheritance chain
     */
    private resolveConfigWithInheritance(configFilePath: string): TsConfig {
        if (this.configCache.has(configFilePath)) {
            return this.configCache.get(configFilePath) as TsConfig;
        }

        const configContent = fs.readFileSync(configFilePath, "utf8");
        const config = JSON.parse(configContent);
        const projectDir = path.dirname(configFilePath);

        let resolvedConfig = { ...config };

        // Handle extends inheritance
        if (config.extends) {
            const extendsPath = this.resolveExtendsPath(config.extends, projectDir);
            if (extendsPath && fs.existsSync(extendsPath)) {
                const parentConfig = this.resolveConfigWithInheritance(extendsPath);
                resolvedConfig = this.mergeConfigs(parentConfig, config);
            }
        }

        this.configCache.set(configFilePath, resolvedConfig);
        return resolvedConfig;
    }

    /**
     * Resolves extends path (supports npm packages and relative paths)
     */
    private resolveExtendsPath(extendsValue: string, projectDir: string): string | undefined {
        try {
            if (extendsValue.startsWith("./") || extendsValue.startsWith("../")) {
                // Relative path
                return path.resolve(projectDir, extendsValue);
            } else {
                // npm package or absolute path
                if (extendsValue.startsWith("@")) {
                    // Scoped package
                    return require.resolve(extendsValue, { paths: [projectDir] });
                } else {
                    // Regular package or built-in config
                    return require.resolve(extendsValue, { paths: [projectDir] });
                }
            }
        } catch (_error) {
            return undefined;
        }
    }

    /**
     * Merges parent and child configs with proper precedence
     */
    private mergeConfigs(parent: TsConfig, child: TsConfig): TsConfig {
        const merged = { ...parent };

        // Merge compilerOptions
        if (child.compilerOptions) {
            merged.compilerOptions = {
                ...parent.compilerOptions,
                ...child.compilerOptions,
            };

            // Special handling for paths - merge rather than replace
            if (parent.compilerOptions?.paths && child.compilerOptions?.paths) {
                merged.compilerOptions.paths = {
                    ...parent.compilerOptions.paths,
                    ...child.compilerOptions.paths,
                };
            }
        }

        // Merge arrays (include, exclude, files)
        ["include", "exclude", "files"].forEach(key => {
            if (child[key as keyof TsConfig]) {
                // @ts-expect-error - key is a valid key of TsConfig
                merged[key] = child[key]; // Child overrides parent for these
            }
        });

        // Merge project references
        if (child.references) {
            merged.references = [...(parent.references || []), ...child.references];
        }

        return merged;
    }

    /**
     * Infers root directories from include patterns and compilerOptions.rootDirs
     */
    private inferRootDirectories(config: TsConfig, projectDir: string): string[] {
        const rootDirs = new Set<string>();

        // Add explicit rootDirs from compilerOptions
        if (config.compilerOptions?.rootDirs) {
            config.compilerOptions.rootDirs.forEach((dir: string) => {
                rootDirs.add(path.resolve(projectDir, dir));
            });
        }

        // Add explicit rootDir from compilerOptions
        if (config.compilerOptions?.rootDir) {
            rootDirs.add(path.resolve(projectDir, config.compilerOptions.rootDir));
        }

        // Infer from include patterns
        const inferredFromIncludes = this.inferFromIncludePatterns(config.include || [], projectDir);
        // If we have multiple include patterns, find the common parent directory
        if (inferredFromIncludes.length > 1) {
            const commonParent = this.findCommonParentDirectory(inferredFromIncludes);
            if (commonParent) {
                rootDirs.add(commonParent);
            }
        } else {
            // Single include pattern or no patterns - use individual directories
            inferredFromIncludes.forEach(dir => rootDirs.add(dir));
        }

        return Array.from(rootDirs).filter(dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
    }

    /**
     * Analyzes include patterns to find source directories (supports complex patterns)
     */
    private inferFromIncludePatterns(includePatterns: string[], projectDir: string): string[] {
        const sourceDirs = new Set<string>();

        for (const pattern of includePatterns) {
            if (typeof pattern !== "string") {
                continue;
            }

            // Handle complex patterns like:
            // "src/**/*", "lib/**/*.ts", "packages/*/src/**/*", "apps/{web,mobile}/src/**/*"
            const normalizedPattern = pattern.replace(/^\.\//, "");

            // Extract base directories before wildcards
            const beforeWildcard = normalizedPattern.split(/[*{]/)[0];

            if (beforeWildcard) {
                const cleanPath = beforeWildcard.replace(/\/$/, ""); // Remove trailing slash
                if (cleanPath && cleanPath !== ".") {
                    // For patterns like "packages/*/src", we want to find the common parent
                    const pathParts = cleanPath.split("/");
                    for (let i = pathParts.length; i > 0; i--) {
                        const partialPath = pathParts.slice(0, i).join("/");
                        if (partialPath) {
                            const candidatePath = path.resolve(projectDir, partialPath);
                            if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
                                sourceDirs.add(candidatePath);
                                break;
                            }
                        }
                    }
                }
            }
        }

        return Array.from(sourceDirs);
    }

    /**
     * Extracts and resolves path mappings from tsconfig paths
     */
    private extractPathMappings(config: TsConfig, projectDir: string): Record<string, string[]> {
        const pathMappings: Record<string, string[]> = {};
        const paths = config.compilerOptions?.paths;
        const baseUrl = config.compilerOptions?.baseUrl || ".";

        if (paths && typeof paths === "object") {
            Object.entries(paths).forEach(([pattern, mappings]) => {
                if (Array.isArray(mappings)) {
                    pathMappings[pattern] = mappings.map((mapping: string) => path.resolve(projectDir, baseUrl, mapping));
                }
            });
        }

        return pathMappings;
    }

    /**
     * Extracts project references for monorepo support
     */
    private extractProjectReferences(config: TsConfig, projectDir: string): ProjectReference[] {
        const references: ProjectReference[] = [];

        if (config.references && Array.isArray(config.references)) {
            config.references.forEach((ref: ProjectReference) => {
                if (ref.path) {
                    const refPath = path.resolve(projectDir, ref.path);
                    const refConfigPath = fs.existsSync(path.join(refPath, "tsconfig.json")) ? path.join(refPath, "tsconfig.json") : refPath;

                    references.push({
                        path: refPath,
                        configPath: refConfigPath,
                        prepend: ref.prepend || false,
                    });
                }
            });
        }

        return references;
    }

    /**
     * Analyzes all source directories from various sources
     */
    private analyzeSourceDirectories(config: TsConfig, projectDir: string): SourceDirectory[] {
        const directories: SourceDirectory[] = [];
        const rootDirs = this.inferRootDirectories(config, projectDir);

        rootDirs.forEach(rootDir => {
            const relativePath = path.relative(projectDir, rootDir);
            directories.push({
                absolutePath: rootDir,
                relativePath: relativePath || ".",
                isRoot: relativePath === "" || relativePath === ".",
            });
        });

        return directories;
    }

    /**
     * Resolves the output directory from compilerOptions.outDir
     */
    private resolveOutputDirectory(config: TsConfig, projectDir: string): string | undefined {
        const outDir = config.compilerOptions?.outDir;
        return outDir ? path.resolve(projectDir, outDir) : undefined;
    }
    /**
     * Finds the common parent directory for multiple source directories
     */
    private findCommonParentDirectory(directories: string[]): string | undefined {
        if (directories.length === 0) {
            return undefined;
        }
        if (directories.length === 1) {
            return directories[0];
        }

        // Normalize all paths to use consistent separators
        const normalizedPaths = directories.map(dir => path.resolve(dir).split(path.sep));

        // Find the shortest path to limit our search
        const minLength = Math.min(...normalizedPaths.map(parts => parts.length));

        // Find common path parts from the beginning
        const commonParts: string[] = [];
        for (let i = 0; i < minLength; i++) {
            const currentPart = normalizedPaths[0][i];
            const allMatch = normalizedPaths.every(parts => parts[i] === currentPart);

            if (allMatch) {
                commonParts.push(currentPart);
            } else {
                break;
            }
        }

        if (commonParts.length === 0) {
            return undefined;
        }

        const commonParent = commonParts.join(path.sep);

        // Verify the common parent exists and is a directory
        if (fs.existsSync(commonParent) && fs.statSync(commonParent).isDirectory()) {
            return commonParent;
        }

        return undefined;
    }
}

// Type definitions for the analyzer
interface TsConfigAnalysis {
    projectDir: string;
    configFilePath: string;
    rootDirs: string[];
    pathMappings: Record<string, string[]>;
    projectReferences: ProjectReference[];
    sourceDirectories: SourceDirectory[];
    outputDirectory?: string;
}

interface ProjectReference {
    path: string;
    configPath: string;
    prepend: boolean;
}

interface SourceDirectory {
    absolutePath: string;
    relativePath: string;
    isRoot: boolean;
}

// Create a singleton instance
const tsConfigAnalyzer = new TsConfigAnalyzer();

// Export the analyzer class for advanced usage and testing
export { TsConfigAnalyzer };
export type { ProjectReference, SourceDirectory, TsConfigAnalysis };

// The comprehensive TsConfigAnalyzer above replaces the simple inferRootDirFromTsConfig function

export const makeSourceMap = (outputText: string, sourceMapText?: string) => {
    return {
        output: outputText.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ""),
        ...(!!sourceMapText && { sourceMap: JSON.parse(sourceMapText) }),
    };
};

export const processResultAndFinish = (context: LoaderContext<WebsmithLoaderConfig>, fragment: CompileFragment, profile?: string) => {
    const outputText = fragment.files.find((cur: ts.OutputFile) => cur.name.match(/\.jsx?$/i))?.text;
    const sourceMapText = fragment.files.find((cur: ts.OutputFile) => cur.name.match(/\.jsx?\.map$/i))?.text;

    if (!outputText) {
        const message = `No processed output found for "${context.resourcePath}"`;
        return context.callback(new Error(profile ? `${message} with profile "${profile}"` : message));
    } else {
        const { output, sourceMap } = makeSourceMap(outputText, sourceMapText);

        // Emit additional files (like declaration files) with proper naming to avoid conflicts
        fragment.files.forEach(file => {
            if (!file.name.match(/\.jsx?$/i) && !file.name.match(/\.jsx?\.map$/i)) {
                emitAdditionalFile(context, file);
            }
        });

        context.callback(null, output, sourceMap);
    }
};

const emitAdditionalFile = (context: LoaderContext<WebsmithLoaderConfig>, file: ts.OutputFile) => {
    if (!file.text) {
        return;
    }

    // Helper function to find the best matching root directory for a source file
    const findBestRootDir = (sourceFilePath: string, analysis: TsConfigAnalysis): string | undefined => {
        // Find the root directory that contains this source file and is the most specific
        let bestMatch: string | undefined;
        let bestMatchDepth = -1;

        for (const rootDir of analysis.rootDirs) {
            if (sourceFilePath.startsWith(rootDir)) {
                const depth = rootDir.split(path.sep).length;
                if (depth > bestMatchDepth) {
                    bestMatch = rootDir;
                    bestMatchDepth = depth;
                }
            }
        }

        return bestMatch;
    };

    // Helper function to resolve paths using tsconfig path mappings
    const resolveWithPathMappings = (sourceFilePath: string, analysis: TsConfigAnalysis): string => {
        const relativePath = path.relative(analysis.projectDir, sourceFilePath);

        // Try to match against path mappings
        for (const [pattern, mappings] of Object.entries(analysis.pathMappings)) {
            const regexPattern = pattern.replace(/\*/g, "(.*)");
            const regex = new RegExp(`^${regexPattern}$`);
            const match = relativePath.match(regex);

            if (match && mappings.length > 0) {
                // Use the first mapping and substitute wildcards
                let resolvedPath = mappings[0];
                for (let i = 1; i < match.length; i++) {
                    resolvedPath = resolvedPath.replace("*", match[i]);
                }
                return path.resolve(analysis.projectDir, resolvedPath);
            }
        }

        return sourceFilePath; // No mapping found
    };

    // TypeScript provides fully qualified paths that preserve directory structure
    // when rootDir is properly configured. We can use these paths directly.
    //
    // TypeScript generates absolute paths like:
    // /path/to/project/dist/moduleA/index.d.ts
    // /path/to/project/dist/moduleB/index.d.ts
    //
    // We need to extract the relative path from the output directory:
    // moduleA/index.d.ts
    // moduleB/index.d.ts

    let fileName = file.name;

    try {
        // Get compiler options directly from the context
        const loaderOptions = getLoaderOptions(context);
        const compilerInstance = getCompilerInstance(loaderOptions, context);
        const compilerOptions = compilerInstance.getOptions();
        const compilerOutDir = compilerOptions.tsConfig?.outDir;
        const compilerRootDir = compilerOptions.tsConfig?.rootDir;
        const configFilePath = compilerOptions.cliArgs?.raw?.configFilePath || compilerOptions.tsConfigFile;

        // Extract the relative path from the TypeScript output path
        // TypeScript provides full absolute paths, we just need to make them relative to outDir
        const outputFileName = path.basename(file.name);
        const outputDir = path.dirname(file.name);

        if (compilerOutDir) {
            // Use the compiler's actual outDir to calculate the relative path
            const relativePath = path.relative(compilerOutDir, outputDir);

            // If we get flattened paths (no directory structure preserved),
            // use comprehensive tsconfig analysis for intelligent path resolution
            if ((!relativePath || relativePath === ".") && !compilerRootDir && configFilePath) {
                const analysis = tsConfigAnalyzer.analyzeConfig(configFilePath);
                const sourceFilePath = context.resourcePath;

                // Try to find the best matching root directory for this source file
                const bestRootDir = findBestRootDir(sourceFilePath, analysis);

                if (bestRootDir) {
                    const sourceRelativePath = path.relative(bestRootDir, path.dirname(sourceFilePath));
                    if (sourceRelativePath && sourceRelativePath !== "." && !sourceRelativePath.startsWith("..")) {
                        fileName = path.join(sourceRelativePath, outputFileName);
                    } else {
                        fileName = outputFileName;
                    }
                } else {
                    // Fallback: try path mapping resolution
                    const resolvedPath = resolveWithPathMappings(sourceFilePath, analysis);
                    if (resolvedPath !== sourceFilePath) {
                        const mappedRelativePath = path.relative(analysis.projectDir, path.dirname(resolvedPath));
                        fileName = mappedRelativePath ? path.join(mappedRelativePath, outputFileName) : outputFileName;
                    } else {
                        fileName = outputFileName;
                    }
                }
            } else if (relativePath && relativePath !== ".") {
                // Preserve the directory structure: moduleA/index.d.ts
                fileName = path.join(relativePath, outputFileName);
            } else {
                // No subdirectory or same directory, use just the filename
                fileName = outputFileName;
            }
        } else {
            // If no outDir is available (rare case), fall back to just the filename
            fileName = outputFileName;
        }
    } catch (_error) {
        // Fallback to original filename on any error
        fileName = path.basename(file.name);
    }

    context.emitFile(fileName, file.text);
};
