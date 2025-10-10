import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";

// Get last build time
let lastBuild = new Date('2000-01-01T00:00');
try {
    const stat = await Deno.stat('./.lastbuild');
    lastBuild = stat.mtime || lastBuild;
} catch {
    console.log('No previous build found');
}
console.log('Last build:', lastBuild);

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await Deno.stat(filePath);
        return true;
    } catch {
        return false;
    }
}

async function isNewer(filePath: string): Promise<boolean> {
    try {
        const stat = await Deno.stat(filePath);
        return (stat.mtime || new Date(0)) > lastBuild;
    } catch {
        return false;
    }
}

function minifyCSS(cssContent: string): string {
    // Basic CSS minification
    return cssContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, '}') // Remove last semicolon
        .replace(/\s*{\s*/g, '{') // Clean braces
        .replace(/;\s*/g, ';') // Clean semicolons
        .trim();
}

function minifyJS(jsContent: string): string {
    // Basic JS minification
    return jsContent
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, '') // Remove line comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/\s*([{}();,:])\s*/g, '$1') // Clean operators
        .trim();
}

async function buildCSS(components: string, include = '', force = false) {
    const names = components.split(',');
    const mainName = names[0];
    
    // Build list of CSS files to check
    const cssFiles = [];
    if (await fileExists('./kv-style.css')) {
        cssFiles.push('./kv-style.css');
    }
    
    if (include) {
        for (const name of include.split(',')) {
            const file = `./${mainName}/${name}.css`;
            if (await fileExists(file)) {
                cssFiles.push(file);
            }
        }
    }
    
    for (const name of names) {
        const file = `./${name}/${name}.css`;
        if (await fileExists(file)) {
            cssFiles.push(file);
        }
    }

    if (cssFiles.length === 0) {
        console.log(`Warning: No CSS files found for ${mainName}`);
        return;
    }
    
    // Check if we need to rebuild
    if (!force) {
        const needsRebuild = await Promise.all(cssFiles.map(file => isNewer(file)));
        
        if (!needsRebuild.some(Boolean)) {
            console.log(`Skipping ${mainName} CSS - no changes`);
            return;
        }
    }

    let combinedCSS = '';
    for (const file of cssFiles) {
        try {
            const content = await Deno.readTextFile(file);
            combinedCSS += content + '\n';
        } catch (error) {
            if (error instanceof Error) {
                if (error instanceof Error) {
                    console.log(`Error reading ${file}: ${error.message}`);
                } else {
                    console.log(`Error reading ${file}:`, error);
                }
            } else {
                console.log(`Error reading ${file}:`, error);
            }
        }
    }

    if (combinedCSS.trim() === '') {
        console.log(`Warning: No CSS content found for ${mainName}`);
        return;
    }

    const minified = minifyCSS(combinedCSS);
    
    await ensureDir(`./${mainName}/deploy_deno`);
    await Deno.writeTextFile(`./${mainName}/deploy_deno/${mainName}.min.css`, minified);
    console.log(`Built ${mainName}.min.css`);
}

async function buildJS(components: string, include = '', force = false) {
    const names = components.split(',');
    const mainName = names[0];
    
    // Build list of JS files to check
    const jsFiles = [];
    
    if (include) {
        for (const name of include.split(',')) {
            const file = `./${mainName}/${name}.js`;
            if (await fileExists(file)) {
                jsFiles.push(file);
            }
        }
    }
    
    for (const name of names) {
        const file = `./${name}/${name}.js`;
        if (await fileExists(file)) {
            jsFiles.push(file);
        }
    }

    if (jsFiles.length === 0) {
        console.log(`Warning: No JS files found for ${mainName}`);
        return;
    }
    
    // Check if we need to rebuild
    if (!force) {
        const needsRebuild = await Promise.all(jsFiles.map(file => isNewer(file)));
        
        if (!needsRebuild.some(Boolean)) {
            console.log(`Skipping ${mainName} JS - no changes`);
            return;
        }
    }

    let combinedJS = '';
    for (const file of jsFiles) {
        try {
            const content = await Deno.readTextFile(file);
            combinedJS += content + '\n';
        } catch (error) {
            if (error instanceof Error) {
                console.log(`Error reading ${file}: ${error.message}`);
            } else {
                console.log(`Error reading ${file}:`, error);
            }
        }
    }

    if (combinedJS.trim() === '') {
        console.log(`Warning: No JS content found for ${mainName}`);
        return;
    }

    const minified = minifyJS(combinedJS);
    
    await ensureDir(`./${mainName}/deploy_deno`);
    await Deno.writeTextFile(`./${mainName}/deploy_deno/${mainName}.min.js`, minified);
    console.log(`Built ${mainName}.min.js`);
}

async function buildHTML(name: string, force = false) {
    const htmlFile = `./${name}/index.html`;
    
    if (!(await fileExists(htmlFile))) {
        console.log(`Warning: ${htmlFile} not found`);
        return;
    }
    
    if (!force && !(await isNewer(htmlFile))) {
        console.log(`Skipping ${name} HTML - no changes`);
        return;
    }

    try {
        let content = await Deno.readTextFile(htmlFile);
        content = content
            .replace(new RegExp(`${name}\\.js`, 'g'), `${name}.min.js`)
            .replace(new RegExp(`${name}\\.css`, 'g'), `${name}.min.css`);
        
        await ensureDir(`./${name}/deploy_deno`);
        await Deno.writeTextFile(`./${name}/deploy_deno/${name}.min.html`, content);
        console.log(`Built ${name}.min.html`);
    } catch (error) {
        if (error instanceof Error) {
            console.log(`Error processing ${htmlFile}: ${error.message}`);
        } else {
            console.log(`Error processing ${htmlFile}:`, error);
        }
    }
}

// Build all components
async function buildAll() {
    const tasks = [
        // HTMLElement components
        buildCSS("kv-gauge"), buildJS("kv-gauge"),
        buildCSS("kv-tags"), buildJS("kv-tags"),
        buildCSS("kv-budget"), buildJS("kv-budget"),
        buildCSS("kv-pick"), buildJS("kv-pick"),
        buildCSS("kv-timeline"), buildJS("kv-timeline"),
        buildCSS("kv-params,kv-pair", "", true), buildJS("kv-params,kv-pair", "UMS", true),
        buildCSS("kv-pair"), buildJS("kv-pair"), buildHTML("kv-pair"),
        buildCSS("kv-gantt"), buildJS("kv-gantt"),

        // Not HTMLElement
        buildCSS("kvJSONForm"), buildJS("kvJSONForm"),
        buildCSS("kvTags"), buildJS("kvTags"),
        buildCSS("kvImportData"), buildJS("kvImportData"),
        buildCSS("kvSelect"), buildJS("kvSelect"),
    ];

    await Promise.all(tasks);
    
    // Update last build time
    await Deno.writeTextFile('./.lastbuild', new Date().toISOString());
    console.log('Build complete!');
}

if (import.meta.main) {
    await buildAll();
}