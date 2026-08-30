"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

function normalizeOrigin(value) {
  const fallback = `http://localhost:${PORT}`;
  const raw = String(value || fallback).trim().replace(/\/+$/, "");

  try {
    return new URL(raw).origin;
  } catch {
    return fallback;
  }
}

const SITE_ORIGIN = normalizeOrigin(process.env.SITE_ORIGIN);
const PAYPAL_MODE = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
const PAYPAL_CLIENT_ID = String(process.env.PAYPAL_CLIENT_ID || "").trim();
const PAYPAL_CLIENT_SECRET = String(process.env.PAYPAL_CLIENT_SECRET || "").trim();
const PAYPAL_CONFIGURED = Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);

const PAYPAL_API_BASE =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const PENDING_FILE = path.join(DATA_DIR, "pending-orders.json");
const RESERVATIONS_FILE = path.join(DATA_DIR, "reservations.json");
const CONTACT_FILE = path.join(DATA_DIR, "contact-messages.json");
const PENDING_ORDER_TTL_MS = 60 * 60 * 1000;

const COURSES = {
  initiation: { name: "Initiation orientale", price: 15, dates: ["2026-09-07"] },
  technique: { name: "Technique & musicalité", price: 18, dates: ["2026-09-09", "2026-09-16"] },
  choreographie: { name: "Chorégraphie", price: 20, dates: ["2026-09-12"] },
  "atelier-paris": { name: "Atelier — Paris", price: 20, dates: ["2026-09-13", "2026-10-04", "2026-11-08"] },
  "atelier-clichy": { name: "Atelier — Clichy", price: 20, dates: ["2026-09-20"] },
  "atelier-pantin": { name: "Atelier — Pantin", price: 20, dates: ["2026-09-22", "2026-10-20", "2026-11-17"] }
};

function moneyValue(amount) {
  return Number(amount).toFixed(2);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  return email.length > 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCart(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 20) return null;

  const merged = new Map();

  for (const raw of rawItems) {
    if (!isPlainObject(raw)) return null;

    const courseId = String(raw.courseId || "");
    const date = String(raw.date || "");
    const quantity = Number(raw.quantity);
    const course = COURSES[courseId];

    if (!course || !course.dates.includes(date)) return null;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) return null;

    const key = `${courseId}__${date}`;
    const previous = merged.get(key) || { courseId, date, quantity: 0 };
    previous.quantity += quantity;

    if (previous.quantity > 4) return null;
    merged.set(key, previous);
  }

  const items = [...merged.values()].map((item) => {
    const course = COURSES[item.courseId];
    return {
      ...item,
      courseName: course.name,
      unitPrice: moneyValue(course.price),
      lineTotal: moneyValue(course.price * item.quantity)
    };
  });

  const total = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  if (!Number.isFinite(total) || total <= 0) return null;

  return { items, total: moneyValue(total), currency: "EUR" };
}

