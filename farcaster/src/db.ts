import fs from "fs";
import path from "path";
import Knex from "knex";

const dataDir = path.join(
  import.meta.url.split(":").slice(1).join(":"),
  "../../../.data"
);

let knex: ReturnType<typeof Knex>;

export function getDB() {
  if (!knex) {
    knex = Knex({
      client: "sqlite3",
      connection: {
        filename: path.join(dataDir, "farcaster.sqlite"),
      },
      useNullAsDefault: true,
    });
  }

  return knex;
}

export async function initDB() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = getDB();

  if (!(await db.schema.hasTable("casts"))) {
    await db.schema.createTable("casts", (table) => {
      table.string("hash");
      table.timestamp("timestamp");
      table.integer("fid");
      table.string("text");
      table.integer("parentCastFid");
      table.string("parentCastHash");
      table.string("rawCastAddBody");

      table.unique("hash");
    });
  }
}
