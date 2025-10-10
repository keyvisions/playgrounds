// Created: 2024/11/08
// Creator: g.trevisan@keyvisions.it
// Description: Given a data structure that identifies the batches on hand, a quantity requested and quantities altready picked allow picking
// Usage: <kv-pick src="./data.json" name-details="" name-quantity=""></kv-pick>
class kvPick extends HTMLElement {
	batchCode = "";
	batchQty = NaN;

	constructor() {
		super();

		fetch(this.getAttribute('src'))
			.then(res => res.json())
			.then(json => this.render(json))
			.catch(() => this.render(JSON.parse(this.innerText || '{"requested":null,"picked":null,"Batches":[]}')));
	}

	render(json) {
		this.batchCode = this.getAttribute("batch");
		this.batchQty = parseInt(this.getAttribute("batchqty"));

		this.innerHTML =
			`<input id="batches" type="hidden" name="${this.getAttribute("data-batches")}">
			<table>
				<thead>
					<tr><th>Data<br>scadenza</th><th>Lotto</th><th>Ubicazione</th><th>Quantità</th><th>Quantità<br>prelevata</th></tr>
					<tr style="font-weight:bolder; text-align:right"><td colspan="2"></td><td>Totale</td><td class="requested">${json.requested}</td><td><input id="picked" type="number" name="${this.getAttribute("data-quantity")}" readonly title="Prelievo"></td></tr>
				</thead>
				<tbody>
				${json.batches?.map(batch => `<tr id="${(batch.name || 'BULK_' + json.code).toUpperCase()}"><td>${batch.expiration || ""}</td><td>${(batch.name.startsWith('BULK_') ? 'BULK' : batch.name).toUpperCase()}</td><td>${batch.location || ""}</td><td class="available" style="text-align:right">${batch.available || ""}</td><td style="text-align:right"><input form="none" type="number" name="picked" title="Prelievo" min="0" value="${batch.picked || ""}"></td></tr>`).join('')}
				</tbody>
			</table>`;
		this.removeAttribute("name");
		if (!this.hasAttribute("tabindex"))
			this.setAttribute("tabindex", 0);

		this.addEventListener("change", () => {
			const requested = parseFloat(this.querySelector("td.requested").innerText), picked = this.querySelector("#picked");

			let total = 0;
			this.querySelectorAll("input[name=picked]").forEach(batch =>
				total += isNaN(parseFloat(batch.value)) ? 0 : parseFloat(batch.value)
			);
			picked.value = total;
			picked.className = total == requested ? "" : "invalid";

			const picking = {};
			this.querySelectorAll("tbody>tr").forEach(tr => {
				if (tr.querySelector("[name=picked]").value > 0)
					picking[tr.id] = parseFloat(tr.querySelector("[name=picked]").value);
			});
			this.querySelector("#batches").value = JSON.stringify(picking);
		});

		this.addEventListener("keyup", event => {
			if (event.target == this) {
				if (event.key == "Enter") {
					this.querySelector(".selected")?.classList.remove("selected");
					this.querySelector(`tr[id="${this.batchCode.toUpperCase()}"]`)?.classList.add("selected");

					if (this.querySelector(".selected")) {
						this.querySelector(".selected").scrollIntoView(false);

						const requested = parseFloat(this.querySelector("td.requested").innerText),
							available = parseFloat(this.querySelector(".selected td.available").innerText),
							picked = parseFloat(this.querySelector("#picked").value) || 0;

						let pickable = picked < requested ? requested - picked : null;
						pickable = pickable > available ? available : pickable;

						const input = this.querySelector(".selected input");
						if (this.batchQty == -1)
							input.setAttribute("value", picked || "");
						else if (isNaN(this.batchQty) || this.batchQty == 0)
							input.setAttribute("value", picked ? picked + 1 : pickable);
//							input.setAttribute("value", picked + 1);
						else
							input.setAttribute("value", picked + this.batchQty);

						this.dispatchEvent(new Event("change"));
					}
					this.batchCode = '';
				} else if (event.key.length == 1)
					this.batchCode += event.key;
			}
		});

		this.dispatchEvent(new Event("change"));
		this.dispatchEvent(new KeyboardEvent("keyup", { key: 'Enter'}));
	}
}

// Register web component
customElements.define('kv-pick', kvPick);