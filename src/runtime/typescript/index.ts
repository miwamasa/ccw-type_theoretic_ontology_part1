// Morpheus Runtime Library for TypeScript

// ========== Quantity ==========

export interface Unit {
  dimensions: Map<string, number>;
  scale: number;
}

export class Quantity<U extends string = string> {
  constructor(
    public readonly value: number,
    public readonly unit: U
  ) {}

  toString(): string {
    return `${this.value} ${this.unit}`;
  }

  static create<U extends string>(value: number, unit: U): Quantity<U> {
    return new Quantity(value, unit);
  }
}

// ========== Unit Operations ==========

export function createUnit(dimensions: Map<string, number>, scale = 1): Unit {
  return { dimensions, scale };
}

export function multiply<U1 extends string, U2 extends string>(
  a: Quantity<U1>,
  b: Quantity<U2>
): Quantity<string> {
  return new Quantity(a.value * b.value, `${a.unit}*${b.unit}`);
}

export function divide<U1 extends string, U2 extends string>(
  a: Quantity<U1>,
  b: Quantity<U2>
): Quantity<string> {
  return new Quantity(a.value / b.value, `${a.unit}/${b.unit}`);
}

export function add<U extends string>(a: Quantity<U>, b: Quantity<U>): Quantity<U> {
  // In a full implementation, we would check unit compatibility
  return new Quantity(a.value + b.value, a.unit);
}

export function subtract<U extends string>(a: Quantity<U>, b: Quantity<U>): Quantity<U> {
  return new Quantity(a.value - b.value, a.unit);
}

// ========== Lookup Tables ==========

export interface Lookup<K, V> {
  get(key: K): V | undefined;
  has(key: K): boolean;
}

export class SimpleLookup<K, V> implements Lookup<K, V> {
  private data: Map<K, V>;
  private defaultValue?: V;

  constructor(data: Map<K, V> = new Map(), defaultValue?: V) {
    this.data = data;
    this.defaultValue = defaultValue;
  }

  get(key: K): V | undefined {
    return this.data.get(key) ?? this.defaultValue;
  }

  has(key: K): boolean {
    return this.data.has(key);
  }

  set(key: K, value: V): void {
    this.data.set(key, value);
  }
}

export function createLookup<K, V>(
  source: string,
  options?: { hasDefault?: boolean }
): Lookup<K, V> {
  // In a full implementation, we would load from the source file
  return new SimpleLookup<K, V>();
}

// ========== Aggregate Functions ==========

export function sum<T>(
  array: T[],
  selector: (item: T) => number | Quantity<any>
): number | Quantity<any> {
  if (array.length === 0) return 0;

  const first = selector(array[0]);
  if (typeof first === 'number') {
    return array.reduce((acc, item) => acc + (selector(item) as number), 0);
  } else {
    return array.reduce(
      (acc, item) => add(acc as Quantity<any>, selector(item) as Quantity<any>),
      first
    );
  }
}

export function avg<T>(array: T[], selector: (item: T) => number | Quantity<any>): number | Quantity<any> {
  const total = sum(array, selector);
  if (typeof total === 'number') {
    return total / array.length;
  } else {
    return new Quantity(total.value / array.length, total.unit);
  }
}

export function max<T>(array: T[], selector: (item: T) => number): number {
  return Math.max(...array.map(selector));
}

export function min<T>(array: T[], selector: (item: T) => number): number {
  return Math.min(...array.map(selector));
}

export function count<T>(array: T[]): number {
  return array.length;
}

export function collect<T, R>(array: T[], selector: (item: T) => R): R[] {
  return array.map(selector);
}

export function filter<T>(array: T[], predicate: (item: T) => boolean): T[] {
  return array.filter(predicate);
}

export function groupBy<T, K extends string | number>(
  array: T[],
  keySelector: (item: T) => K
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of array) {
    const key = keySelector(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

// ========== Utility Functions ==========

export function isNull(value: any): boolean {
  return value === null || value === undefined;
}

export function coalesce<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (!isNull(value)) {
      return value as T;
    }
  }
  return null;
}
