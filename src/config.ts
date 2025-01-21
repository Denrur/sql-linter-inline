export const PREFIX = "linterSQL";
import * as vscode from "vscode";

export type Configuration = {
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
  dbType?: string;
  dbPath?: string;
  dbParams?: string;
};

export function updateConfig(configObj: Configuration) {
  const config = vscode.workspace.getConfiguration(PREFIX);
  configObj.dbName !== undefined
    ? config.update("dbName", configObj.dbName)
    : null;
  configObj.dbPassword !== undefined
    ? config.update("dbPassword", configObj.dbPassword)
    : null;
  configObj.dbPort !== undefined
    ? config.update("dbPort", configObj.dbPort)
    : null;
  configObj.dbUser !== undefined
    ? config.update("dbUser", configObj.dbUser)
    : null;
  configObj.dbHost !== undefined
    ? config.update("dbHost", configObj.dbHost)
    : null;
}
export function getConfig() {
  const config = vscode.workspace.getConfiguration(PREFIX);
  const dbType = config.get<string>("dbType");
  const dbName = config.get<string>("dbName");
  const dbPassword = config.get<string>("dbPassword");
  const dbPort = config.get<number>("dbPort");
  const dbUser = config.get<string>("dbUser");
  const dbHost = config.get<string>("dbHost");
  return { dbType, dbName, dbPassword, dbPort, dbUser, dbHost };
}
