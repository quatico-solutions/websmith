/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { build } from "vite";
import { websmithPlugin } from "../src/plugin";

// Create a temporary test directory
const TEST_DIR = path.resolve(__dirname, "../temp-test-complex");
const SRC_DIR = path.join(TEST_DIR, "src");
const DIST_DIR = path.join(TEST_DIR, "dist");

describe("TypeScript transformation with websmith plugin", () => {
    beforeAll(() => {
        // Create test project structure
        if (!fs.existsSync(TEST_DIR)) {
            fs.mkdirSync(TEST_DIR, { recursive: true });
        }
        if (!fs.existsSync(SRC_DIR)) {
            fs.mkdirSync(SRC_DIR, { recursive: true });
        }
        
        // Create a more complex TypeScript file with interfaces, generics, etc.
        fs.writeFileSync(
            path.join(SRC_DIR, "model.ts"),
            `
export interface Person {
    id: string;
    name: string;
    age: number;
    address?: Address;
}

export interface Address {
    street: string;
    city: string;
    zipCode: string;
    country: string;
}

export class PersonRepository<T extends Person> {
    private items: T[] = [];
    
    constructor(initialItems?: T[]) {
        if (initialItems) {
            this.items = [...initialItems];
        }
    }
    
    findById(id: string): T | undefined {
        return this.items.find(item => item.id === id);
    }
    
    findAll(): T[] {
        return [...this.items];
    }
    
    add(item: T): void {
        this.items.push(item);
    }
    
    update(item: T): boolean {
        const index = this.items.findIndex(i => i.id === item.id);
        if (index >= 0) {
            this.items[index] = item;
            return true;
        }
        return false;
    }
    
    delete(id: string): boolean {
        const index = this.items.findIndex(i => i.id === id);
        if (index >= 0) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }
}

export type PersonFilter = {
    name?: string;
    minAge?: number;
    maxAge?: number;
    country?: string;
};

export function filterPersons(persons: Person[], filter: PersonFilter): Person[] {
    return persons.filter(person => {
        if (filter.name && !person.name.includes(filter.name)) {
            return false;
        }
        if (filter.minAge !== undefined && person.age < filter.minAge) {
            return false;
        }
        if (filter.maxAge !== undefined && person.age > filter.maxAge) {
            return false;
        }
        if (filter.country && (!person.address || person.address.country !== filter.country)) {
            return false;
        }
        return true;
    });
}
            `,
            "utf-8"
        );
        
        // Create an app file that uses the model
        fs.writeFileSync(
            path.join(SRC_DIR, "app.ts"),
            `
import { Person, PersonRepository, filterPersons } from './model';

const personRepo = new PersonRepository<Person>();

// Add some sample data
personRepo.add({
    id: '1',
    name: 'John Doe',
    age: 35,
    address: {
        street: '123 Main St',
        city: 'New York',
        zipCode: '10001',
        country: 'USA'
    }
});

personRepo.add({
    id: '2',
    name: 'Jane Smith',
    age: 28,
    address: {
        street: '456 Park Ave',
        city: 'Boston',
        zipCode: '02108',
        country: 'USA'
    }
});

// Get all persons
const allPersons = personRepo.findAll();
console.log('All persons:', allPersons);

// Filter persons
const filteredPersons = filterPersons(allPersons, { minAge: 30 });
console.log('Filtered persons:', filteredPersons);

export default personRepo;
            `,
            "utf-8"
        );
        
        // Create an index.html
        fs.writeFileSync(
            path.join(TEST_DIR, "index.html"),
            `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>Websmith Vite TypeScript Test</title>
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/app.ts"></script>
</body>
</html>
            `,
            "utf-8"
        );
    });
    
    afterAll(() => {
        // Clean up the test directory
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
    });
    
    it("should correctly transform complex TypeScript code", async () => {
        // Suppress console logs during the test
        const originalConsoleLog = console.log;
        console.log = vi.fn();
        
        try {
            // Build the project
            await build({
                root: TEST_DIR,
                plugins: [websmithPlugin({ 
                    profile: "test",
                    transpileOnly: true
                })],
                build: {
                    outDir: "dist",
                    emptyOutDir: true
                },
                logLevel: "silent" // Avoid cluttering test output
            });
            
            // Verify that build output exists
            expect(fs.existsSync(DIST_DIR)).toBe(true);
            
            // Check that assets were created
            const assets = fs.readdirSync(DIST_DIR);
            expect(assets.some(file => file.endsWith(".js"))).toBe(true);
            
            // Find the JS files
            const jsFiles = assets.filter(file => file.endsWith(".js"));
            const jsContents = jsFiles.map(file => fs.readFileSync(path.join(DIST_DIR, file), "utf-8"));
            const allJs = jsContents.join("\n");
            
            // Check that TypeScript features were correctly transformed
            expect(allJs).toContain("class PersonRepository");
            expect(allJs).toContain("filterPersons");
            expect(allJs).not.toContain(": Person"); // Type annotations should be removed
            expect(allJs).not.toContain("<Person>"); // Generics should be removed
            
            // Check that the code is functionally correct
            expect(allJs).toContain("findById");
            expect(allJs).toContain("findAll");
            expect(allJs).toContain("filter(person");
        } finally {
            // Restore console.log
            console.log = originalConsoleLog;
        }
    }, 30000); // Longer timeout for build process
});
