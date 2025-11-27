// Type system definitions for Morpheus DSL

// Type representation
export type Type =
  | PrimitiveType
  | SchemaType
  | EnumType
  | ArrayType
  | OptionalType
  | QuantityType
  | TupleType
  | UnionType
  | FunctionType
  | TypeVariable
  | NeverType
  | UnknownType;

export interface PrimitiveType {
  kind: 'Primitive';
  name: 'String' | 'Int' | 'Float' | 'Bool' | 'Date' | 'DateTime' | 'Void';
}

export interface SchemaType {
  kind: 'Schema';
  name: string;
  fields: Map<string, Type>;
  genericParams: string[];
  genericArgs: Type[];
}

export interface EnumType {
  kind: 'Enum';
  name: string;
  variants: string[];
}

export interface ArrayType {
  kind: 'Array';
  element: Type;
}

export interface OptionalType {
  kind: 'Optional';
  inner: Type;
}

export interface QuantityType {
  kind: 'Quantity';
  unit: Unit;
}

export interface TupleType {
  kind: 'Tuple';
  elements: Type[];
}

export interface UnionType {
  kind: 'Union';
  members: Type[];
}

export interface FunctionType {
  kind: 'Function';
  params: Type[];
  returnType: Type;
}

export interface TypeVariable {
  kind: 'TypeVar';
  name: string;
  id: number;
}

export interface NeverType {
  kind: 'Never';
}

export interface UnknownType {
  kind: 'Unknown';
}

// Unit representation
export interface Unit {
  dimensions: Map<string, number>; // dimension -> exponent
  scale: number;
}

export const UNIT_ONE: Unit = {
  dimensions: new Map(),
  scale: 1,
};

// Type constructors
export function primitiveType(name: PrimitiveType['name']): PrimitiveType {
  return { kind: 'Primitive', name };
}

export function schemaType(
  name: string,
  fields: Map<string, Type>,
  genericParams: string[] = [],
  genericArgs: Type[] = []
): SchemaType {
  return { kind: 'Schema', name, fields, genericParams, genericArgs };
}

export function enumType(name: string, variants: string[]): EnumType {
  return { kind: 'Enum', name, variants };
}

export function arrayType(element: Type): ArrayType {
  return { kind: 'Array', element };
}

export function optionalType(inner: Type): OptionalType {
  return { kind: 'Optional', inner };
}

export function quantityType(unit: Unit): QuantityType {
  return { kind: 'Quantity', unit };
}

export function tupleType(elements: Type[]): TupleType {
  return { kind: 'Tuple', elements };
}

export function unionType(members: Type[]): UnionType {
  return { kind: 'Union', members };
}

export function functionType(params: Type[], returnType: Type): FunctionType {
  return { kind: 'Function', params, returnType };
}

export function typeVariable(name: string, id: number): TypeVariable {
  return { kind: 'TypeVar', name, id };
}

export const NEVER_TYPE: NeverType = { kind: 'Never' };
export const UNKNOWN_TYPE: UnknownType = { kind: 'Unknown' };

// Unit operations
export function multiplyUnits(a: Unit, b: Unit): Unit {
  const dimensions = new Map(a.dimensions);
  for (const [dim, exp] of b.dimensions) {
    dimensions.set(dim, (dimensions.get(dim) ?? 0) + exp);
  }
  // Remove zero exponents
  for (const [dim, exp] of dimensions) {
    if (exp === 0) {
      dimensions.delete(dim);
    }
  }
  return { dimensions, scale: a.scale * b.scale };
}

export function divideUnits(a: Unit, b: Unit): Unit {
  const dimensions = new Map(a.dimensions);
  for (const [dim, exp] of b.dimensions) {
    dimensions.set(dim, (dimensions.get(dim) ?? 0) - exp);
  }
  // Remove zero exponents
  for (const [dim, exp] of dimensions) {
    if (exp === 0) {
      dimensions.delete(dim);
    }
  }
  return { dimensions, scale: a.scale / b.scale };
}

export function powerUnit(unit: Unit, exponent: number): Unit {
  const dimensions = new Map<string, number>();
  for (const [dim, exp] of unit.dimensions) {
    dimensions.set(dim, exp * exponent);
  }
  return { dimensions, scale: Math.pow(unit.scale, exponent) };
}

