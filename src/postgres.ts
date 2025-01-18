import { Client } from "pg";
import * as config from "./config";
import { DatabaseConnect } from "./dbAbstract";

export class PostgresClient extends DatabaseConnect {
    private client: Client;
    public sqlForTables = `select
                  t.table_name,
                  array_agg(c.column_name::text) as columns
              from
                  information_schema.tables t
              inner join information_schema.columns c on
                  t.table_name = c.table_name
              where
                  t.table_schema = 'public'
                  and t.table_type= 'BASE TABLE'
                  and c.table_schema = 'public'
              group by t.table_name;`;
    constructor() {
        super();
        this.client = new Client({
            host: config.get<string>("dbHost"),
            port: config.get<number>("dbPort"),
            user: config.get<string>("dbUser"),
            password: config.get<string>("dbPassword"),
            database: config.get<string>("dbName"),
        });
    }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    async query(query: string): Promise<any> {
        return this.client.query(query);
    }

    async disconnect(): Promise<void> {
        await this.client.end();
    }

}