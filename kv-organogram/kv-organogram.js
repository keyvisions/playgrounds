class KvOrganogram extends HTMLElement {
	constructor() {
		super();
		this.selectedPersonId = null; // Track selected person
		const shadow = this.attachShadow({ mode: 'open' });
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'kv-organogram.css';
		shadow.appendChild(link);

		// Basic template
		shadow.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: sans-serif;
          border: 1px solid #ccc;
          padding: 1rem;
          border-radius: 8px;
          background: #fafafa;
        }
        h2 {
          margin: 0 0 0.5rem 0;
        }
        h3 {
          margin: 0 0 1rem 0;
          color: #666;
          font-size: 1rem;
        }
        .actions {
          margin-bottom: 1rem;
        }
        button {
          margin-right: 0.5rem;
        }
      </style>
      <h2 id="title"></h2>
      <h3 id="subtitle"></h3>
      <div class="actions">
        <input id="search" type="text" placeholder="Search..." style="display:none;" />
      </div>
      <div id="chart">
        <!-- Org chart rendering goes here -->
        <em>Organogram content placeholder</em>
      </div>
    `;
	}

	static get observedAttributes() {
		return [
			'title',
			'subtitle',
			'showsearch'
		];
	}

	attributeChangedCallback(name, oldValue, newValue) {
		const shadow = this.shadowRoot;
		switch (name) {
			case 'title':
				shadow.getElementById('title').textContent = newValue || '';
				break;
			case 'subtitle':
				shadow.getElementById('subtitle').textContent = newValue || '';
				break;
			case 'showsearch':
				shadow.getElementById('search').style.display = this.isTrue(newValue) ? '' : 'none';
				break;
		}
	}

	connectedCallback() {
		// Initialize attributes on first connect
		this.attributeChangedCallback('title', null, this.getAttribute('title'));
		this.attributeChangedCallback('subtitle', null, this.getAttribute('subtitle'));
		this.attributeChangedCallback('showsearch', null, this.getAttribute('showsearch'));

		// Fetch organogram data
		fetch('organogram.json')
			.then(response => response.json())
			.then(data => {
				this.organogramData = data;
				this.renderOrganogram();
			})
			.catch(error => {
				console.error('Failed to load organogram data:', error);
			});
	}

	// --- SVG rendering with selection ---
	renderOrganogram() {
		if (!this.organogramData) return;
		const people = this.organogramData.people;
		const boxWidth = 160, boxHeight = 50, vSpacing = 30, hSpacing = 60;
		const positions = {};
		let x = 0;
		const roots = people.filter(p => !p.managerId);

		// Layout: top-down (vertical tree)
		const layout = (person, depth = 0) => {
			const reports = people.filter(p => p.managerId === person.id);
			let subtreeWidth = 0;
			let childXs = [];
			// Recursively layout children first
			reports.forEach(child => {
				const childWidth = layout(child, depth + 1);
				childXs.push(positions[child.id].x);
				subtreeWidth += childWidth;
			});
			// If no children, use current x
			let myX;
			if (reports.length === 0) {
				myX = x;
				x += boxWidth + hSpacing;
			} else {
				// Center parent above children
				const minX = Math.min(...childXs);
				const maxX = Math.max(...childXs);
				myX = minX + (maxX - minX) / 2;
			}
			const y = depth * (boxHeight + vSpacing) + 20;
			positions[person.id] = { x: myX, y };
			return boxWidth + (reports.length ? subtreeWidth : 0) + (reports.length ? hSpacing * reports.length : hSpacing);
		};
		roots.forEach(root => layout(root));

		let svgContent = '';
		const svgDefs = `
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#888" flood-opacity="0.3"/>
        </filter>
      </defs>
    `;

		const transversalPeople = people.filter(p => p.transversal);
		let transversalContent = '';
		transversalPeople.forEach((person, idx) => {
			const tx = 40 + idx * (boxWidth + hSpacing);
			const ty = 0; // Place above the main chart
			transversalContent += `
        <g class="person-box transversal" data-id="${person.id}" style="cursor:pointer">
            <rect x="${tx}" y="${ty}" width="${boxWidth}" height="${boxHeight}" rx="12"
                fill="#fffde7" stroke="#fbc02d" stroke-width="3" filter="url(#shadow)"/>
            <text x="${tx + boxWidth / 2}" y="${ty + 22}" text-anchor="middle"
                font-size="16" font-weight="bold" fill="#fbc02d">${person.name}</text>
            <text x="${tx + boxWidth / 2}" y="${ty + 40}" text-anchor="middle"
                font-size="13" fill="#555">${person.title}</text>
        </g>
    `;
		});

		people.forEach(person => {
			if (person.managerId) {
				const from = positions[person.managerId];
				const to = positions[person.id];
				const startX = from.x + boxWidth / 2;
				const startY = from.y + boxHeight;
				const endX = to.x + boxWidth / 2;
				const endY = to.y;
				// Draw vertical down from manager, then horizontal to child, then vertical down to child
				const midY = (startY + endY) / 2;
				svgContent += `
          <path d="M${startX},${startY} 
                   V${endY - vSpacing / 2} 
                   H${endX} 
                   V${endY}"
            stroke="#8ab4f8" stroke-width="2" fill="none"/>
        `;
			}
		});

		transversalPeople.forEach(person => {
			// Example: connect to all root managers
			roots.forEach(root => {
				const fromX = 40 + transversalPeople.indexOf(person) * (boxWidth + hSpacing) + boxWidth / 2;
				const fromY = boxHeight;
				const toX = positions[root.id].x + boxWidth / 2;
				const toY = positions[root.id].y;
				svgContent += `
            <path d="M${fromX},${fromY} L${toX},${toY}" stroke="#fbc02d" stroke-width="2" stroke-dasharray="6,4" fill="none"/>
        `;
			});
		});

		people.forEach(person => {
			const pos = positions[person.id];
			const isManager = people.some(p => p.managerId === person.id);
			const isSelected = this.selectedPersonId === person.id;
			const fill = isSelected ? "#ffe082" : (isManager ? "#e3f2fd" : "#fff");
			const stroke = isSelected ? "#ff9800" : "#1976d2";
			const cursor = "pointer";
			svgContent += `
        <g class="person-box" data-id="${person.id}" style="cursor:${cursor}">
          <rect x="${pos.x}" y="${pos.y}" width="${boxWidth}" height="${boxHeight}" rx="12"
            fill="${fill}" stroke="${stroke}" stroke-width="3" filter="url(#shadow)"/>
          <text x="${pos.x + boxWidth / 2}" y="${pos.y + 22}" text-anchor="middle"
            font-size="16" font-weight="bold" fill="#1976d2">${person.name}</text>
          <text x="${pos.x + boxWidth / 2}" y="${pos.y + 40}" text-anchor="middle"
            font-size="13" fill="#555">${person.title}</text>
        </g>
      `;
		});

		const chart = this.shadowRoot.getElementById('chart');
		const hint = `<div style="color:#1976d2;font-size:0.95rem;margin-bottom:0.5rem;">
  Click a person to select
</div>`;

		// Calculate SVG width and height dynamically
		const maxX = Math.max(...Object.values(positions).map(pos => pos.x)) + boxWidth + 40;
		const maxY = Math.max(...Object.values(positions).map(pos => pos.y)) + boxHeight + 40;

		chart.innerHTML = `
  ${hint}
  <svg id="orgSvg" width="${maxX}" height="${maxY}" style="background:linear-gradient(180deg,#f5faff 0%,#e3f2fd 100%);border-radius:16px;">
    ${svgDefs}
    ${svgContent}
  </svg>
`;

		// Add click event for selection
		const svg = this.shadowRoot.getElementById('orgSvg');
		svg.querySelectorAll('.person-box').forEach(g => {
			g.addEventListener('click', e => {
				const id = Number(g.getAttribute('data-id'));
				this.selectedPersonId = id;
				this.renderOrganogram();
				e.stopPropagation();
			});
			g.addEventListener('dblclick', e => {
				const id = Number(g.getAttribute('data-id'));
				this.selectedPersonId = id;
				this.showEditForm(); // Open modal directly
				e.stopPropagation();
			});
		});
		// Deselect on background click
		svg.addEventListener('click', () => {
			this.selectedPersonId = null;
			this.renderOrganogram();
		});

		const searchInput = this.shadowRoot.getElementById('search');
		if (searchInput) {
			searchInput.oninput = (e) => {
				const query = e.target.value.trim().toLowerCase();
				if (!query) return;
				const people = this.organogramData.people;
				const match = people.find(
					p => p.name.toLowerCase().includes(query) || (p.title && p.title.toLowerCase().includes(query))
				);
				if (match) {
					this.selectedPersonId = match.id;
					this.renderOrganogram();
				}
			};
			searchInput.onkeydown = (e) => {
				if (e.key === "Enter" && this.selectedPersonId) {
					e.preventDefault();
					this.showEditForm();
				}
			};
		}
	}

	// --- Edit: edit selected ---
	showEditForm() {
		const people = this.organogramData.people;
		if (!this.selectedPersonId) return;
		const person = people.find(p => p.id === this.selectedPersonId);
		const managers = people.filter(p => p.id !== person.id)
			.map(p => `<option value="${p.id}"${person.managerId === p.id ? ' selected' : ''}>${p.name}</option>`).join('');

		// 1. Create modal wrapper
		const modal = document.createElement('div');
		modal.innerHTML = `
        <div class="kv-modal-backdrop">
            <div class="kv-modal-dialog">
                <button class="kv-modal-close" title="Close" type="button">&times;</button>
                <h3>Edit Person</h3>
                <form id="editPersonForm">
                    <label>Name: <input name="name" value="${person.name}" required></label><br>
                    <label>Title: <input name="title" value="${person.title}" required></label><br>
                    <label>Manager: 
                        <select name="managerId">
                            <option value="">(No manager)</option>
                            ${managers}
                        </select>
                    </label><br>
                    <label>
                        <input type="checkbox" name="transversal" ${person.transversal ? 'checked' : ''}>
                        Transversal role
                    </label><br>
                    <div style="margin-top:1rem;">
                        <button type="submit">Save</button>
                        <button type="button" id="cancelEditPerson">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
		const modalRoot = modal.firstElementChild;
		document.body.appendChild(modalRoot);

		const closeModal = () => {
			if (modalRoot && modalRoot.parentNode) modalRoot.parentNode.removeChild(modalRoot);
		};

		modalRoot.addEventListener('click', e => {
			if (e.target.classList.contains('kv-modal-backdrop')) closeModal();
		});
		modalRoot.querySelector('.kv-modal-close').onclick = closeModal;
		modalRoot.querySelector('#cancelEditPerson').onclick = (e) => { e.preventDefault(); closeModal(); };

		modalRoot.querySelector('#editPersonForm').onsubmit = (e) => {
			e.preventDefault();
			person.name = e.target.name.value;
			person.title = e.target.title.value;
			person.managerId = e.target.managerId.value ? Number(e.target.managerId.value) : undefined;
			person.transversal = e.target.transversal.checked;
			closeModal();
			this.renderOrganogram();
		};
	}

	downloadData() {
		const dataStr = JSON.stringify(this.organogramData, null, 2);
		const blob = new Blob([dataStr], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = "organogram.json";
		a.click();
		URL.revokeObjectURL(url);
	}

	isTrue(val) {
		return val === '' || val === 'true';
	}
}

customElements.define('kv-organogram', KvOrganogram);