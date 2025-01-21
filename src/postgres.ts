import { Client } from "pg";
import { DatabaseConnect } from "./dbAbstract";
import { Configuration } from "./config";

export class PostgresClient extends DatabaseConnect {
  protected dbClient: Client | undefined;
  connectionStringTemplate =
    "postgresql://{dbUser}:{dbPassword}@{dbHost}:{dbPort}/{dbName}?{dbParams}";
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

  async connect(): Promise<void> {
    if (this.connectionString) {
      this.dbClient = new Client(this.connectionString);
      await this.dbClient.connect();
    }
  }

  async query(query: string): Promise<any> {
    if (this.dbClient) {
      return this.dbClient.query(query);
    }
  }

  async disconnect(): Promise<void> {
    if (this.dbClient) {
      await this.dbClient.end();
    }
  }
  parseConnectionString(connectionString: string): Configuration {
    const regex =
      /^postgresql:\/\/(?<username>[^:]+):(?<password>[^@]+)@(?<host>[^:]+):(?<port>\d+)\/(?<database>[^\?]+)(\?(?<params>.*))?$/;
    const match = connectionString.match(regex);
    if (match && match.groups) {
      return {
        dbUser: match.groups.username,
        dbPassword: match.groups.password,
        dbHost: match.groups.host,
        dbPort: parseInt(match.groups.port, 10),
        dbName: match.groups.database,
        dbParams: match.groups.params || "",
      };
    } else {
      return {};
    }
  }
}
