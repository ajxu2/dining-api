import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import DiningParser from "./parser/diningParser";
import Scraper from "./utils/requestUtils";
import { ILocation } from "types";

const PORT = process.env.PORT ?? 5010;
let cachedLocations: ILocation[];

async function reload(): Promise<void> {
  const now = new Date();
  console.log(`Reloading Dining API: ${now}`);
  const scraper = new Scraper();
  await scraper.initialize();
  const parser = new DiningParser(scraper);
  const locations = await parser.process();
  await scraper.close();
  if (
    cachedLocations !== undefined &&
    locations.length < cachedLocations.length - 1
  ) {
    console.log(
      "Ignored location fetch since it (likely) has missing data",
      locations
    );
  } else {
    cachedLocations = locations;
    console.log("Dining API cache reloaded");
  }
}

export const app = new Elysia();

app.use(cors());

app.get("/", () => {
  return "ScottyLabs Dining API";
});

app.get("/locations", () => ({ locations: cachedLocations }));

app.get("/location/:name", ({ params: { name } }) => {
  const filteredLocation = cachedLocations.filter((location) => {
    return location.name?.toLowerCase().includes(name.toLowerCase());
  });
  return {
    locations: filteredLocation,
  };
});

app.get("/locations/time/:day/:hour/:min", ({ params: { day, hour, min } }) => {
  const result = cachedLocations.filter((el) => {
    let returning = false;
    el.times?.forEach((element) => {
      const startMins =
        element.start.day * 1440 +
        element.start.hour * 60 +
        element.start.minute;
      const endMins =
        element.end.day * 1440 + element.end.hour * 60 + element.end.minute;
      const currentMins =
        parseInt(day) * 1440 + parseInt(hour) * 60 + parseInt(min);
      if (currentMins >= startMins && currentMins < endMins) {
        returning = true;
      }
    });
    return returning;
  });
  return { locations: result };
});

// Update the cache every 10 minutes
const interval = 1000 * 60 * 10;
setInterval(() => {
  reload().catch(console.error);
}, interval);

// Initial load and start the server
reload().then(() => {
  app.listen(PORT);

  console.log(
    `Dining API is running at ${app.server?.hostname}:${app.server?.port}`
  );
});
