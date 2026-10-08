import { summarizeRatings } from './rating-summary';

describe('summarizeRatings', () => {
  it('reports no average while nobody has rated', () => {
    expect(summarizeRatings(new Map())).toEqual({
      average: null,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it('fills in the star values that got no ratings', () => {
    const summary = summarizeRatings(
      new Map([
        [5, 3],
        [2, 1],
      ]),
    );

    expect(summary.distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 0, 5: 3 });
    expect(summary.count).toBe(4);
  });

  it('weights the average by how many ratings each value got', () => {
    // (5*3 + 2*1) / 4
    expect(
      summarizeRatings(
        new Map([
          [5, 3],
          [2, 1],
        ]),
      ).average,
    ).toBe(4.25);
  });

  it('rounds the average to two decimals', () => {
    // (5 + 4 + 4) / 3 = 4.3333…
    expect(
      summarizeRatings(
        new Map([
          [5, 1],
          [4, 2],
        ]),
      ).average,
    ).toBe(4.33);
  });
});
