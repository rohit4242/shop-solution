export const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const tokens = (value: string) =>
  normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];
export const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
