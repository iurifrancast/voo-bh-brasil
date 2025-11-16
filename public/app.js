// public/app.js
async function loadVoos() {
  const container = document.getElementById("resultsContainer");
  container.innerHTML = "<p>Carregando ofertas...</p>";

  try {
    const resp = await fetch("/voos?limit=200");
    const data = await resp.json();

    if (!data.results || !data.results.length) {
      container.innerHTML = "<p>Nenhuma oferta encontrada.</p>";
      return;
    }

    container.innerHTML = "";
    data.results.forEach(offer => {
      const card = document.createElement("div");
      card.className = "result-card";
      card.innerHTML = `
        <div class="result-header">
          <div>
            <strong>${offer.origin_airport} → ${offer.destination_airport}</strong>
            <div class="small">${offer.departure_date}${offer.return_date ? " • retorno " + offer.return_date : ""}</div>
          </div>
          <div style="text-align:right">
            <div class="price-tag">R$ ${offer.price}</div>
            <a href="${offer.booking_url}" target="_blank" rel="noopener" class="buy-btn">Comprar</a>
          </div>
        </div>
        <div class="small">Companhia: ${offer.airline || "-" } • Escalas: ${offer.stops}</div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Erro ao carregar ofertas.</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadVoos();
});
