import { Configuration, PREFIX } from "./config";
import * as vscode from "vscode";
export abstract class DatabaseConnect {
  public tables: { table_name: string; columns: string[] }[] = [];
  public connectionString?: string;

  protected abstract dbClient: any;
  abstract sqlForTables: string;
  abstract connect(): Promise<void>;
  abstract query(query: string): Promise<any>;
  abstract disconnect(): Promise<void>;
  abstract connectionStringTemplate: string;
  abstract parseConnectionString(connectionString: string): Configuration;

  setConnectionString(connectionString: string) {
    this.connectionString = connectionString;
  }

  async getTables() {
    try {
      console.log("Getting tables");
      const dbPath = vscode.workspace
        .getConfiguration(PREFIX)
        .get<string>("dbPath");
      if (dbPath) {
        this.setConnectionString(dbPath);

        await this.connect();
        const res = await this.query(this.sqlForTables);
        console.log(res);
        for (let i = 0; i < res!.rows.length; i++) {
          let table = {
            table_name: res?.rows[i].table_name,
            columns: res?.rows[i].columns.map(
              (column_name: string) => column_name
            ),
          };
          this.tables.push(table);
        }
      }
    } catch (err) {
      console.error("Error connecting to the database:", err);
    } finally {
      await this.disconnect();
    }
  }
}
