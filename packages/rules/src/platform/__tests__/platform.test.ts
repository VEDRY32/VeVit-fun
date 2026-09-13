import { describe, it, expect } from 'vitest';
import {
  createBody, stepBody, hitsSolid, overlaps, standingOn, gridFromRows, GRAVITY,
} from '../index.js';

const ROWS = [
  '..........',
  '..........',
  '..........',
  '....#.....',
  '..........',
  '##########',
];
const grid = gridFromRows(ROWS, 16, '#');

describe('dlaždicová mapa', () => {
  it('zná pevné dlaždice a okraje', () => {
    expect(grid.solid(4, 3)).toBe(true);
    expect(grid.solid(0, 0)).toBe(false);
    // Po stranách a dole je pevno, nahoře ne — postava smí vyskočit nad mapu.
    expect(grid.solid(-1, 0)).toBe(true);
    expect(grid.solid(0, 99)).toBe(true);
    expect(grid.solid(0, -1)).toBe(false);
  });

  it('obdélník protínající dlaždici se pozná', () => {
    expect(hitsSolid(grid, 4 * 16, 3 * 16, 8, 8)).toBe(true);
    expect(hitsSolid(grid, 0, 0, 8, 8)).toBe(false);
    // Dotyk hranou zprava se ještě nepočítá jako průnik.
    expect(hitsSolid(grid, 3 * 16, 3 * 16, 16, 16)).toBe(false);
  });
});

describe('pohyb těla', () => {
  it('gravitace tělo položí na podlahu a tam ho nechá', () => {
    const body = createBody(16, 0, 12, 20);
    for (let i = 0; i < 120; i++) stepBody(body, grid);
    expect(body.onGround).toBe(true);
    expect(body.vy).toBe(0);
    // Podlaha je řádek 5, tedy y = 80; tělo na ní stojí spodkem.
    expect(body.y + body.h).toBe(5 * 16);
  });

  it('rychlý pád neproletí podlahou', () => {
    const body = createBody(16, 0, 12, 20);
    body.vy = 400;
    // Vyšší strop pádu, jinak by rychlost hned spadla na 13 a test by
    // prorážení dlaždicí vůbec nevyzkoušel.
    stepBody(body, grid, { maxFall: 500 });
    expect(body.y + body.h).toBe(5 * 16);
    expect(body.onGround).toBe(true);
  });

  it('náraz do stěny zastaví vodorovnou rychlost', () => {
    // Pravou hranou přesně na levé hraně pevné dlaždice (4, 3).
    const body = createBody(4 * 16 - 12, 3 * 16, 12, 12);
    body.vx = 6;
    stepBody(body, grid);
    expect(body.hitWall).toBe(true);
    expect(body.vx).toBe(0);
    expect(body.x + body.w).toBe(4 * 16);
  });

  it('náraz hlavou do stropu shodí stoupání', () => {
    const body = createBody(4 * 16 + 2, 4 * 16 + 2, 12, 12);
    body.vy = -20;
    stepBody(body, grid);
    expect(body.hitCeiling).toBe(true);
    expect(body.vy).toBe(0);
    expect(body.y).toBe(4 * 16);
  });

  it('skok stoupá, zpomaluje a vrátí se na zem', () => {
    const body = createBody(16, 5 * 16 - 20, 12, 20);
    stepBody(body, grid);
    expect(body.onGround).toBe(true);

    body.vy = -9;
    const heights: number[] = [];
    for (let i = 0; i < 60; i++) {
      stepBody(body, grid);
      heights.push(body.y);
      if (body.onGround && i > 3) break;
    }
    expect(Math.min(...heights)).toBeLessThan(5 * 16 - 20);
    expect(body.onGround).toBe(true);
  });

  it('gravitace má očekávanou hodnotu a rychlost pádu strop', () => {
    const body = createBody(16, 0, 12, 12);
    stepBody(body, grid);
    expect(body.vy).toBeCloseTo(GRAVITY, 5);
    for (let i = 0; i < 200; i++) stepBody(body, grid);
    expect(body.vy).toBeLessThanOrEqual(13);
  });

  it('standingOn pozná podlahu i bez pohybu', () => {
    const body = createBody(16, 5 * 16 - 20, 12, 20);
    expect(standingOn(body, grid)).toBe(true);
    body.y -= 8;
    expect(standingOn(body, grid)).toBe(false);
  });

  it('overlaps najde průnik dvou těl', () => {
    const a = createBody(0, 0, 10, 10);
    const b = createBody(5, 5, 10, 10);
    const c = createBody(20, 20, 10, 10);
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(a, c)).toBe(false);
  });
});
