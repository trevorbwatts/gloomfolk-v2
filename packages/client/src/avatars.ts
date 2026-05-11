import type React from 'react';

const CLASS_EXT = 'jpg';
const MONSTER_EXT = 'jpg';

const FALLBACK = '/avatars/unknown.jpg';

export const classAvatarUrl = (id: string) => `/avatars/classes/${id}.${CLASS_EXT}`;
export const monsterAvatarUrl = (id: string) => `/avatars/monsters/${id}.${MONSTER_EXT}`;

export function onAvatarError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src.endsWith(FALLBACK)) return;
  img.src = FALLBACK;
}
