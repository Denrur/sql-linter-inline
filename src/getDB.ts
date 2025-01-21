import { DatabaseConnect } from "./dbAbstract";
import { PostgresClient } from "./postgres";
import { SQLServerClient } from "./sqlserver";
import { PREFIX } from "./config";
import * as vscode from "vscode";

export function getDB(): DatabaseConnect {
  let client: DatabaseConnect;

  switch (
    vscode.workspace.getConfiguration(PREFIX).get<string>("dbType")
  ) {
    case "postgres":
      client = new PostgresClient();
      break;
    case "sqlserver":
      client = new SQLServerClient();
      break;
    default:
      throw new Error("Unsupported database type");
  }
  return client;
}
