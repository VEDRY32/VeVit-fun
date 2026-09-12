import { describe, it, expect } from 'vitest';
import { createHad, type HadGame } from '../game.js';

/** Posune hru o tolik kroků, aby had udělal `moves` posunů. */
function stepMoves(game: HadGame, moves: number): void {
  for (let i = 0; i < moves; i++) {
    for (let t = 0; t < Math.round(game.state.interval); t++) game.step(0);
  }
}

describe('Had', () => {
  it('začíná tříčlánkovým hadem uprostřed', () => {
    const game = createHad('start');
    expect(game.state.body).toHaveLength(3);
    expect(game.state.direction).toBe('right');
    expect(game.state.over).toBe(false);
  });

  it('stejný seed dá stejné rozmístění jídla', () => {
    expect(createHad('jidlo').state.food).toEqual(createHad('jidlo').state.food);
  });

  it('had se posouvá zvoleným směrem', () => {
    const game = createHad('pohyb');
    const startX = game.state.body[0]!.x;
    stepMoves(game, 1);
    expect(game.state.body[0]!.x).toBe(startX + 1);
  });

  it('nelze se otočit přímo do sebe', () => {
    const game = createHad('otoceni');
    game.turn('left'); // opačný směr k 'right'
    stepMoves(game, 1);
    expect(game.state.direction).toBe('right');
    expect(game.state.over).toBe(false);
  });

  it('fronta drží nejvýš dva tahy', () => {
    const game = createHad('fronta');
    game.turn('up');
    game.turn('left');
    game.turn('down');
    expect(game.state.queue.length).toBeLessThanOrEqual(2);
  });

  it('rychlé dva tahy za sebou se oba provedou', () => {
    const game = createHad('dva-tahy');
    game.turn('up');
    game.turn('left');
    stepMoves(game, 1);
    expect(game.state.direction).toBe('up');
    stepMoves(game, 1);
    expect(game.state.direction).toBe('left');
  });

  it('náraz do zdi v klasiku ukončí hru', () => {
    const game = createHad('zed', { width: 8, height: 8, mode: 'klasik' });
    stepMoves(game, 20);
    expect(game.state.over).toBe(true);
  });

  it('v režimu bez zdí had projde okrajem', () => {
    const game = createHad('bez-zdi', { width: 8, height: 8, mode: 'bez-zdi' });
    stepMoves(game, 12);
    expect(game.state.over).toBe(false);
    expect(game.state.body[0]!.x).toBeGreaterThanOrEqual(0);
    expect(game.state.body[0]!.x).toBeLessThan(8);
  });

  it('snědení jídla prodlouží hada a přidá body', () => {
    const game = createHad('jidlo-rust', { width: 12, height: 12 });
    const head = game.state.body[0]!;
    // Polož jídlo přímo před hlavu.
    game.state.food = { x: head.x + 1, y: head.y };
    stepMoves(game, 1);
    expect(game.state.body).toHaveLength(4);
    expect(game.state.score).toBe(10);
  });

  it('had zrychluje s každým jídlem', () => {
    const game = createHad('rychlost', { width: 14, height: 14 });
    const before = game.state.interval;
    const head = game.state.body[0]!;
    game.state.food = { x: head.x + 1, y: head.y };
    stepMoves(game, 1);
    expect(game.state.interval).toBeLessThan(before);
  });

  it('zlaté jablko zmizí po pěti sekundách', () => {
    const game = createHad('zlate', { width: 14, height: 14 });
    game.state.golden = { x: 1, y: 1 };
    game.state.goldenTicks = 3;
    for (let i = 0; i < 4; i++) game.step(0);
    expect(game.state.golden).toBeNull();
  });

  it('náraz do vlastního těla ukončí hru', () => {
    const game = createHad('do-sebe', { width: 14, height: 14 });
    // Prodluž hada tak, aby se do sebe dokázal zamotat.
    const head = game.state.body[0]!;
    for (let i = 0; i < 6; i++) {
      game.state.body.push({ x: head.x - 3 - i, y: head.y });
    }
    game.turn('up');
    stepMoves(game, 1);
    game.turn('left');
    stepMoves(game, 1);
    game.turn('down');
    stepMoves(game, 1);
    game.turn('right');
    stepMoves(game, 2);
    expect(game.state.over).toBe(true);
  });

  it('zeď v bludišti zabíjí', () => {
    const game = createHad('bludiste', {
      width: 14, height: 14, mode: 'bludiste',
      walls: [{ x: 8, y: 7 }],
    });
    game.state.body = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
    stepMoves(game, 1);
    expect(game.state.over).toBe(true);
  });
});

describe('bonusy', () => {
  it('magnet táhne jídlo k hlavě, ne hada k jídlu', () => {
    const game = createHad('magnet');
    const head = game.state.body[0]!;
    // Bonus si položíme přesně před hlavu, ať ho had sebere prvním posunem.
    game.state.bonus = { kind: 'magnet', at: { x: head.x + 1, y: head.y }, ticks: 600 };
    // Jídlo dáme daleko a mimo dráhu hada.
    game.state.food = { x: head.x + 6, y: head.y + 5 };

    stepMoves(game, 1);
    expect(game.state.bonus).toBeNull();
    expect(game.state.magnetTicks).toBeGreaterThan(0);

    // Jídlo se přitahuje po jednom poli za posun, ne skokem.
    game.state.food = { x: head.x, y: head.y + 5 };
    stepMoves(game, 1);
    expect(game.state.food).toEqual({ x: head.x, y: head.y + 4 });
    stepMoves(game, 1);
    expect(game.state.food).toEqual({ x: head.x, y: head.y + 3 });
  });

  it('nůžky zkrátí hada na polovinu, ale nikdy pod tři články', () => {
    const game = createHad('nuzky');
    const head = game.state.body[0]!;
    for (let i = 0; i < 9; i++) game.state.body.push({ x: -1 - i, y: head.y });
    game.state.length = game.state.body.length;
    const before = game.state.body.length;

    game.state.bonus = { kind: 'nuzky', at: { x: head.x + 1, y: head.y }, ticks: 600 };
    stepMoves(game, 1);

    expect(game.state.bonus).toBeNull();
    expect(game.state.body.length).toBeLessThan(before);
    expect(game.state.body.length).toBeGreaterThanOrEqual(3);
  });

  it('bonus po vypršení času zmizí a nic nespustí', () => {
    const game = createHad('cas');
    const head = game.state.body[0]!;
    game.state.bonus = { kind: 'magnet', at: { x: head.x, y: head.y + 4 }, ticks: 3 };
    game.step(0);
    game.step(0);
    game.step(0);
    expect(game.state.bonus).toBeNull();
    expect(game.state.magnetTicks).toBe(0);
  });

  it('stejný seed dá stejné bonusy', () => {
    const a = createHad('shoda');
    const b = createHad('shoda');
    stepMoves(a, 120);
    stepMoves(b, 120);
    expect(a.state.bonus).toEqual(b.state.bonus);
    expect(a.state.score).toBe(b.state.score);
  });
});
