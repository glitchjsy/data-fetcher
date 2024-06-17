import mysql from "mysql2";
import config from "../config.json";

class MySQL {
    private pool: any;

    constructor() {
        this.pool = mysql.createPool(config.mysql);
    }

    public execute(sql: string, params?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            return this.pool.query(sql, params, (err: any, results: any, fields: any) => {
                if (err) {
                    return reject(err);
                }
                return resolve(results);
            });
        })
    }
}

export default new MySQL();