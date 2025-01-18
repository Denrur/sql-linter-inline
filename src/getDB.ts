import { DatabaseConnect } from "./dbAbstract";
import { PostgresClient } from "./postgres";
// import { SQLiteClient } from "./sqlite";
// import { SQLServerClient } from "./sqlserver";
import * as config from "./config";


export async function getDB(): Promise<DatabaseConnect> {
    let client: DatabaseConnect;

    switch (config.get<string>("dbType")) {
        case "postgres":
            client = new PostgresClient();
            break;
        // case "sqlite":
        //     client = new SQLiteClient();
        //     break;
        // case "sqlserver":
        //     client = new SQLServerClient();
        //     break;
        default:
            throw new Error("Unsupported database type");
    }
    return client;
}