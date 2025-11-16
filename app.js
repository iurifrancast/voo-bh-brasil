import express from "express";

const app = express();
app.use(express.json());

const CACHE_TTL_SEC = process.env.CACHE_TTL_SEC
  ? parseInt(process.env.CACHE_TTL_SEC)
  : 300;

const DEFAULT_LIMIT = 20;

const cache = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function log(...msg) { console.log(`[FlightScan]`, new Date().toISOString(), ...msg); }

function generateMockOffers(count = 20) {
  const offers = [];
  const airlines = ["Azul", "LATAM", "Gol"];
  const airports = ["CNF", "GRU", "GIG", "BSB"];
  for (let i = 0; i < count; i++) {
    const price = Math.floor(Math.random() * 2000) + 300;
    const tax = Math.floor(price * 0.15);
    offers.push({
      unique_id: `OFFER-${Date.now()}-${i}`,
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

async function providerA(params) { await sleep(150); const o = generateMockOffers(params.limit || 20); o.forEach(x=>x.source="PROVIDER_A"); return o; }
async function providerB(params) { await sleep(250); const o = generateMockOffers(params.limit || 20); o.forEach(x=>x.source="PROVIDER_B"); return o; }
async function providerC(params) { await sleep(350); const o = generateMockOffers(params.limit || 20); o.forEach(x=>x.source="PROVIDER_C"); return o; }

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
  const out = [];
  for (const o of list) {
    if (!seen.has(o.id)) {
      seen.add(o.id);
      out.push(o);
    }
  }
  return out;
}

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

app.get("/search", async (req, res) => {
  try {
    const {
      origins = "CNF",
      from_date = "2026-04-01",
      to_date = "2026-04-30",
      page = 1,
      per_page = DEFAULT_LIMIT,
    } = req.query;

    const cacheKey = JSON.stringify({ origins, from_date, to_date });

    const results = await withCache(cacheKey, async () => {
      log("Fetching from providers…");
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
    const paginated = results.slice(start, start + Number(per_page));

    res.json({
      meta: {
        total_results: results.length,
        page: Number(page),
        per_page: Number(per_page),
      },
      results: paginated,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { log(`Server running on port ${PORT}`); });
