import * as vscode from "vscode";

/**
 * Regex pattern to match the start of an SQL query.
 * It looks for a token (""" or " or ''' or ' or `) followed by optional whitespace and the keyword "select".
 * The pattern is case-insensitive.
 */
const SQL_START_REGEX = /(?<token>"""|"|'''|'|`)--\s*sql/;

async function checkRange(
  log: vscode.OutputChannel,
  doc: vscode.TextDocument,
  range: vscode.Range
): Promise<vscode.Diagnostic[]> {
  const diagnostics: vscode.Diagnostic[] = [];

  const sqlStr = doc.getText(range);

  log.appendLine(`linting sql: ${sqlStr}`);

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
        log.appendLine(`${match}: Match found at ${lineIndex}`);
        startRangePosition = match.index + match.groups!.token.length;
        sqlStringBound = match.groups!.token;
        sqlStartLineIndex = lineIndex;
        log.appendLine(
          `startRangePosition ${startRangePosition}, sqlStringBound ${sqlStringBound}, sqlStartLineIndex ${sqlStartLineIndex}`
        );
      }
    } else if (sqlStringBound !== "") {
      let endSqlIndex = lineOfText.indexOf(sqlStringBound);
      log.appendLine(`endSqlIndex ${endSqlIndex}`);
      if (endSqlIndex !== -1) {
        sqlStringCnt += 1;
        log.appendLine(`sqlStringCnt ${sqlStringCnt}`);
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

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "sql-linter-inline.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage(
        "Hello World from Extension sql-linter-inline!"
      );
    }
  );
  context.subscriptions.push(disposable);

  const inlinesqlDiagnostics =
    vscode.languages.createDiagnosticCollection("inlinesql");
  context.subscriptions.push(inlinesqlDiagnostics);

  const log = vscode.window.createOutputChannel("Inline SQL");
  log.appendLine("inline SQL activated");

  await subscribeToDocumentChanges(context, inlinesqlDiagnostics, log);
}

// This method is called when your extension is deactivated
export function deactivate() { }
