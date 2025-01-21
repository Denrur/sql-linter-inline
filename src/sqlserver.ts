import { ConnectionPool } from "mssql";
import { DatabaseConnect } from "./dbAbstract";
import { Configuration } from "./config";

export class SQLServerClient extends DatabaseConnect {
  protected dbClient: ConnectionPool | undefined;
  connectionStringTemplate =
    "Server={dbHost},{dbPort};Database={dbName};User Id={dbUser};Password={dbPassword};Encrypt=true;";

  public sqlForTables = `SELECT
                              TABLE_NAME AS table_name,
                              STRING_AGG(COLUMN_NAME, ', ') AS columns
                           FROM
                              INFORMATION_SCHEMA.COLUMNS
                           GROUP BY
                              TABLE_NAME;`;

  async connect(): Promise<void> {
    if (this.connectionString) {
      this.dbClient = new ConnectionPool(this.connectionString);
      await this.dbClient
        .connect()
        .then(() => {
          console.log("Connected to MS SQL Server");
        })
        .catch((err) => {
          console.error("Error connecting to MS SQL Server", err);
        });
    }
  }

  async query(query: string): Promise<any> {
    if (this.dbClient) {
      const request = this.dbClient.request();
      return await request.query(query);
    }
  }

  async disconnect(): Promise<void> {
    if (this.dbClient) {
      await this.dbClient.close();
    }
  }
  parseConnectionString(connectionString: string): Configuration {
    const regex =
      /^Server=(?<host>[^,;]+)(?:,(?<port>\d+))?;Database=(?<database>[^;]+);User Id=(?<username>[^;]+);Password=(?<password>[^;]+);(?<params>.*)$/;
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
