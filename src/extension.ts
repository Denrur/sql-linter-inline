import * as vscode from "vscode";

import { getDB } from "./getdb";
import { Configuration, PREFIX, getConfig, updateConfig } from "./config";
import { DatabaseConnect } from "./dbAbstract";
import { From, Parser } from "node-sql-parser";

// const SQL_START_REGEX = /(?<token>"""|"|'''|'|`)--\s*sql/;
const SQL_START_REGEX = /(?<token>"""|"|'''|'|`).*/im;
const STRING_START_REGEX =
  /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gim;
const SQL_TEST =
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|RENAME|MERGE|REPLACE|EXECUTE|CALL|DECLARE|WITH|GRANT|REVOKE|COMMIT|ROLLBACK|SAVEPOINT|SET|ANALYZE|EXPLAIN|LOCK|UNLOCK|PREPARE|DESCRIBE|SHOW|USE|DO)\b/gi;
// const SQL_TABLE_NAME_FROM_REGEX = /.?FROM\s+"(\w+)".*/gi;
// const SQL_TABLE_NAME_JOIN_REGEX = /.?JOIN\s+"(\w+)".*/gi;

let tables: { table_name: string; columns: string[] }[] = [];
let isUpdatingConfig = false;
// const mysqlConnectString =
//   "mysql://{dbUser}:{dbPassword}@{dbHost}:{dbPort}/{dbName}?{dbParams}";
// const sqliteConnectString = "sqlite:///{dbPath}?{dbParams}";

async function checkRange(
  log: vscode.OutputChannel,
  doc: vscode.TextDocument,
  // range: vscode.Range
  str: string
): Promise<vscode.Diagnostic[]> {
  const context = (await vscode.commands.executeCommand(
    "getContext"
  )) as vscode.ExtensionContext;
  const diagnostics: vscode.Diagnostic[] = [];
  let table_name_matches;
  if (doc.languageId === "python") {
    log.appendLine("Running");
    // const sqlStr = doc.getText(range);
    const opt = {
      database: "Postgresql",
    };
    const parser = new Parser();
    console.log(str);
    table_name_matches = [
      ...str.matchAll(SQL_TEST),
      // ...sqlStr.matchAll(SQL_TABLE_NAME_FROM_REGEX),
      // ...sqlStr.matchAll(SQL_TABLE_NAME_JOIN_REGEX),
    ];
    // console.log(table_name_matches);
    if (table_name_matches !== null) {
      const ast = parser.astify(str, opt);
      if (Array.isArray(ast)) {
        return diagnostics;
      }
      if (ast && "from" in ast) {
        if (Array.isArray(ast.from) && ast.from.length === 0) {
          return diagnostics;
        }

        if (Array.isArray(ast.from) && ast.from.length > 0) {
          for (let i of ast.from) {
            if ("table" in i) {
              console.log(i.table);
              for (let table of tables) {
                if (table.table_name === i.table) {
                  let alias = i.table;
                  if (i.as) {
                    alias = i.as;
                  }
                  // context.subscriptions[0].dispose();
                  const provider =
                    vscode.languages.registerCompletionItemProvider(
                      "python",
                      {
                        provideCompletionItems(
                          document: vscode.TextDocument,
                          position: vscode.Position
                        ) {
                          // Array of suggestions
                          const suggestions = table.columns.map(
                            (column_name) => {
                              const item = new vscode.CompletionItem(
                                `Column: ${table.table_name}.${column_name}`,
                                vscode.CompletionItemKind.Snippet
                              );
                              item.detail = `Column: ${table.table_name}.${column_name}`;
                              // item.documentation = `Columns: ${table.columns.join(", ")}`;
                              item.insertText = `"${alias}".${column_name}`;
                              return item;
                            }
                          );
                          console.log(suggestions);

                          return suggestions;
                        },
                      },
                      "." // Trigger completion when the user types a dot
                    );
                  context.subscriptions.push(provider);
                  console.log(context.subscriptions);
                }
              }
            }
          }
        }
      }
      return diagnostics;
      for (let match of table_name_matches) {
        console.log(`Found Table: ${match}`);

        const table_name = match[1];
        log.appendLine(`${table_name}`);
        for (let table of tables) {
          if (table.table_name === table_name) {
            const provider = vscode.languages.registerCompletionItemProvider(
              "python", // Change this to the language you want to provide suggestions for
              {
                provideCompletionItems(
                  document: vscode.TextDocument,
                  position: vscode.Position
                ) {
                  // Array of suggestions
                  const suggestions = table.columns.map(
                    (column_name) =>
                      new vscode.CompletionItem(
                        column_name,
                        vscode.CompletionItemKind.Snippet
                      )
                  );
                  console.log(suggestions);

                  return suggestions;
                },
              },
              "." // Trigger completion when the user types a dot
            );
            context.subscriptions.push(provider);
          }
        }
      }
    }
  }
  return diagnostics;
}

export async function refreshDiagnostics(
  doc: vscode.TextDocument,
  inlinesqlDiagnostics: vscode.DiagnosticCollection,
  log: vscode.OutputChannel
): Promise<void> {
  const diagnostics: vscode.Diagnostic[] = [];

  const docText = doc.getText();

  const matches = docText.match(STRING_START_REGEX);
  if (matches === null) {
    inlinesqlDiagnostics.set(doc.uri, diagnostics);
    return;
  }
  for (let match of matches) {
    match = match.replace(/"""|"|'''|'|`/g, "");
    const subDiagnostics = await checkRange(log, doc, match);
    diagnostics.push(...subDiagnostics);
  }
  inlinesqlDiagnostics.set(doc.uri, diagnostics);
  return;
}

