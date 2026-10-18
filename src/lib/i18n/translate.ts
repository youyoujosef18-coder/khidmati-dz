export type Dictionary = { [key: string]: string | Dictionary };
export type TParams = Record<string, string | number>;
export type TFunction = (key: string, params?: TParams) => string;

export function lookup(dict: Dictionary, key: string): string | undefined {
  let node: string | Dictionary | undefined = dict;
  for (const part of key.split(".")) {
    if (node == null || typeof node === "string") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    params[name] !== undefined ? String(params[name]) : m,
  );
}

export function createT(dict: Dictionary, fallback?: Dictionary): TFunction {
  return (key, params) => {
    const value = lookup(dict, key) ?? (fallback ? lookup(fallback, key) : undefined);
    if (value === undefined) {
      if (process.env.NODE_ENV !== "production") console.warn(`[i18n] missing key: ${key}`);
      return key;
    }
    return interpolate(value, params);
  };
}
