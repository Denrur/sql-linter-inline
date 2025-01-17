import * as vscode from "vscode";

export const PREFIX = "linterSQL";

export type Configuration = {
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
};

export function getConfiguration() {
  return vscode.workspace.getConfiguration();
}

export function get<T>(key: keyof Configuration): T {
  return getConfiguration().get<Configuration>(
    `${PREFIX}.${key}`
  ) as unknown as T;
}
