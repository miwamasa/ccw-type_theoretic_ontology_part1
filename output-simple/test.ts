// Test the generated transform
import { PersonToDTO } from './transforms';
import { Person, PersonDTO } from './types';

const testPerson: Person = {
  name: 'Alice',
  age: 30
};

const dto: PersonDTO = PersonToDTO(testPerson);

console.log('Input:', testPerson);
console.log('Output:', dto);
console.log('✓ Transform executed successfully!');