export async function subscribeToDocumentChanges(
  context: vscode.ExtensionContext,
  inlinesqlDiagnostics: vscode.DiagnosticCollection,
  log: vscode.OutputChannel
): Promise<void> {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        refreshDiagnostics(editor.document, inlinesqlDiagnostics, log);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((e) => {
      const now = new Date().toISOString();
      log.appendLine(`${now}: document saved, refreshing diagnostics`);
      refreshDiagnostics(e, inlinesqlDiagnostics, log);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) =>
      inlinesqlDiagnostics.delete(doc.uri)
    )
  );
  log.appendLine("watching active editors");
}

function formatString(
  template: string,
  params: { [key: string]: any }
): string {
  return template.replace(/{(\w+)}/g, (_, key) => params[key]);
}

export async function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "sql-linter-inline" is now active!'
  );

  const log = vscode.window.createOutputChannel("Inline SQL");
  log.appendLine("inline SQL activated");

  const provider = vscode.languages.registerCompletionItemProvider(
    "python", // Change this to the language you want to provide suggestions for
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        // Array of suggestions
        const suggestions = tables.map((table) => {
          const item = new vscode.CompletionItem(
            `Table: ${table.table_name}`,
            vscode.CompletionItemKind.Snippet
          );
          item.detail = `Table: ${table.table_name}`;
          item.documentation = `Columns: ${table.columns.join(", ")}`;
          item.insertText = `"${table.table_name}"`;
          return item;
        });
        return suggestions;
      },
    },
    '"'
  );

  const refreshTables = vscode.commands.registerCommand(
    `${PREFIX}.updateTables`,
    async () => {
      let client: DatabaseConnect = getDB();
      console.log("Updating tables");
      const dbPath = vscode.workspace
        .getConfiguration(PREFIX)
        .get<string>("dbPath");
      if (dbPath && client.parseConnectionString(dbPath)) {
        await client.getTables();
        tables = client.tables;
      } else {
        vscode.workspace
          .getConfiguration(PREFIX)
          .update(
            "dbPath",
            formatString(client.connectionStringTemplate, getConfig())
          );
      }
    }
  );

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (isUpdatingConfig) {
      return;
    }
    const configKeys = [
      "dbHost",
      "dbPort",
      "dbUser",
      "dbPassword",
      "dbName",
      "dbPath",
      "dbType",
    ];

    for (const key of configKeys) {
      if (event.affectsConfiguration(`${PREFIX}.${key}`)) {
        let client: DatabaseConnect = getDB();
        const config = vscode.workspace.getConfiguration(PREFIX);
        const dbPath = config.get<string>("dbPath");
        let configObjFromConfig = { ...getConfig() };
        let configObjFromPath: Configuration = {};
        if (
          dbPath &&
          Object.keys(client.parseConnectionString(dbPath)).length
        ) {
          configObjFromPath = client.parseConnectionString(dbPath);
        } else {
          configObjFromPath = { ...configObjFromConfig };
        }
        isUpdatingConfig = true;
        try {
          if (key === "dbType") {
            configObjFromPath.dbParams = "";
          }
          if (key !== "dbPath") {
            config.update(
              "dbPath",
              formatString(client.connectionStringTemplate, {
                ...configObjFromPath,
                ...configObjFromConfig,
              })
            );
          } else {
            updateConfig({ ...configObjFromConfig, ...configObjFromPath });
          }
        } finally {
          isUpdatingConfig = false;
        }
      }
    }
  });

  const inlinesqlDiagnostics =
    vscode.languages.createDiagnosticCollection("inlinesql");

  // Create all subscriptions
  context.subscriptions.push(inlinesqlDiagnostics);

  context.subscriptions.push(provider);
  context.subscriptions.push(refreshTables);
  context.subscriptions.push(
    vscode.commands.registerCommand("getContext", () => context)
  );

  await subscribeToDocumentChanges(context, inlinesqlDiagnostics, log);
  await vscode.commands.executeCommand(`${PREFIX}.updateTables`);

}

// This method is called when your extension is deactivated
export function deactivate() {}
