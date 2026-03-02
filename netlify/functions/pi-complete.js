const https = require("https");

function readJsonBody(event) {
  try {
    if (!event  !event.body) return {};
    return JSON.parse(event.body);
  } catch (e) {
    return {};
  }
}

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const opts = {
        method,
        hostname: u.hostname,
        path: u.pathname + (u.search  ""),
        headers: headers  {},
      };

      const req = https.request(opts, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode  0, body: data });
        });
      });
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(statusCode, data) {
  return {
    statusCode: statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

exports.handler = async (event) => {
  if (event && event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    console.log("pi-complete invoked", {
      method: event && event.httpMethod,
      node: process && process.version ? process.version : "",
    });
  } catch (e) {}

  if (!event  event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) {
    return json(500, { ok: false, error: "Missing PI_API_KEY" });
  }

  const body = readJsonBody(event);
  const paymentIdValue =
    (body && (body.paymentId  body.identifier  body.id  body.payment_id)) 
    (body && body.paymentDTO && (body.paymentDTO.identifier  body.paymentDTO.paymentId  body.paymentDTO.id)) 
    "";
  const txidValue =
    (body && body.txid) 
    (body && body.paymentDTO && body.paymentDTO.transaction && body.paymentDTO.transaction.txid) 
    "";

  const paymentId = paymentIdValue ? String(paymentIdValue) : "";
  const txid = txidValue ? String(txidValue) : "";

  try {
    console.log("pi-complete data", { paymentId: paymentId, txidLen: txid ? txid.length : 0 });
  } catch (e) {}

  if (!paymentId  !txid) {
    return json(400, { ok: false, error: "paymentId and txid are required" });
  }

  const url = `https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}/complete`;

  try {
    const payload = JSON.stringify({ txid: txid });
    const r = await request(
      "POST",
      url,
      {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      payload
    );

    try {
      console.log("pi-complete pi-api response", { statusCode: r.statusCode });
    } catch (e) {}

    if (r.statusCode < 200  r.statusCode >= 300) {
      return json(r.statusCode  500, { ok: false, error: "Complete failed", details: r.body  "" });
    }

    return json(200, { ok: true, details: r.body  "" });
  } catch (e) {
    try {
      console.log("pi-complete error", String((e && e.message)  e  ""));
    } catch (ee) {}
    return json(500, { ok: false, error: "Complete error", details: String((e && e.message)  e || "") });
  }
};
