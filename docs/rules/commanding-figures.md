# Commanding Figures

> Transcribed from the Gloomhaven 2E rulebook.

Commanding figures is a **targeted ability** that allows a figure to command
another figure to perform certain abilities. There are two ways to command
figures:

- **Grant.** Allows a figure to grant an ability to any figure. The commanded
  figure then performs that ability. If the commanded figure is a character
  summon or scenario ally, the **commanding** figure decides how the ability
  is performed.
- **Control.** Allows a figure to control an ability of an enemy. The
  commanded figure then performs that ability, and the **commanding** figure
  decides how it is performed. During this ability, the commanded figure
  treats the commanding figure's allies and enemies as their own. **When a
  move ability is controlled, it is considered forced movement.**

If an attack ability is granted or controlled, the commanded figure uses
their **normal attack modifier deck**. An attack ability cannot be granted
or controlled if the commanded figure has no valid targets or is affected
by a negative condition that prevents the attack ability.

A figure can be commanded to perform **"Attack X"** or **"Move X"** even if
they have no attack or move stat value. However, a figure **cannot** be
commanded to perform **"Attack ±X"** or **"Move ±X"** if they have no
attack or move stat value.

- **"Attack X"** granted to a summon is always a melee attack, but
  **"Attack +X"** uses the summon's inherent range (if any).
- A commanded figure retains all of their **persistent bonuses and special
  traits**.
- A commanded ability is **not considered a separate turn**.
- **Objectives cannot be commanded.**

## Implications for the schema

- **New `AbilityStep` variant** when a Bruiser card uses it. Two subtypes —
  Grant and Control — with similar payload:
  ```ts
  | {
      type: 'command';
      mode: 'grant' | 'control';
      ability: GrantedAbility;
      mandatory?: boolean;
    }
  ```
  where `GrantedAbility` describes *what* is granted/controlled. Likely a
  trimmed-down union over a few primitives:
  ```ts
  type GrantedAbility =
    | { kind: 'attack'; amount: number | { delta: number } }   // X or ±X
    | { kind: 'move';   amount: number | { delta: number } };
  ```
  Defer until a card needs it.

- **Targeted ability** → polarity matters. Grant is positive (target
  allies/self/summons), Control is negative (target enemies). Engine
  concern.

- **Controlled move = forced movement** (immobilize/stun bypass rules apply
  per [forced-movement-and-loot.md](forced-movement-and-loot.md)).

- **`±X` requires existing stat.** Engine validation: when resolving a
  granted/controlled `Attack ±X` or `Move ±X`, check the target has an
  attack/move stat first. Doesn't affect data layer.

- **Commanded summon Attack X = melee, Attack +X = inherent range.** Engine
  resolves; no card-data flag needed.

- **Modifier deck:** commanded figure uses **their own** deck on attacks.
  (Notably different from the summon rule, where summons use their
  summoner's deck. Engine routes correctly.)
