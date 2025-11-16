import express from "express";

const app = express();
app.use(express.json());

// -------------------- CONSTANTES --------------------
const CACHE_TTL_SEC = Number(process.env.CACHE_TTL_SEC || 300);
const DEFAULT_LIMIT = 20;

// -------------------- UTILITÁRIOS --------------------
const cache = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...msg) => console.log(`[FlightScan]`, new Date().toISOString(), ...msg);

// -------------------- MOCK DE OFERTAS --------------------
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

// -------------------- PROVEDORES --------------------
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
async function prov
