// app.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// servir arquivos estáticos (frontend)
app.use(express.static(path.join(__dirname, "public")));

// rota raiz (index)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/**
 * Configurações fixas
 * Origem sempre CNF, pesquisa para o Brasil (country_to=BR) cobrindo 2026.
 */
const FROM = "CNF";
const COUNTRY_TO = "BR";
const DATE_FROM = "01/01/2026";
const DATE_TO = "31/12/2026";

/**
 * GET /voos
 * Query params opcionais:
 *  - limit (padrão 200)
 */
app.get("/voos", async (req, res) => {
  try {
    const limit = Math.min(500, Number(req.query.limit) || 200);

    // Monta URL da Skypicker Public API
    // Observação: alguns parâmetros variam na API; aqui usamos country_to para buscar destinos no Brasil
    const base = "https://api.skypicker.com/flights";
    const params = new URLSearchParams({
      fly_from: FROM,
      country_to: COUNTRY_TO,   // todo Brasil
      date_from: DATE_FROM,
      date_to: DATE_TO,
      curr: "BRL",
      limit: String(limit),
      partner: "picky",
    });

    const url = `${base}?${params.toString()}`;
    console.log("[Skypicker] fetching:", url);

    // fetch global (Node 18+). Se seu ambiente não suportar, instale node-fetch e adapte.
    const resp = await fetch(url);
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Skypicker error:", resp.status, txt);
      return res.status(502).json({ error: `Skypicker API error ${resp.status}` });
    }

    const json = await resp.json();
    if (!json.data || !Array.isArray(json.data)) {
      return res.status(500).json({ error: "Resposta inesperada da Skypicker" });
    }

    // Ordena resultados por preço ascendente
    const data = json.data.slice().sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

    // Mapear para formato limpo
    const mapped = data.map(item => {
      // montagem do link de compra: prefere booking_token se houver
      let link = null;
      if (item.booking_token) {
        link = `https://www.kiwi.com/deep?booking_token=${encodeURIComponent(item.booking_token)}`;
      } else if (item.deep_link) {
        link = item.deep_link;
      } else {
        // fallback para busca kiwi
        link = `https://www.kiwi.com/pt/search/results/?from=${item.flyFrom}&to=${item.flyTo}&dateFrom=${item.local_departure ? item.local_departure.split("T")[0] : ""}`;
      }

      return {
        hash_id: item.id ?? (item.booking_token ? item.booking_token : `${item.flyFrom}:${item.flyTo}:${item.local_departure}`),
        origin_airport: `${item.cityFrom || ""} (${item.flyFrom || ""})`,
        destination_airport: `${item.cityTo || ""} (${item.flyTo || ""})`,
        trip_type: item.return ? "round_trip" : "one_way",
        departure_date: item.local_departure ? item.local_departure.split("T")[0] : null,
        return_date: item.local_arrival && item.return ? item.local_arrival.split("T")[0] : null,
        airline: (item.airlines && item.airlines[0]) || null,
        flight_numbers: (item.route || []).map(r => `${r.airline || ""}${r.flight_no ? " " + r.flight_no : ""}`),
        stops: (item.route || []).length - 1,
        stop_locations: (item.route || []).map(r => r.cityTo).filter(Boolean),
        is_direct: (item.route || []).length <= 1,
        duration_minutes: item.duration ? Math.round((item.duration.total||0) / 60) : null,
        price: item.price ?? null,
        currency: json.currency || "BRL",
        price_breakdown: item.price_breakdown || null,
        search_timestamp: new Date().toISOString(),
        source: "skypicker_public",
        sources_alternatives: [],
        booking_url: link,
        raw: item
      };
    });

    // deduplicação simples por hash_id (mantém a primeira — já ordenado por preço)
    const seen = new Set();
    const deduped = [];
    for (const o of mapped) {
      if (!seen.has(o.hash_id)) {
        seen.add(o.hash_id);
        deduped.push(o);
      }
    }

    res.json({
      meta: {
        origin_query: [FROM],
        date_range_searched: ["2026-01-01","2026-12-31"],
        results_count: deduped.length,
        sorted_by: "price_asc"
      },
      results: deduped
    });
  } catch (err) {
    console.error("Internal error /voos:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// rota health
app.get("/health", (req, res) => res.json({ status: "ok", now: new Date().toISOString() }));

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
