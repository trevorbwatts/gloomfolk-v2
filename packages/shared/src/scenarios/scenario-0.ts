/**
 * Scenario 0 — "Training Course" (the tutorial).
 *
 * The `data` block is the layout Trevor authored in the Scenario Editor and
 * exported (Export JSON). The `rules` block — written from the rule book pages
 * (sections 5.2, 7.1, 9.1) — layers on the special behavior: room reveal order,
 * door unlock/reveal/story wiring, the scripted sparring-partner action, and
 * the narrative text. Re-export the layout from the editor to update the map;
 * keep `rules` to update the behavior.
 *
 * Rooms (map tiles): 09-D (start) → 07-D → 02-A.
 */

import { compileScenario, type ScenarioRules } from './compile.js';
import type { ScenarioData } from './layout.js';

const ROOM_1 = '09-D';
const ROOM_2 = '07-D';
const ROOM_3 = '02-A';

// Authored layout (exported from the Scenario Editor).
const data: ScenarioData = {
  number: 0,
  name: 'Training Course',
  placedTiles: [
    { id: 't-mpta0aee-zro2', tileSideId: '09-D', origin: { q: 0, r: 0 }, rotation: 0 },
    { id: 't-mpta3br7-e3ps', tileSideId: '07-D', origin: { q: 5, r: -4 }, rotation: 0 },
    { id: 't-mpta5thx-c4df', tileSideId: '02-A', origin: { q: 7, r: -6 }, rotation: 3 },
  ],
  overlays: [
    { id: 'o-mpta12th-w1fm', kind: 'starting-position', hexes: [{ q: -4, r: 5 }] },
    { id: 'o-mpta14lz-4fcz', kind: 'starting-position', hexes: [{ q: -3, r: 5 }] },
    { id: 'o-mpta18a6-nj3d', kind: 'starting-position', hexes: [{ q: -2, r: 5 }] },
    { id: 'o-mpta1czq-etox', kind: 'starting-position', hexes: [{ q: -4, r: 6 }] },
    { id: 'o-mpta1ff5-u10e', kind: 'starting-position', hexes: [{ q: -3, r: 6 }] },
    { id: 'o-mpta1z23-sobh', kind: 'door', hexes: [{ q: 0, r: -1 }] },
    { id: 'o-mpta22w7-h24h', kind: 'token-1', hexes: [{ q: 0, r: -1 }] },
    { id: 'o-mpta5237-12k7', kind: 'door', hexes: [{ q: 6, r: -5 }] },
    { id: 'o-mpta57j8-oe5n', kind: 'token-2', hexes: [{ q: 6, r: -5 }] },
    { id: 'o-mpta8i1e-lh9f', kind: 'difficult-terrain', hexes: [{ q: 2, r: -2 }, { q: 2, r: -3 }] },
    { id: 'o-mpta8m40-r1nm', kind: 'difficult-terrain', hexes: [{ q: 5, r: -4 }, { q: 5, r: -3 }] },
    { id: 'o-mpta9iqg-mw22', kind: 'obstacle', hexes: [{ q: 5, r: -7 }] },
    { id: 'o-mpta9lef-n2qf', kind: 'obstacle', hexes: [{ q: 8, r: -8 }] },
  ],
  specialRules: 'The Scenario ends when all enemies in it are dead.',
  monsterSpawns: [
    // Room 1 (09-D) — training dummies.
    { id: 'm-mpu1nczo-cjtt', hex: { q: -2, r: 3 }, monsterType: 'city-guard', ranks: { 2: 'normal', 3: 'normal', 4: 'normal' }, behavior: 'dummy' },
    { id: 'm-mpu1pciu-7cbh', hex: { q: -1, r: 1 }, monsterType: 'city-guard', ranks: { 2: 'none', 3: 'none', 4: 'normal' }, behavior: 'dummy' },
    { id: 'm-mpu1pt0f-jmkq', hex: { q: -3, r: 0 }, monsterType: 'city-guard', ranks: { 2: 'none', 3: 'normal', 4: 'normal' }, behavior: 'dummy' },
    { id: 'm-mpu1q8mw-ofi8', hex: { q: 2, r: 0 }, monsterType: 'city-guard', ranks: { 2: 'normal', 3: 'normal', 4: 'normal' }, behavior: 'dummy' },
    // Room 2 (07-D) — sparring partners (scripted).
    { id: 'm-mpu1t01q-awc4', hex: { q: 0, r: -2 }, monsterType: 'city-guard', ranks: { 2: 'none', 3: 'none', 4: 'normal' }, behavior: 'scripted' },
    { id: 'm-mpu1th35-bb3l', hex: { q: 2, r: -4 }, monsterType: 'city-guard', ranks: { 2: 'none', 3: 'normal', 4: 'normal' }, behavior: 'scripted' },
    { id: 'm-mpu1tnv3-6grw', hex: { q: 4, r: -3 }, monsterType: 'city-guard', ranks: { 2: 'normal', 3: 'normal', 4: 'normal' }, behavior: 'scripted' },
    { id: 'm-mpu1tyr8-ctez', hex: { q: 5, r: -2 }, monsterType: 'city-guard', ranks: { 2: 'none', 3: 'normal', 4: 'normal' }, behavior: 'scripted' },
    { id: 'm-mpu1u55p-hfd4', hex: { q: 6, r: -4 }, monsterType: 'city-guard', ranks: { 2: 'normal', 3: 'normal', 4: 'normal' }, behavior: 'scripted' },
    { id: 'm-mpu1ub7e-77hc', hex: { q: 7, r: -3 }, monsterType: 'city-guard', ranks: { 2: 'normal', 3: 'normal', 4: 'normal' }, behavior: 'scripted' },
    // Room 3 (02-A) — advanced partners (normal).
    { id: 'm-mpu1wdj8-qn9n', hex: { q: 4, r: -6 }, monsterType: 'city-guard', ranks: { 2: 'normal', 3: 'normal', 4: 'normal' } },
    { id: 'm-mpu1wg04-bvh7', hex: { q: 7, r: -6 }, monsterType: 'city-guard', ranks: { 2: 'none', 3: 'none', 4: 'normal' } },
    { id: 'm-mpu1wmj9-t77k', hex: { q: 6, r: -7 }, monsterType: 'city-guard', ranks: { 2: 'none', 3: 'none', 4: 'normal' } },
    { id: 'm-mpu1wprj-5f56', hex: { q: 5, r: -8 }, monsterType: 'city-guard', ranks: { 2: 'none', 3: 'normal', 4: 'normal' } },
    { id: 'm-mpu1wsyc-tumf', hex: { q: 7, r: -9 }, monsterType: 'city-guard', ranks: { 2: 'elite', 3: 'elite', 4: 'elite' } },
  ],
};

