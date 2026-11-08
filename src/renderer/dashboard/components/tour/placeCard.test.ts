import { describe, test, expect } from 'vitest';
import { placeCard } from './placeCard';

describe('placeCard', () => {
  const cardHeight = 140; // Bands: top 16..156, bottom 444..600 on a 600px screen

  test('the card moves to the top only when the spotlight reaches the bottom band and the top band is clear', () => {
    expect(placeCard({ top: 100, height: 50 }, 600, cardHeight)).toBe('bottom');
    expect(placeCard({ top: 420, height: 100 }, 600, cardHeight)).toBe('top');
    expect(placeCard({ top: 120, height: 400 }, 600, cardHeight)).toBe('bottom'); // Touches both, so the bottom, which covers nothing it points at
    expect(placeCard(null, 600, cardHeight)).toBe('bottom');
  });
});
