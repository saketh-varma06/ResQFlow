import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

const QUAKE_FIXTURE = JSON.stringify({ type: "FeatureCollection", features: [
  { id: "in1", properties: { mag: 5.1, place: "12km NW of Kohima, India", time: 1793500000000, tsunami: 0, url: "https://earthquake.usgs.gov/earthquakes/eventpage/in1" }, geometry: { coordinates: [94.1, 25.7, 40] } },
  { id: "far1", properties: { mag: 6.0, place: "Vanuatu", time: 1793501000000, tsunami: 0, url: "https://earthquake.usgs.gov/earthquakes/eventpage/far1" }, geometry: { coordinates: [167.0, -16.0, 10] } },
] });
const WEATHER_FIXTURE = JSON.stringify({ latitude: 28.65, longitude: 77.17, timezone: "Asia/Kolkata", current: { temperature_2m: 31.2, relative_humidity_2m: 64, precipitation: 0.4, rain: 0.4, weather_code: 63, wind_speed_10m: 14.5, wind_gusts_10m: 30.1 }, daily: { time: ["2026-11-01", "2026-11-02", "2026-11-03"], precipitation_sum: [2.1, 0, 5.4], precipitation_probability_max: [80, 10, 90] } });
const GDACS_FIXTURE = `<?xml version="1.0"?><rss><channel>
<item><title>Red notification for tropical cyclone in India</title><description>Cyclone affects India coast.</description><link>http://www.gdacs.org/report.aspx?eventtype=TC&amp;eventid=1001</link><pubDate>Sun, 01 Nov 2026 02:23:45 GMT</pubDate></item>
<item><title>Green earthquake (Magnitude 5M) in Japan</title><description>Quake near Japan.</description><link>http://www.gdacs.org/report.aspx?eventtype=EQ&amp;eventid=1002</link><pubDate>Sun, 01 Nov 2026 01:00:00 GMT</pubDate></item>
</channel></rss>`;

let mode: "ok" | "down" = "ok";
function stubFetch() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (mode === "down") throw new Error("network down");
    const text = url.includes("open-meteo") ? WEATHER_FIXTURE : url.includes("usgs") || url.includes("earthquake") ? QUAKE_FIXTURE : GDACS_FIXTURE;
    return { ok: true, status: 200, text: async () => text };
  }));
}

const SACHET_FIXTURE = `<?xml version="1.0"?><rss><channel>
<item><title>Heavy Rain with surface wind (40-50 kmph) is likely to occur at isolated places over Bijapur, Dantewada in next 3 hours.</title><link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=111</link><category>Met</category><pubDate>Tue, 03 Nov 2026 01:58:34 GMT</pubDate></item>
<item><title>ଭାରତ ପାଣିପାଗ ବିଭାଗର ତଥ୍ୟ ଅନୁଯାୟୀ ମଧ୍ୟମ ଧରଣର ବର୍ଷା ହେବାର ସମ୍ଭାବନା ଅଛି SRC, Odisha</title><link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=222</link><category>Met</category><pubDate>Tue, 03 Nov 2026 02:22:49 GMT</pubDate></item>
<item><title>Heavy Rain with surface wind (40-50 kmph) is likely to occur at isolated places over Bijapur, Dantewada in next 3 hours.</title><link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=333</link><category>Met</category><pubDate>Tue, 03 Nov 2026 02:30:00 GMT</pubDate></item>
<item><title>Thunderstorm with lightning is very likely to occur at isolated places over Patna in next 3 hours.</title><link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=444</link><category>Met</category><pubDate>Tue, 03 Nov 2026 02:45:00 GMT</pubDate></item>
</channel></rss>`;

describe("external parsers (pure)", () => {
  it("parses NDMA SACHET RSS: English editions only, deduped, newest first, severity from headline", async () => {
    const { parseSachetRss } = await import("./services/external.service");
    const items = parseSachetRss(SACHET_FIXTURE);
    expect(items).toHaveLength(2);
    expect(items[0].headline).toMatch(/Thunderstorm/);
    expect(items[0].severity).toBe("ORANGE");
    expect(items[1].headline).toMatch(/Bijapur/);
    expect(items[1].severity).toBe("ORANGE");
    expect(items[1].category).toBe("Met");
    expect(items[1].link).toContain("identifier=");
  });
  it("filters USGS features to the region and sorts newest first", async () => {
    const { filterQuakes } = await import("./services/external.service");
    const out = filterQuakes(JSON.parse(QUAKE_FIXTURE).features);
    expect(out).toHaveLength(1);
    expect(out[0].place).toMatch(/Kohima/);
    expect(out[0].magnitude).toBe(5.1);
  });
  it("parses GDACS RSS items with alert level, event type and India relevance", async () => {
    const { parseGdacsRss } = await import("./services/external.service");
    const items = parseGdacsRss(GDACS_FIXTURE);
    expect(items).toHaveLength(2);
    expect(items[0].alertLevel).toBe("RED");
    expect(items[0].eventType).toBe("TC");
    expect(items[0].indiaRelated).toBe(true);
    expect(items[1].alertLevel).toBe("GREEN");
    expect(items[1].indiaRelated).toBe(false);
  });
});

