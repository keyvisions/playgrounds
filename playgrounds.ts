// This script scans root-level folders for index.html and generates <li> links for index folder in each folder.
// It then replaces the content of <ul id="Parts">...</ul> in index.html with the generated list.

export async function updatePartsList() {
    const projectRoot = Deno.cwd();
    const indexFile = `${projectRoot}/index.html`;

    // Read .gitignore and collect root-level directory exclusions (ending with /)
    const gitignorePath = `${projectRoot}/.gitignore`;
    const ignoredDirs: Set<string> = new Set();
    try {
        const gitignoreContent = await Deno.readTextFile(gitignorePath);
        gitignoreContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed.endsWith('/') && !trimmed.startsWith('#') && !trimmed.startsWith('!')) {
                // Only add root-level ignores (no slashes except at end)
                if (!trimmed.slice(0, -1).includes('/')) {
                    ignoredDirs.add(trimmed.replace(/\/$/, ''));
                }
            }
        });
    // deno-lint-ignore no-empty
    } catch {}

    try {
        // Find all root-level directories with index.html, not ignored
        const folders: string[] = [];
        for await (const entry of Deno.readDir(projectRoot)) {
            if (entry.isDirectory && !ignoredDirs.has(entry.name)) {
                const indexPath = `${projectRoot}/${entry.name}/index.html`;
                try {
                    await Deno.stat(indexPath);
                    folders.push(entry.name);
                } catch {
                    // index.html doesn't exist in this directory, skip it
                }
            }
        }

        folders.sort();

        const liList = folders
            .map(folder => `<li><a href="./${folder}/index.html" onclick="openPart(event)">${folder}</a></li>`)
            .join('\n');

        const newUl = `<ol id="Parts">${liList}</ol>`;

        const html = await Deno.readTextFile(indexFile);

        const updatedHtml = html.replace(/<ol id="Parts">.*?<\/ol>/s, newUl);

        await Deno.writeTextFile(indexFile, updatedHtml);

        console.log(`Updated project list in index.html with ${folders.length} parts`);
        // folders.forEach(folder => console.log(`  - ${folder}`));

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error updating parts list:', errorMessage);
        Deno.exit(1);
    }
}

if (import.meta.main) {
    await updatePartsList();
}