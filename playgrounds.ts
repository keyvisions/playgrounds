// This script scans root-level folders for index.html and generates <li> links for index folder in each folder.
// It then replaces the content of <ul id="Projects">...</ul> in index.html with the generated list.

async function updateProjectsList() {
    const projectRoot = Deno.cwd();
    const indexFile = `${projectRoot}/index.html`;

    try {
        // Find all root-level directories with index.html
        const folders: string[] = [];
        
        for await (const entry of Deno.readDir(projectRoot)) {
            if (entry.isDirectory) {
                const indexPath = `${projectRoot}/${entry.name}/index.html`;
                try {
                    await Deno.stat(indexPath);
                    folders.push(entry.name);
                } catch {
                    // index.html doesn't exist in this directory, skip it
                }
            }
        }

        // Sort folders alphabetically
        folders.sort();

        // Generate the HTML list items
        const liList = folders
            .map(folder => `<li><a href="./${folder}/index.html" target="_blank">${folder}</a></li>`)
            .join('\n        ');

        // Prepare the new <ul> content
        const newUl = `<h1>Projects</h1><ul id="Projects">
        ${liList}
    </ul>`;

        // Read the index.html content
        const html = await Deno.readTextFile(indexFile);

        // Replace the content of <ul id="Projects">...</ul>
        // This regex matches <ul id="Projects">...</ul> including newlines and whitespace
        const updatedHtml = html.replace(
            /<ul id="Projects">.*?<\/ul>/s,
            newUl
        );

        // Write the updated HTML back to index.html
        await Deno.writeTextFile(indexFile, updatedHtml);

        console.log(`Updated project list in index.html with ${folders.length} projects:`);
        folders.forEach(folder => console.log(`  - ${folder}`));

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error updating projects list:', errorMessage);
        Deno.exit(1);
    }
}

if (import.meta.main) {
    await updateProjectsList();
}