const rules: ScenarioRules = {
  id: 'scenario-0',
  name: '0 · Training Course',
  objective: 'Defeat all the City Guards.',
  rooms: [ROOM_1, ROOM_2, ROOM_3],
  doors: [
    {
      id: 'door1',
      hex: { q: 0, r: -1 }, // token ① in 09-D
      revealsRoom: ROOM_2,
      unlock: { allMonstersDeadIn: ROOM_1 },
      narrativeKey: 'door:1',
    },
    {
      id: 'door2',
      hex: { q: 6, r: -5 }, // token ② in 07-D
      revealsRoom: ROOM_3,
      unlock: { allMonstersDeadIn: ROOM_2 },
      narrativeKey: 'door:2',
    },
  ],
  // Per-spawn tags already mark dummy/scripted/normal; this supplies the
  // scripted action's parameters (book: Move 2; Attack 2 at initiative 50).
  behaviorByRoom: {
    [ROOM_2]: { scripted: { initiative: 50, move: 2, attack: 2 } },
  },
  narrative: {
    start: {
      title: 'A New Recruit',
      body:
        "The training course near the Old Docks isn't much to speak of — muddy " +
        "trenches and a few hacked-up wooden dummies — but it's enough to warm " +
        'up your sword arm. The City Guards in this room are training dummies; ' +
        'they will not act. Door ① is locked and will unlock when all City ' +
        'Guards in this room are dead.',
    },
    'door:1': {
      title: 'Sparring Room',
      body:
        'You give the dummy one final slash to the neck and open the door to the ' +
        'sparring room. Duelists have paired off for some light fencing. You ' +
        'interrupt them and flip a few coins their way; they pocket the gold and ' +
        'turn as one, weapons raised. These training partners do not use their ' +
        'ability deck — they perform Move 2; Attack 2 at initiative 50 each ' +
        "round. That's more like it.",
    },
    'door:2': {
      title: 'Advanced Sparring Room',
      body:
        'You knock a fencer out cold and step into the advanced sparring room. ' +
        'The final room is pure chaos as guards and mercenaries grapple, kick, ' +
        'and stab with blunted weapons. These advanced training partners use ' +
        'everything in their ability card deck as normal.',
    },
    victory: {
      title: 'Sharp Again',
      body:
        "The last guard drops, and you catch your breath. You've still got it — " +
        'and just in time. New work is on the horizon.',
    },
  },
  victory: { kind: 'killAll' },
};

export const scenario0 = compileScenario(data, rules);
