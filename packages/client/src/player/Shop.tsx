import {
  ALL_ITEMS,
  getItem,
  validateItemLoadout,
  type CharacterInstance,
  type ShopEntry,
} from '@gloomfolk/shared';
import { useSocket } from '../net/useSocket.js';
import { theme } from '../theme.js';

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

export function Shop({
  character,
  shop,
}: {
  character: CharacterInstance;
  shop: readonly ShopEntry[];
}) {
  const sock = useSocket();

  return (
    <section style={{ marginTop: 32 }}>
      <h3
        style={{
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          color: theme.muted,
          fontFamily: theme.headingFont,
          margin: '0 0 12px',
        }}
      >
        Shop · {character.gold}g
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shop.length === 0 && (
          <p style={{ color: theme.muted, fontSize: 13, margin: 0 }}>
            The shop is empty.
          </p>
        )}
        {shop.map((entry) => {
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
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 10,
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 4,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ color: theme.text }}>{item.name}</strong>
                  <span style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.5 }}>
                    {slotLabel(item.slot)} · {usageLabel(item.usage)}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: theme.muted }}>
                  {item.description}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: theme.muted }}>
                  Stock {entry.remaining} · {item.cost}g
                </p>
              </div>
              <button
                disabled={disabled}
                onClick={() => sock.send({ type: 'player_buy_item', itemId: item.id })}
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
                title={reason ?? undefined}
              >
                {reason ?? 'Buy'}
              </button>
            </div>
          );
        })}
      </div>

      {character.ownedItemIds.length > 0 && (
        <>
          <h3
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: theme.muted,
              fontFamily: theme.headingFont,
              margin: '24px 0 12px',
            }}
          >
            Owned — tap to bring
          </h3>
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
      )}
    </section>
  );
}
