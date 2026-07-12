import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(import.meta.dirname, '../.env') });

const REDIS_HOST = process.env.REDIS_HOST ?? (() => {
  throw new Error("REDIS_HOST is not set");
})();

const REDIS_PORT = process.env.REDIS_PORT ?? (() => {
  throw new Error("REDIS_PORT is not set");
})();

export const CWD = process.env.CWD ?? (() => {
  throw new Error("CWD not set");
})();

export const connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT)
}