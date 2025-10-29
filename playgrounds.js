// deno-lint-ignore-file
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = localStorage.getItem('theme');

function load() {
    document.querySelectorAll('aside').forEach(aside => {
        aside.addEventListener('click', toggleAside);
    });

    if (currentTheme == 'dark')
        document.body.classList.toggle('dark-mode');
    else if (currentTheme == 'light')
        document.body.classList.toggle('light-mode');
}
function toggleAside(event) {
    event.target.classList.toggle('collapsed');
}

function toggleColorScheme(event) {
    const classList = event.target.classList;
    classList.toggle('fas');
    classList.toggle('far');
    document.documentElement.style.colorScheme = classList.contains('far') ? 'light' : 'dark';
}

function setBackground(svg) {
    const bodyStyle = document.body.style;

    bodyStyle.backgroundImage = `url("${svg}")`;
    bodyStyle.backgroundSize = '100px 100px';
}

async function openPart(event) {
    event.preventDefault();
    document.getElementById("Part").setAttribute("src", event.target.href);
    const readmeUrl = event.target.href.replace("index.html", "README.md");
    try {
        const response = await fetch(readmeUrl);
        if (!response.ok) {
            document.getElementById("README").innerHTML = "<em>No README available for this part.</em>";
        } else {
            const md = await response.text();
            if (window.marked) {
                document.getElementById("README").innerHTML = marked.parse(md);
            } else {
                document.getElementById("README").innerText = md;
            }
        }
    } catch (_error) {
        document.getElementById("README").innerHTML = "<em>No README available for this part.</em>";
    }
}

function checkCF(CF) {
    const c = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        v = '010005070913151719210100050709131517192102041820110306081214161022252423';

    CF = CF.toUpperCase();

    let sum = 0, i;
    if (CF.match(/[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/)) {
        for (i = 0; i < 14; i += 2) {
            sum += parseInt(v.substring(2 * c.indexOf(CF[i])).substring(0, 2)) + CF.charCodeAt(i + 1) - 65;
            if (CF[i].match(/\d/, i + 1, 1))
                sum += 17;
        }
        sum += parseInt(v.substring(2 * c.indexOf(CF[i])).substring(0, 2));

        return (sum % 26 + 65 == CF.charCodeAt(15));
    }
    return false;
}
