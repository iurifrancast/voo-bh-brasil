import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// -----------------------------------------------------
// CONFIGURAÇÃO DE CAMINHOS (necessário no ES Modules)
// -----------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------------------------------
// INICIALIZA EXPRESS
// -----------------------------------------------------
const app = express();
app.use(express.json());

// Servir pasta public (index.html + css + js)
app.use(express.static(path.join(__dirname, "public")));

// Rota principal (carrega o front)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -----------------------------------------------------
// CONSTANTES
// -----------------------------------------------------
const CACHE_TTL_SEC = Number(process.env.CACHE_TTL_SEC) || 300;
const DEFAULT_LIMIT = 20;

// -----------------------------------------------------
// UTILITÁRIOS
// -----------------------------------------------------
const cache = new Map();
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const log = (...msg) =>
  console.log(`[FlightScan]`, new Date().toISOString(), ...msg);

function safeNumber(num, fallback) {
  const parsed = Number(num);
  return isNaN(parsed) ? fallback : parsed;
}

// -----------------------------------------------------
// GERADOR DE OFERTAS MOCKADAS
// -----------------------------------------------------
let uniqueCounter = 0;

function generateMockOffers(count = 20) {
  const offers = [];
  const airlines = ["Azul", "LATAM", "Gol"];
  const airports = ["CNF", "GRU", "GIG", "BSB"];

  for (let i = 0; i < count; i++) {
    const price = Math.floor(Math.random() * 2000) + 300;
    const tax = Math.floor(price * 0.15);

    offers.push({
      unique_id: `OFFER-${Date.now()}-${uniqueCounter++}`,
      source: "MOCK",
      airline: airlines[Math.floor(Math.random() * airlines.length)],
      flight_number: `${Math.floor(Math.random() * 900) + 100}`,
      origin: airports[Math.floor(Math.random() * airports.length)],
      destination: airports[Math.floor(Math.random() * airports.length)],
      date: "2026-04-10",
      total_price: price + tax,
      price_breakdown: { base: price, tax: tax, currency: "BRL" },
      deep_link: "https://example.com/book",
    });
  }
  return offers;
}

// -----------------------------------------------------
// MOCK DOS PROVEDORES
// -----------------------------------------------------
async function providerA(params) {
  await sleep(150);
  const o = generateMockOffers(params.limit || 20);
  o.forEach(x => x.source = "PROVIDER_A");
  return o;
}

async function providerB(params) {
  await sleep(250);
  const o = generateMockOffers(params.limit || 20);
  o.forEach(x => x.source = "PROVIDER_B");
  return o;
}

async function providerC(params) {
  await sleep(350);
  const o = generateMockOffers(params.limit || 20);
  o.forEach(x => x.source = "PROVIDER_C");
  return o;
}

// -----------------------------------------------------
// NORMALIZAÇÃO
// -----------------------------------------------------
function normalizeOffer(o) {
  return {
    id: o.unique_id,
    provider: o.source,
    airline: o.airline,
    flight_number: o.flight_number,
    origin: o.origin,
    destination: o.destination,
    date: o.date,
    total_price: o.total_price,
    price_breakdown: o.price_breakdown,
    deep_link: o.deep_link,
  };
}

function uniqueOffers(list) {
  const seen = new Set();
  return list.filter(o => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

// -----------------------------------------------------
// CACHE
// -----------------------------------------------------
async function withCache(cacheKey, fetchFn) {
  const now = Date.now();

  if (cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (now - entry.timestamp < CACHE_TTL_SEC * 1000) {
      log(`CACHE HIT → ${cacheKey}`);
      return entry.data;
    }
  }

  log(`CACHE MISS → ${cacheKey}`);
  const data = await fetchFn();
  cache.set(cacheKey, { timestamp: now, data });
  return data;
}

// -----------------------------------------------------
// ROTA DE BUSCA /search
// -----------------------------------------------------
app.get("/search", async (req, res) => {
  try {
    const origins = req.query.origins || "CNF";
    const from_date = req.query.from_date || "2026-04-01";
    const to_date = req.query.to_date || "2026-04-30";
    const page = safeNumber(req.query.page, 1);
    const per_page = safeNumber(req.query.per_page, DEFAULT_LIMIT);

    const cacheKey = JSON.stringify({ origins, from_date, to_date });

    const results = await withCache(cacheKey, async () => {
      log("Fetching from mock providers…");
      const params = { origins, from_date, to_date, limit: 50 };

      const [a, b, c] = await Promise.all([
        providerA(params),
        providerB(params),
        providerC(params),
      ]);

      const merged = [...a, ...b, ...c];
      const normalized = merged.map(normalizeOffer);
      const unique = uniqueOffers(normalized);

      unique.sort((x, y) => x.total_price - y.total_price);
      return unique;
    });

    const start = (page - 1) * per_page;
    const paginated = results.slice(start, start + per_page);

    res.json({
      meta: {
        total_results: results.length,
        page,
        per_page,
      },
      results: paginated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// -----------------------------------------------------
// START SERVER
// -----------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
});
