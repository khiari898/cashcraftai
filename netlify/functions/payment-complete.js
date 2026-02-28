const https = require("https");

const PI_SERVER_API_KEY = process.env.PI_SERVER_API_KEY || "";
const PI_API_BASE = process.env.PI_API_BASE || "https://api.minepi.com/v2";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function piRequest(method, apiPath, bodyObj) {
  if (!PI_SERVER_API_KEY) {
    const err = new Error("PI_SERVER_API_KEY is not set");
    err.statusCode = 500;
    throw err;
  }

  const url = new URL(PI_API_BASE + apiPath);
  const body = bodyObj ? JSON.stringify(bodyObj) : "";

  const options = {
    method,
    hostname: url.hostname,
    path: url.pathname + url.search,
    headers: {
      Authorization: `Key ${PI_SERVER_API_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const r = https.request(options, (resp) => {
      let data = "";
      resp.on("data", (chunk) => {
        data += chunk;
      });
      resp.on("end", () => {
        let parsed = data;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (e) {
          parsed = data;
        }

        const statusCode = resp.statusCode || 0;
        if (statusCode >= 200 && statusCode < 300) {
          resolve(parsed);
          return;
        }

        const err = new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
        err.statusCode = statusCode;
        err.response = parsed;
        reject(err);
      });
    });

    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const paymentId = body && body.paymentId ? String(body.paymentId) : "";
    const txid = body && body.txid ? String(body.txid) : "";

    if (!paymentId) {
      return jsonResponse(400, { error: "paymentId is required" });
    }

    if (!txid) {
      return jsonResponse(400, { error: "txid is required" });
    }

    const result = await piRequest(
      "POST",
      `/payments/${encodeURIComponent(paymentId)}/complete`,
      { txid: txid }
    );

    return jsonResponse(200, result);
  } catch (err) {
    return jsonResponse(502, {
      error: "Pi API complete failed",
      message: err && err.message ? err.message : "Unknown error",
      statusCode: err && err.statusCode ? err.statusCode : null,
      response: err && err.response ? err.response : null
    });
  }
};
