#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to convert @/ imports to relative paths with extensions
function convertImports(content, filePath) {
    const srcDir = path.resolve(process.cwd(), 'src');
    const relativePath = path.relative(srcDir, filePath);
    const depth = relativePath.split(path.sep).length - 1;

    // Replace @/ imports with relative paths
    return content.replace(
        /from\s+['"]@\/([^'"]+)['"]/g,
        (match, importPath) => {
            // Calculate relative path
            let relativeImport;
            if (depth === 0) {
                // File is at root of src directory
                relativeImport = `./${importPath}`;
            } else {
                // File is in a subdirectory
                relativeImport = '../'.repeat(depth) + importPath;
            }

            // Add file extension if not present
            if (!importPath.endsWith('.ts') && !importPath.endsWith('.tsx') && !importPath.endsWith('.js') && !importPath.endsWith('.jsx')) {
                // Try to find the actual file with extension
                const possibleExtensions = ['.tsx', '.ts', '.jsx', '.js'];
                let foundExtension = '';

                for (const ext of possibleExtensions) {
                    const fullPath = path.join(srcDir, importPath + ext);
                    if (fs.existsSync(fullPath)) {
                        foundExtension = ext;
                        break;
                    }
                }

                if (foundExtension) {
                    return `from '${relativeImport}${foundExtension}'`;
                }
            }

            return `from '${relativeImport}'`;
        }
    );
}

// Function to process a single file
function processFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const converted = convertImports(content, filePath);

        if (content !== converted) {
            fs.writeFileSync(filePath, converted, 'utf8');
            console.log(`✅ Converted: ${filePath}`);
        } else {
            console.log(`⏭️  No changes: ${filePath}`);
        }
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
    }
}

// Main execution
function main() {
    console.log('🔄 Converting @/ imports to relative paths with extensions...\n');

    // Find all TypeScript/JavaScript files
    const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
        ignore: ['src/**/*.d.ts', 'node_modules/**']
    });

    console.log(`Found ${files.length} files to process\n`);

    files.forEach(processFile);

    console.log('\n🎉 Import conversion complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run lint -- --fix');
    console.log('2. Test your application to ensure everything works');
    console.log('3. Commit your changes');
}

// Run the main function
main();

export { convertImports, processFile };
