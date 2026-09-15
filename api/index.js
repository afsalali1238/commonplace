import server from "../dist/server/server.js";

export default async function handler(req, res) {
  try {
    // 1. Reconstruct the full absolute URL required by the Web Request standard
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const url = new URL(req.url, `${protocol}://${host}`);

    // 2. Create the Web Request init options
    const init = {
      method: req.method,
      headers: req.headers,
    };

    // Include the body if it's not a GET/HEAD request
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      if (chunks.length > 0) {
        init.body = Buffer.concat(chunks);
      }
    }

    // 3. Create the standard Web Request object
    const request = new Request(url.href, init);

    // 4. Execute the TanStack Start server fetch handler
    const response = await server.fetch(request, process.env, {});

    // 5. Translate the Web Response back to the Vercel Node response
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      // Handle setting multiple cookies properly
      if (key.toLowerCase() === "set-cookie") {
        let existing = res.getHeader("set-cookie") || [];
        if (!Array.isArray(existing)) existing = [existing];
        res.setHeader("set-cookie", [...existing, value]);
      } else {
        res.setHeader(key, value);
      }
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Vercel Node Adapter Error:", error);
    res.statusCode = 500;
    // Never echo error details to clients in production (message can leak
    // stack frames, paths, or SQL). Full details stay in server logs.
    res.end(
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : `Internal Server Error: ${error.message}`,
    );
  }
}