async function ensureDataFiles() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });

  for (const [file, fallback] of [
    [PENDING_FILE, {}],
    [RESERVATIONS_FILE, []],
    [CONTACT_FILE, []]
  ]) {
    try {
      await fs.promises.access(file);
    } catch {
      await fs.promises.writeFile(file, `${JSON.stringify(fallback, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    }
  }
}

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch (error) {
    console.error(`Lecture JSON impossible : ${file}`, error);
    return structuredClone(fallback);
  }
}

let writeQueue = Promise.resolve();

function atomicWriteJson(file, data) {
  writeQueue = writeQueue.then(async () => {
    const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.promises.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.promises.rename(tmp, file);
  });

  return writeQueue;
}

function cleanPendingOrders(pending) {
  const now = Date.now();

  for (const [id, order] of Object.entries(pending || {})) {
    const createdAt = new Date(order?.createdAt || "").getTime();

    if (!Number.isFinite(createdAt) || now - createdAt > PENDING_ORDER_TTL_MS) {
      delete pending[id];
    }
  }

  return pending;
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      formAction: ["'self'", "https://www.paypal.com", "https://www.sandbox.paypal.com"],
      upgradeInsecureRequests: IS_PRODUCTION ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: "32kb", strict: true }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false });
const paymentLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

app.use("/api/", apiLimiter);
app.use("/api/paypal/", paymentLimiter);
app.use("/api/contact", contactLimiter);

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  if (!origin || origin === SITE_ORIGIN) return next();
  return res.status(403).json({ error: "Origine refusée." });
}

app.use("/api/paypal/", requireSameOrigin);
app.use("/api/contact", requireSameOrigin);

let cachedPayPalAccessToken = null;
let cachedPayPalAccessTokenExpiresAt = 0;

async function getPayPalAccessToken() {
  if (!PAYPAL_CONFIGURED) throw new Error("PayPal n'est pas configuré.");

  const now = Date.now();
  if (cachedPayPalAccessToken && now < cachedPayPalAccessTokenExpiresAt - 60_000) {
    return cachedPayPalAccessToken;
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    console.error("OAuth PayPal :", response.status, data);
    throw new Error("Authentification PayPal impossible.");
  }

  cachedPayPalAccessToken = data.access_token;
  cachedPayPalAccessTokenExpiresAt = now + Number(data.expires_in || 300) * 1000;
  return cachedPayPalAccessToken;
}

async function paypalRequest(endpoint, options = {}) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(20_000)
  });

  return {
    response,
    data: await response.json().catch(() => ({}))
  };
}

app.get("/api/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, environment: NODE_ENV, paypalMode: PAYPAL_MODE, paypalConfigured: PAYPAL_CONFIGURED });
});

app.get("/api/config", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ paypalMode: PAYPAL_MODE, paypalConfigured: PAYPAL_CONFIGURED });
});

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    if (!PAYPAL_CONFIGURED) return res.status(503).json({ error: "PayPal n'est pas configuré." });

    const cart = validateCart(req.body?.items);
    if (!cart) return res.status(400).json({ error: "Panier invalide." });

    const returnUrl = `${SITE_ORIGIN}/index.html?paypal=success#planning`;
    const cancelUrl = `${SITE_ORIGIN}/index.html?paypal=cancel#planning`;

    const paypalItems = cart.items.map((item) => ({
      name: item.courseName.slice(0, 127),
      quantity: String(item.quantity),
      unit_amount: { currency_code: cart.currency, value: item.unitPrice },
      description: item.date
    }));

    const { response, data } = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          description: "Réservations BY FIGGY",
          items: paypalItems,
          amount: {
            currency_code: cart.currency,
            value: cart.total,
            breakdown: {
              item_total: { currency_code: cart.currency, value: cart.total }
            }
          }
        }],
        payment_source: {
          paypal: {
            experience_context: {
              user_action: "PAY_NOW",
              return_url: returnUrl,
              cancel_url: cancelUrl
            }
          }
        }
      })
    });

    if (!response.ok || typeof data.id !== "string") {
      console.error("Création PayPal :", response.status, data);
      return res.status(502).json({ error: "Impossible de créer la commande PayPal." });
    }

    const approvalUrl =
      data.links?.find((link) => link?.rel === "payer-action")?.href ||
      data.links?.find((link) => link?.rel === "approve")?.href;

    if (typeof approvalUrl !== "string" || !approvalUrl.startsWith("https://")) {
      console.error("Lien PayPal absent :", data.links);
      return res.status(502).json({ error: "Lien d'approbation PayPal introuvable." });
    }

    const pending = cleanPendingOrders(await readJsonFile(PENDING_FILE, {}));
    pending[data.id] = {
      orderId: data.id,
      items: cart.items,
      total: cart.total,
      currency: cart.currency,
      createdAt: new Date().toISOString(),
      captureRequestId: crypto.randomUUID()
    };

    await atomicWriteJson(PENDING_FILE, pending);

    res.set("Cache-Control", "no-store");
    return res.json({ orderId: data.id, approvalUrl });
  } catch (error) {
    console.error("create-order :", error);
    return res.status(500).json({ error: "Erreur serveur lors de la création du paiement." });
  }
});

