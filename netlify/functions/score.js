// netlify/functions/score.js
// A DEMO scoring function: produces realistic outputs without revealing real IP.
// Uses a secret salt so users can't easily reverse engineer mappings.

const crypto = require("crypto");

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function stableHashScore(payload, secret) {
  const h = crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
  // convert first 8 hex chars -> 0..1
  const x = parseInt(h.slice(0, 8), 16) / 0xffffffff;
  return x;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const secret = process.env.DEMO_SECRET || "local-dev-secret";
    const body = JSON.parse(event.body || "{}");

    // IMPORTANT: Treat this as demo features, not your real feature engineering.
    // Keep these coarse and generic.
    const {
      bank_monthly_income = 0,
      bank_monthly_spend = 0,
      bank_balance_volatility = 0,   // 0..1
      utilities_on_time_rate = 0,    // 0..1
      remittance_consistency = 0,    // 0..1
      country_group = "global"
    } = body;

    // Base score is mostly random-but-stable per payload, then nudged by simple signals.
    const base01 = stableHashScore(body, secret);       // 0..1 stable
    let score = 520 + base01 * 240;                     // 520..760

    // Nudges (demo-only)
    const savingsRate = bank_monthly_income > 0
      ? clamp((bank_monthly_income - bank_monthly_spend) / bank_monthly_income, -1, 1)
      : 0;

    score += savingsRate * 60;                          // reward positive cashflow
    score += (utilities_on_time_rate - 0.7) * 110;      // utilities matter
    score += (remittance_consistency - 0.5) * 70;       // consistency helps
    score += (0.35 - bank_balance_volatility) * 90;     // lower volatility helps

    // small country-group bump (purely demo, non-sensitive)
    if (country_group === "high_signal") score += 10;

    score = Math.round(clamp(score, 300, 850));

    // Build lender-style “risk attributes” (coarse)
    const attributes = {
      cashflow_stability: clamp(1 - bank_balance_volatility, 0, 1),
      spend_control: clamp(savingsRate, 0, 1),
      utilities_reliability: clamp(utilities_on_time_rate, 0, 1),
      remittance_stability: clamp(remittance_consistency, 0, 1),
    };

    // Reason codes: high-level, not model-revealing
    const reasonCodes = [];
    if (utilities_on_time_rate < 0.85) reasonCodes.push("UTIL_ON_TIME_BELOW_TARGET");
    if (bank_balance_volatility > 0.40) reasonCodes.push("CASHFLOW_VOLATILE");
    if (savingsRate < 0.10) reasonCodes.push("LOW_SAVINGS_RATE");
    if (remittance_consistency < 0.55) reasonCodes.push("REMITTANCE_INCONSISTENT");

    if (reasonCodes.length === 0) reasonCodes.push("STRONG_ALTERNATIVE_HISTORY");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score,
        score_band:
          score >= 760 ? "Excellent" :
          score >= 700 ? "Good" :
          score >= 640 ? "Fair" : "Building",
        attributes,
        reasonCodes,
        disclaimer:
          "Demo score for product preview only. Not a consumer report or lending decision."
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error", detail: String(err) }) };
  }
};
