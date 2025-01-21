export function formatString(
  template: string,
  params: { [key: string]: any }
): string {
  return template.replace(/{(\w+)}/g, (_, key) => params[key]);
}