describe("external overview endpoint", () => {
  let token = "";
  beforeAll(async () => {
    stubFetch();
    const { app } = await import("./app");
    const { clearDb } = await import("./test/db");
    await clearDb();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ext User", email: "ext@test.local", password: "Citizen@12345" });
    token = reg.body.data.token;
    void app;
  });
  afterEach(() => { mode = "ok"; });

  it("returns all three sources with provenance (source + fetchedAt)", async () => {
    const { app } = await import("./app");
    const { resetExternalCache } = await import("./services/external.service");
    resetExternalCache(); mode = "ok"; stubFetch();
    const r = await request(app).get("/api/external/overview").set("Authorization", `Bearer ${token}`);
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.weather.status).toBe("ok");
    expect(d.weather.source).toBe("Open-Meteo");
    expect(d.weather.data.condition).toBe("Moderate rain");
    expect(d.weather.data.forecast).toHaveLength(3);
    expect(typeof d.weather.fetchedAt).toBe("string");
    expect(d.earthquakes.data).toHaveLength(1);
    expect(d.gdacs.data[0].alertLevel).toBe("RED");
  });

  it("serves the stale cache when a source goes down, and reports unavailable with no cache", async () => {
    const { app } = await import("./app");
    const svc = await import("./services/external.service");
    mode = "down"; stubFetch();
    // Move past the weather TTL so the next request must refetch; the source is down,
    // so the service must serve the last good copy marked stale — never fabricated data.
    const spy = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60_000);
    const warm = await request(app).get("/api/external/overview").set("Authorization", `Bearer ${token}`);
    spy.mockRestore();
    expect(warm.body.data.weather.status).toBe("ok");
    expect(warm.body.data.weather.stale).toBe(true);
    // cold cache + down = unavailable with null data
    svc.resetExternalCache();
    const cold = await request(app).get("/api/external/overview").set("Authorization", `Bearer ${token}`);
    expect(cold.body.data.weather.status).toBe("unavailable");
    expect(cold.body.data.weather.data).toBeNull();
    expect(cold.body.data.earthquakes.status).toBe("unavailable");
    svc.resetExternalCache();
  });

  it("requires authentication", async () => {
    const { app } = await import("./app");
    expect((await request(app).get("/api/external/overview")).status).toBe(401);
  });
});

describe("external geocode endpoint", () => {
  let token = "";
  const GEO_FIXTURE = JSON.stringify({ results: [
    { id: 1261481, name: "New Delhi", admin1: "Delhi", country: "India", latitude: 28.63576, longitude: 77.22445, population: 29617000 },
    { id: 7279746, name: "Delhi Cantonment", admin1: "Delhi", country: "India", latitude: 28.59613, longitude: 77.12937 },
  ] });
  beforeAll(async () => {
    const { app } = await import("./app");
    const { clearDb } = await import("./test/db");
    const { resetExternalCache } = await import("./services/external.service");
    await clearDb();
    const reg = await request(app).post("/api/auth/register").send({ name: "Geo Tester", email: "geo@test.local", password: "Citizen@12345", area: "North District" });
    token = reg.body.data.token;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (!url.includes("geocoding-api")) throw new Error(`unexpected fetch ${url}`);
      return { ok: true, status: 200, text: async () => GEO_FIXTURE };
    }));
    resetExternalCache();
    void app;
  });
  it("requires authentication", async () => {
    const { app } = await import("./app");
    const r = await request(app).get("/api/external/geocode?q=delhi");
    expect(r.status).toBe(401);
  });
  it("maps Open-Meteo geocoding results with provenance", async () => {
    const { app } = await import("./app");
    const r = await request(app).get("/api/external/geocode?q=delhi").set({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe("ok");
    expect(r.body.data.source).toMatch(/Open-Meteo Geocoding/);
    expect(r.body.data.data).toHaveLength(2);
    expect(r.body.data.data[0]).toMatchObject({ name: "New Delhi", country: "India", latitude: 28.63576, longitude: 77.22445 });
  });
  it("rejects too-short queries", async () => {
    const { app } = await import("./app");
    const r = await request(app).get("/api/external/geocode?q=d").set({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(400);
  });
});
