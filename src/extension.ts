import * as vscode from "vscode";
import { getDB } from "./getDB";

const SQL_START_REGEX = /(?<token>"""|"|'''|'|`)--\s*sql/;
const SQL_TABLE_NAME_FROM_REGEX = /FROM\s+"(\w+)".*/gi;
const SQL_TABLE_NAME_JOIN_REGEX = /JOIN\s+"(\w+)".*/gi;
let tables: { table_name: string; columns: string[] }[] = [];

async function checkRange(
  log: vscode.OutputChannel,
  doc: vscode.TextDocument,
  range: vscode.Range
): Promise<vscode.Diagnostic[]> {
  const context = (await vscode.commands.executeCommand(
    "getContext"
  )) as vscode.ExtensionContext;
  const diagnostics: vscode.Diagnostic[] = [];
  let table_name_matches;
  if (doc.languageId === "python") {
    log.appendLine("Running");
    const sqlStr = doc.getText(range);
    table_name_matches = [
      ...sqlStr.matchAll(SQL_TABLE_NAME_FROM_REGEX),
      ...sqlStr.matchAll(SQL_TABLE_NAME_JOIN_REGEX),
    ];
    console.log(table_name_matches);
    if (table_name_matches !== null) {
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
                  // console.log(suggestions);

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

  let startRangePosition = -1;
  let sqlStringBound = "";
  let sqlStartLineIndex = -1;

  let match;
  let sqlStringCnt = 0;
  for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex += 1) {
    let lineOfText = doc.lineAt(lineIndex).text;
    if (sqlStartLineIndex === -1) {
      if ((match = SQL_START_REGEX.exec(lineOfText)) !== null) {
        startRangePosition = match.index + match.groups!.token.length;
        sqlStringBound = match.groups!.token;
        sqlStartLineIndex = lineIndex;
      }
    } else if (sqlStringBound !== "") {
      let endSqlIndex = lineOfText.indexOf(sqlStringBound);
      if (endSqlIndex !== -1) {
        sqlStringCnt += 1;
        const range = new vscode.Range(
          sqlStartLineIndex,
          startRangePosition,
          lineIndex,
          endSqlIndex
        );
        const subDiagnostics = await checkRange(log, doc, range);
        diagnostics.push(...subDiagnostics);
        sqlStartLineIndex = -1;
        sqlStringBound = "";
      }
    }
  }
  const now = new Date().toISOString();
  if (sqlStringBound !== "") {
    log.appendLine(`${now}: SQL string was not closed.`);
  }
  log.appendLine(`${now}: ${sqlStringCnt} SQL strings found and linted`);

  inlinesqlDiagnostics.set(doc.uri, diagnostics);
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
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "sql-linter-inline" is now active!'
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("getContext", () => context)
  );
  const log = vscode.window.createOutputChannel("Inline SQL");
  // console.log(tables);
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
        // console.log(suggestions);

        return suggestions;
      },
    },
    '"' // Trigger completion when the user types a dot
  );

  context.subscriptions.push(provider);

  const refreshTables = vscode.commands.registerCommand(
    "linterSQL.updateTables",
    async () => {
      console.log("Updating tables");
      let client = getDB();
      (await client).getTables();
      tables = (await client).tables;
    }
  );

  context.subscriptions.push(refreshTables);

  const inlinesqlDiagnostics =
    vscode.languages.createDiagnosticCollection("inlinesql");
  context.subscriptions.push(inlinesqlDiagnostics);
  await subscribeToDocumentChanges(context, inlinesqlDiagnostics, log);
}

// This method is called when your extension is deactivated
export function deactivate() {}
