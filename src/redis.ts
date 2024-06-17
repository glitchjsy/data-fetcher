import { RedisClientType, createClient } from "redis";
import { promisify } from "util";

class Redis {
    private client: RedisClientType;

    constructor() {
        this.client = createClient({
            legacyMode: true
        });
        this.client.connect();
    }

    public async getAsync(key: string) {
        const func = promisify(this.client.get).bind(this.client);
        return await func(key);
    }

    public async setAsync(key: string, value: any) {
        const func = promisify(this.client.set).bind(this.client);
        return await func(key, value);
    }

    public async delAsync(key: string) {
        const func = promisify(this.client.del).bind(this.client);
        return await func(key);
    }

    public async existsAsync(key: string) {
        const func = promisify(this.client.exists).bind(this.client);
        return await func(key);
    }
}

export default new Redis();