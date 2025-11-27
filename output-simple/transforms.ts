// Auto-generated transform functions

import * as Types from './types';

export function PersonToDTO(source: Types.Person): Types.PersonDTO {
  const result: any = {};

  const _t0 = source.name;
  result.fullName = _t0;
  const _t1 = source.age;
  result.ageYears = _t1;

  return result;
}
