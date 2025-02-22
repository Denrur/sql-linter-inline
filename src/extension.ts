import * as vscode from "vscode";

import { getDB } from "./getDB";
import { Configuration, PREFIX, getConfig, updateConfig } from "./config";
import { DatabaseConnect } from "./dbAbstract";
import { From, Parser } from "node-sql-parser";
import { formatString } from "./func_utils";

const STRING_START_REGEX =
  /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gim;
const SQL_TEST =
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|RENAME|MERGE|REPLACE|EXECUTE|CALL|DECLARE|WITH|GRANT|REVOKE|COMMIT|ROLLBACK|SAVEPOINT|SET|ANALYZE|EXPLAIN|LOCK|UNLOCK|PREPARE|DESCRIBE|SHOW|USE|DO)\b/gi;

let tables: { table_name: string; columns: string[] }[] = [];
let isUpdatingConfig = false;

async function checkRange(
  log: vscode.OutputChannel,
  doc: vscode.TextDocument,
  str: string,
  context: vscode.ExtensionContext
): Promise<vscode.Diagnostic[]> {
  const diagnostics: vscode.Diagnostic[] = [];
  let sql_matches;
  if (doc.languageId === "python") {
    log.appendLine("Running");
    const opt = {
      database: "Postgresql",
    };
    const parser = new Parser();
    console.log(str);
    sql_matches = [...str.matchAll(SQL_TEST)];
    if (sql_matches !== null) {
      const ast = parser.astify(str, opt);
      if (Array.isArray(ast)) {
        return diagnostics;
      }
      if (
        !ast ||
        !("from" in ast) ||
        !Array.isArray(ast.from) ||
        ast.from.length === 0
      ) {
        return diagnostics;
      }

      for (let i of ast.from) {
        for (let table of tables) {
          if (!("table" in i)) {
            return diagnostics;
          }
          if (table.table_name !== i.table) {
            return diagnostics;
          }
          {
            let alias = i.table;
            let table = tables.find((t) => t.table_name === i.table);
            console.log(table);
            if (i.as) {
              alias = i.as;
            }
            const provider = vscode.languages.registerCompletionItemProvider(
              "python",
              {
                provideCompletionItems(
                  document: vscode.TextDocument,
                  position: vscode.Position
                ) {
                  const suggestions = table!.columns.map((column_name) => {
                    const item = new vscode.CompletionItem(
                      `Column: ${table!.table_name}.${column_name}`,
                      vscode.CompletionItemKind.Snippet
                    );
                    item.detail = `Column: ${table!.table_name}.${column_name}`;
                    // item.documentation = `Columns: ${table.columns.join(", ")}`;
                    item.insertText = `"${alias}".${column_name}`;
                    return item;
                  });
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

      return diagnostics;
    }
  }
  return diagnostics;
}

export async function refreshDiagnostics(
  doc: vscode.TextDocument,
  inlinesqlDiagnostics: vscode.DiagnosticCollection,
  log: vscode.OutputChannel
): Promise<void> {
  const context = (await vscode.commands.executeCommand(
    "getContext"
  )) as vscode.ExtensionContext;
  const diagnostics: vscode.Diagnostic[] = [];
  const docText = doc.getText();

  const matches = docText.match(STRING_START_REGEX);
  if (matches === null) {
    inlinesqlDiagnostics.set(doc.uri, diagnostics);
    return;
  }
  for (let match of matches) {
    match = match.replace(/"""|"|'''|'|`/g, "");
    const subDiagnostics = await checkRange(log, doc, match, context);
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
