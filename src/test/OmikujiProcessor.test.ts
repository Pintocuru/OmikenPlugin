import { OmikujiProcessor } from '../Modules/tasks/OmikujiProcess';

describe('OmikujiProcessor script parameters', () => {
 test('preserves false, zero, and empty-string input values', () => {
  const processor = Object.create(OmikujiProcessor.prototype) as OmikujiProcessor;
  const params = [
   { id: 'enabled', type: 'boolean' },
   { id: 'count', type: 'number' },
   { id: 'label', type: 'string' }
  ];
  const input = { enabled: false, count: 0, label: '' };

  const result = (processor as any).convertInputParams(params, input);

  expect(result).toEqual(input);
 });
});
