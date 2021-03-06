
import express from 'express'
import cors from "cors"
import redis from "redis";
import getBalance from "./getBalance"

const app = express()
const port = process.env.PORT || 8000
const CACHE_TTL_MINS: number = parseInt(process.env.CACHE_TTL_MINS as string, 1) || 1; // default to 1 minute

const CACHE_TTL = 1000 * 60 * CACHE_TTL_MINS; // In ms

const client = redis.createClient({
 
  url:
    process.env.REDIS_URL ||
    "rediss://:pfd845cacdc6b8464db9533999d877ad94815c55f26d803385abcd11138307dec@ec2-54-156-115-115.compute-1.amazonaws.com:17219",
});
client.on("error", (error: Error) => {
  console.error(error);
});

const updateCache = (
  data: any,
  callback: (err: Error | null, reply: string) => void,
) => {
  const cachedData: any = { ...data, lastUpdate: new Date().getTime() };
  client.set("status", JSON.stringify(cachedData), callback);
};

app.use(cors())

app.get("/", async (req, res) => {
  client.get("status", async (_err, reply) => {
    if (!reply) {
      const status = await getBalance()
      if (!status) {
        return res.status(404).send({ status: "Not Found" });
      }

      updateCache(status, redis.print);
      return res.json(status);
    }
    const data = JSON.parse(reply);
    res.json(data);

    // Update if expired
    if (!data.lastUpdate || data.lastUpdate + CACHE_TTL < new Date().getTime()) {
      // Update cache with current data then overwrite
      // This avoids re-fetching tens of times
      updateCache(data, async () => {
        const newStatus = await getBalance()
        updateCache(newStatus, redis.print);
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})