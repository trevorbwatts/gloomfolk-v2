import {
  ALL_ITEMS,
  getItem,
  validateItemLoadout,
  type CharacterInstance,
  type Item,
  type ShopEntry,
} from '@gloomfolk/shared';
import { useSocket } from '../net/useSocket.js';
import { theme } from '../theme.js';

const GOLD = '#d9a441';

function slotLabel(slot: string): string {
  switch (slot) {
    case 'one-hand': return 'One Hand';
    case 'two-hands': return 'Two Hands';
    default: return slot.charAt(0).toUpperCase() + slot.slice(1);
  }
}

function usageLabel(usage: { kind: string }): string {
  switch (usage.kind) {
    case 'spent': return 'Spent';
    case 'lost': return 'Lost';
    case 'multi-use': return 'Multi-use';
    default: return usage.kind;
  }
}

/** Per-item purchase status. */
interface BuyState {
  item: Item;
  remaining: number;
  owned: boolean;
  outOfStock: boolean;
  tooPoor: boolean;
  disabled: boolean;
  /** Tooltip / hint text when the buy is blocked. */
  reason: string | null;
  /** Short button label for the current state. */
  label: string;
}

function buyState(entry: ShopEntry, character: CharacterInstance): BuyState | null {
  const item = getItem(entry.itemId);
  if (!item) return null;
  const owned = character.ownedItemIds.includes(item.id);
  const outOfStock = entry.remaining <= 0;
  const tooPoor = character.gold < item.cost;
  const disabled = owned || outOfStock || tooPoor;
  const reason = owned
    ? 'Owned'
    : outOfStock
      ? 'Out of stock'
      : tooPoor
        ? `Need ${item.cost - character.gold}g more`
        : null;
  const label = owned ? 'Owned' : outOfStock ? 'Out of stock' : 'Buy';
  return { item, remaining: entry.remaining, owned, outOfStock, tooPoor, disabled, reason, label };
}

const sectionHeading: React.CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
  color: theme.muted,
  fontFamily: theme.headingFont,
  margin: '0 0 12px',
};

export function Shop({
  character,
  shop,
}: {
  character: CharacterInstance;
  shop: readonly ShopEntry[];
}) {
  const sock = useSocket();

  const onBuy = (itemId: string) =>
    sock.send({ type: 'player_buy_item', itemId });

  const onUndo = (itemId: string) =>
    sock.send({ type: 'player_undo_buy_item', itemId });

  // Items bought this shopping trip can be returned for a full refund until the
  // scenario starts.
  const sessionPurchased = new Set(character.sessionPurchasedItemIds ?? []);

  const states = shop
    .map((entry) => buyState(entry, character))
    .filter((s): s is BuyState => s !== null);

  return (
    <section style={{ marginTop: 32 }}>
      <h3 style={sectionHeading}>Shop</h3>

      {character.ownedItemIds.length === 0 && (
        <p style={{ color: theme.muted, fontSize: 13, margin: '0 0 12px', lineHeight: 1.4 }}>
          You have {character.gold} gold to spend on items. Stock up before the
          scenario begins — anything you don’t spend carries over.
        </p>
      )}

      {states.length === 0 && (
        <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>
          The shop is empty.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}
      >
        {states.map(({ item, remaining, owned, disabled, reason, label }) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: 12,
              background: theme.panel,
              border: `1px solid ${owned ? theme.accent : theme.border}`,
              borderRadius: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
              <strong style={{ color: theme.text, fontSize: 14, lineHeight: 1.2 }}>{item.name}</strong>
              <span style={{ fontSize: 15, fontWeight: 700, color: GOLD, whiteSpace: 'nowrap' }}>
                {item.cost}G
              </span>
            </div>
            <span style={{ fontSize: 10, color: theme.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 }}>
              {slotLabel(item.slot)} · {usageLabel(item.usage)}
            </span>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: theme.muted, lineHeight: 1.4, flex: 1 }}>
              {item.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 11, color: theme.muted }}>Stock {remaining}</span>
              {owned && sessionPurchased.has(item.id) ? (
                <UndoButton onClick={() => onUndo(item.id)} />
              ) : (
                <BuyButton disabled={disabled} reason={reason} label={label} onClick={() => onBuy(item.id)} />
              )}
            </div>
          </div>
        ))}
      </div>

      <OwnedItems character={character} sock={sock} />
    </section>
  );
}

function BuyButton({
  disabled,
  reason,
  label,
  onClick,
}: {
  disabled: boolean;
  reason: string | null;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={reason ?? undefined}
      style={{
        fontSize: 13,
        padding: '8px 14px',
        background: disabled ? 'transparent' : theme.accent,
        color: disabled ? theme.muted : '#0e1612',
        border: disabled ? `1px solid ${theme.border}` : 'none',
        borderRadius: 3,
        fontFamily: theme.headingFont,
        letterSpacing: 1,
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Refund this purchase"
      style={{
        fontSize: 13,
        padding: '8px 14px',
        background: 'transparent',
        color: theme.text,
        border: `1px solid ${theme.border}`,
        borderRadius: 3,
        fontFamily: theme.headingFont,
        letterSpacing: 1,
        textTransform: 'uppercase',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      Undo
    </button>
  );
}

function OwnedItems({
  character,
  sock,
}: {
  character: CharacterInstance;
  sock: ReturnType<typeof useSocket>;
}) {
  if (character.ownedItemIds.length === 0) return null;
  return (
    <>
      <h3 style={{ ...sectionHeading, margin: '24px 0 12px' }}>Owned — tap to bring</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {character.ownedItemIds.map((id) => {
          const item = ALL_ITEMS[id];
          if (!item) return null;
          const bringing = character.broughtItemIds.includes(id);
          return (
            <button
              key={id}
              onClick={() => {
                const next = bringing
                  ? character.broughtItemIds.filter((x) => x !== id)
                  : [...character.broughtItemIds, id];
                const validation = validateItemLoadout(
                  character.level,
                  character.ownedItemIds,
                  next,
                );
                if (!validation.ok) {
                  alert(`Cannot bring: ${validation.reason}`);
                  return;
                }
                sock.send({ type: 'player_set_item_loadout', itemIds: next });
              }}
              style={{
                padding: 10,
                background: bringing ? `${theme.accent}22` : theme.panel,
                border: `1px solid ${bringing ? theme.accent : theme.border}`,
                borderRadius: 4,
                fontSize: 13,
                color: theme.text,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontFamily: theme.font,
                textAlign: 'left',
              }}
            >
              <span style={{ flex: 1 }}>
                <strong>{item.name}</strong>
                <span style={{ color: theme.muted, marginLeft: 8, fontSize: 11 }}>
                  {slotLabel(item.slot)} · {usageLabel(item.usage)}
                </span>
              </span>
              <span style={{ fontSize: 11, color: bringing ? theme.accent : theme.muted }}>
                {bringing ? '✓ Bringing' : 'Tap to bring'}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