export function unitsEqual(a: Unit, b: Unit): boolean {
  if (a.dimensions.size !== b.dimensions.size) return false;
  for (const [dim, exp] of a.dimensions) {
    if (b.dimensions.get(dim) !== exp) return false;
  }
  return true;
}

export function createUnit(dimensions: Map<string, number>, scale = 1): Unit {
  return { dimensions, scale };
}

// Type equality
export function typesEqual(a: Type, b: Type): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'Primitive':
      return a.name === (b as PrimitiveType).name;

    case 'Schema':
      return a.name === (b as SchemaType).name;

    case 'Enum':
      return a.name === (b as EnumType).name;

    case 'Array':
      return typesEqual(a.element, (b as ArrayType).element);

    case 'Optional':
      return typesEqual(a.inner, (b as OptionalType).inner);

    case 'Quantity':
      return unitsEqual(a.unit, (b as QuantityType).unit);

    case 'Tuple':
      const bTuple = b as TupleType;
      if (a.elements.length !== bTuple.elements.length) return false;
      return a.elements.every((e, i) => typesEqual(e, bTuple.elements[i]));

    case 'Union':
      const bUnion = b as UnionType;
      if (a.members.length !== bUnion.members.length) return false;
      // Order-independent equality (simplified)
      return a.members.every((m) => bUnion.members.some((bm) => typesEqual(m, bm)));

    case 'Function':
      const bFunc = b as FunctionType;
      if (a.params.length !== bFunc.params.length) return false;
      return (
        a.params.every((p, i) => typesEqual(p, bFunc.params[i])) &&
        typesEqual(a.returnType, bFunc.returnType)
      );

    case 'TypeVar':
      return a.id === (b as TypeVariable).id;

    case 'Never':
    case 'Unknown':
      return true;

    default:
      return false;
  }
}

// Subtyping relation
export function isSubtype(sub: Type, sup: Type): boolean {
  // Reflexivity
  if (typesEqual(sub, sup)) return true;

  // Never is subtype of everything
  if (sub.kind === 'Never') return true;

  // Everything is subtype of Unknown
  if (sup.kind === 'Unknown') return true;

  // Optional subtyping
  if (sub.kind !== 'Optional' && sup.kind === 'Optional') {
    return isSubtype(sub, sup.inner);
  }

  // Schema structural subtyping
  if (sub.kind === 'Schema' && sup.kind === 'Schema') {
    // Nominal typing for now
    return sub.name === sup.name;
  }

  // Array covariance
  if (sub.kind === 'Array' && sup.kind === 'Array') {
    return isSubtype(sub.element, sup.element);
  }

  // Union subtyping
  if (sub.kind === 'Union') {
    return sub.members.every((m) => isSubtype(m, sup));
  }

  if (sup.kind === 'Union') {
    return sup.members.some((m) => isSubtype(sub, m));
  }

  return false;
}

// Type formatting for error messages
export function formatType(type: Type): string {
  switch (type.kind) {
    case 'Primitive':
      return type.name;

    case 'Schema':
      if (type.genericArgs.length > 0) {
        return `${type.name}<${type.genericArgs.map(formatType).join(', ')}>`;
      }
      return type.name;

    case 'Enum':
      return type.name;

    case 'Array':
      return `[${formatType(type.element)}]`;

    case 'Optional':
      return `${formatType(type.inner)}?`;

    case 'Quantity':
      return `Quantity<${formatUnit(type.unit)}>`;

    case 'Tuple':
      return `(${type.elements.map(formatType).join(', ')})`;

    case 'Union':
      return type.members.map(formatType).join(' | ');

    case 'Function':
      return `(${type.params.map(formatType).join(', ')}) -> ${formatType(type.returnType)}`;

    case 'TypeVar':
      return type.name;

    case 'Never':
      return 'Never';

    case 'Unknown':
      return 'Unknown';

    default:
      return '?';
  }
}

export function formatUnit(unit: Unit): string {
  if (unit.dimensions.size === 0) return '1';

  const parts: string[] = [];
  for (const [dim, exp] of unit.dimensions) {
    if (exp === 1) {
      parts.push(dim);
    } else {
      parts.push(`${dim}^${exp}`);
    }
  }

  return parts.join('*');
}
