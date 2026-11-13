import { OmikujiSelectorTimer } from '../Modules/tasks/OmikujiSelector';
import { OmikujiType, RulesType } from '../Modules/type';

describe('OmikujiSelectorTimer', () => {
 beforeEach(() => {
  jest.useFakeTimers();
 });

 afterEach(() => {
  jest.useRealTimers();
 });

 test('destroy cancels a timer that has not reached its first interval', () => {
  const selector = new OmikujiSelectorTimer();
  const callback = jest.fn();
  const rules = [
   {
    id: 'rule',
    enableIds: ['omikuji'],
    timerConfig: { minutes: 1, isBaseZero: false }
   }
  ] as unknown as RulesType[];
  const omikujis = {
   omikuji: { id: 'omikuji', rank: 0, weight: 1 }
  } as unknown as Record<string, OmikujiType>;

  selector.setupTimers(rules, omikujis, callback);
  selector.destroy();
  jest.advanceTimersByTime(60_000);

  expect(callback).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
 });
});
