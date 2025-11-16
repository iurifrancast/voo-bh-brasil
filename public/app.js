document.getElementById("flightSearchForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const origin = document.getElementById("origin").value;
    const destination = document.getElementById("destination").value;
    const from_date = document.getElementById("from_date").value;
    const to_date = document.getElementById("to_date").value;

    const url = `/search?origins=${origin}&destination=${destination}&from_date=${from_date}&to_date=${to_date}`;

    const res = await fetch(url);
    const data = await res.json();

    const container = document.getElementById("resultsContainer");
    container.innerHTML = "";

    if (!data.results.length) {
        container.innerHTML = "<p>Nenhum voo encontrado.</p>";
        return;
    }

    data.results.forEach((offer) => {
        const card = document.createElement("div");
        card.className = "result-card";

        card.innerHTML = `
            <div class="result-header">
                <span>${offer.airline} • Voo ${offer.flight_number}</span>
                <span class="price-tag">R$ ${offer.total_price}</span>
            </div>

            <p class="small">${offer.origin} → ${offer.destination} • ${offer.date}</p>

            <a href="${offer.deep_link}" target="_blank" class="small">Ver oferta</a>
        `;

        container.appendChild(card);
    });
});