app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    if (!PAYPAL_CONFIGURED) return res.status(503).json({ error: "PayPal n'est pas configuré." });

    const { orderId } = req.body || {};

    if (typeof orderId !== "string" || orderId.length < 5 || orderId.length > 80) {
      return res.status(400).json({ error: "Identifiant PayPal invalide." });
    }

    let reservations = await readJsonFile(RESERVATIONS_FILE, []);
    if (!Array.isArray(reservations)) reservations = [];

    const existing = reservations.filter((item) => item?.orderId === orderId);
    if (existing.length) {
      return res.json({ success: true, alreadyCaptured: true, reservations: existing });
    }

    const pending = cleanPendingOrders(await readJsonFile(PENDING_FILE, {}));
    const pendingOrder = pending[orderId];

    if (!pendingOrder) return res.status(404).json({ error: "Commande introuvable ou expirée." });

    const { response, data } = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": pendingOrder.captureRequestId },
      body: "{}"
    });

    if (!response.ok) {
      console.error("Capture PayPal :", response.status, data);
      return res.status(502).json({ error: "Impossible de confirmer le paiement PayPal." });
    }

    if (data.status !== "COMPLETED") return res.status(409).json({ error: "Le paiement PayPal n'est pas terminé." });

    const captures = (data.purchase_units || []).flatMap((unit) => unit?.payments?.captures || []);
    const capturedTotal = captures.reduce((sum, capture) => sum + Number(capture?.amount?.value || 0), 0);
    const currencies = new Set(captures.map((capture) => capture?.amount?.currency_code).filter(Boolean));

    if (currencies.size !== 1 || !currencies.has(pendingOrder.currency) || moneyValue(capturedTotal) !== pendingOrder.total) {
      console.error("Montant PayPal incohérent :", { expected: pendingOrder.total, capturedTotal, currencies: [...currencies] });
      return res.status(409).json({ error: "Le montant du paiement ne correspond pas au panier." });
    }

    const payerFirstName =
      data?.payer?.name?.given_name ||
      data?.payment_source?.paypal?.name?.given_name ||
      "Client PayPal";

    const payerEmail =
      data?.payer?.email_address ||
      data?.payment_source?.paypal?.email_address ||
      "";

    const captureId = captures[0]?.id || null;
    const createdAt = new Date().toISOString();

    const newReservations = pendingOrder.items.map((item) => ({
      orderId,
      captureId,
      status: data.status,
      courseId: item.courseId,
      courseName: item.courseName,
      date: item.date,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.lineTotal,
      currency: pendingOrder.currency,
      firstName: String(payerFirstName).trim().slice(0, 60),
      email: String(payerEmail).trim().toLowerCase().slice(0, 254),
      createdAt
    }));

    reservations.push(...newReservations);
    await atomicWriteJson(RESERVATIONS_FILE, reservations);

    delete pending[orderId];
    await atomicWriteJson(PENDING_FILE, pending);

    res.set("Cache-Control", "no-store");
    return res.json({ success: true, reservations: newReservations });
  } catch (error) {
    console.error("capture-order :", error);
    return res.status(500).json({ error: "Erreur serveur lors de la confirmation du paiement." });
  }
});

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.CONTACT_TO
  );
}

async function sendContactMail(message) {
  if (!smtpConfigured()) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  await transporter.sendMail({
    from: process.env.CONTACT_FROM || process.env.SMTP_USER,
    to: process.env.CONTACT_TO,
    replyTo: message.email,
    subject: `[BY FIGGY] ${message.subject}`,
    text: `Prénom : ${message.firstName}\nEmail : ${message.email}\nSujet : ${message.subject}\n\n${message.message}`
  });

  return true;
}

app.post("/api/contact", async (req, res) => {
  try {
    const { firstName, email, subject, message } = req.body || {};

    if (typeof firstName !== "string" || firstName.trim().length < 1 || firstName.trim().length > 60) {
      return res.status(400).json({ error: "Prénom invalide." });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: "Adresse e-mail invalide." });
    if (typeof subject !== "string" || subject.trim().length < 1 || subject.trim().length > 100) {
      return res.status(400).json({ error: "Sujet invalide." });
    }
    if (typeof message !== "string" || message.trim().length < 1 || message.trim().length > 3000) {
      return res.status(400).json({ error: "Message invalide." });
    }

    const entry = {
      id: crypto.randomUUID(),
      firstName: firstName.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString()
    };

    if (!smtpConfigured()) {
      return res.status(503).json({ error: "L'envoi d'e-mail n'est pas encore configuré." });
    }

    await sendContactMail(entry);

    let messages = await readJsonFile(CONTACT_FILE, []);
    if (!Array.isArray(messages)) messages = [];
    messages.push(entry);
    await atomicWriteJson(CONTACT_FILE, messages);

    return res.json({ success: true });
  } catch (error) {
    console.error("contact :", error);
    return res.status(500).json({ error: "Impossible d'envoyer le message." });
  }
});

app.use(express.static(PUBLIC_DIR, {
  index: false,
  etag: true,
  maxAge: IS_PRODUCTION ? "1h" : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store");
    }
  }
}));

app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Route API introuvable." });
  return res.status(404).send("Page introuvable.");
});

app.use((error, req, res, next) => {
  console.error("Erreur serveur :", error);
  if (res.headersSent) return next(error);
  if (req.path.startsWith("/api/")) return res.status(500).json({ error: "Erreur serveur." });
  return res.status(500).send("Erreur serveur.");
});

async function startServer() {
  await ensureDataFiles();

  return app.listen(PORT, () => {
    console.log("");
    console.log("BY FIGGY");
    console.log(`Site : ${SITE_ORIGIN}`);
    console.log(`Environnement : ${NODE_ENV}`);
    console.log(`PayPal : ${PAYPAL_MODE}`);
    console.log(`PayPal configuré : ${PAYPAL_CONFIGURED ? "oui" : "non"}`);
    console.log(`Contact SMTP configuré : ${smtpConfigured() ? "oui" : "non"}`);
    console.log("");
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Impossible de démarrer BY FIGGY :", error);
    process.exit(1);
  });
}

module.exports = { app, startServer, validateCart, COURSES, normalizeOrigin };
