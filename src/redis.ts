import { RedisClientType, createClient } from "redis";
import { promisify } from "util";

class Redis {
    private client: RedisClientType;

    constructor() {
        this.client = createClient();

        this.client.on("error", (err) => {
            console.error("Redis Client Error", err);
        });

        this.client.connect().catch((err) => {
            console.error("Failed to connect to Redis:", err);
        });
    }

    public async getAsync(key: string) {
        return await this.client.get(key);
    }

    public async setAsync(key: string, value: any) {
        return await this.client.set(key, value);
    }

    public async delAsync(key: string) {
        return await this.client.del(key);
    }

    public async existsAsync(key: string) {
        return await this.client.exists(key);
    }
}

export default new Redis();