const ADJECTIVES = [
  'Silent', 'Cosmic', 'Electric', 'Golden', 'Lucky', 'Sneaky', 'Rapid', 'Starry', 'Glacial', 'Neon',
  'Crimson', 'Velvet', 'Frosted', 'Midnight', 'Radiant', 'Lunar', 'Solar', 'Mystic', 'Ivory', 'Azure',
  'Blazing', 'Cobalt', 'Driftwood', 'Emerald', 'Feathered', 'Gentle', 'Hazel', 'Indigo', 'Jade', 'Kindred',
  'Luminous', 'Magnetic', 'Nimble', 'Opulent', 'Prismatic', 'Quicksilver', 'Roaring', 'Sapphire', 'Topaz', 'Umber',
  'Vivid', 'Whispering', 'Xenial', 'Yearning', 'Zephyr', 'Bold', 'Clever', 'Daring', 'Ethereal', 'Fierce'
];

const ANIMALS = [
  'Fox', 'Otter', 'Panda', 'Tiger', 'Hawk', 'Penguin', 'Wolf', 'Badger', 'Raven', 'Koala',
  'Falcon', 'Seal', 'Jaguar', 'Lynx', 'Moose', 'Narwhal', 'Orca', 'Quokka', 'Stag', 'Turtle',
  'Viper', 'Yak', 'Zebra', 'Bison', 'Coyote', 'Dolphin', 'Eagle', 'Flamingo', 'Giraffe', 'Heron',
  'Ibis', 'Jay', 'Kestrel', 'Lark', 'Marten', 'Newt', 'Ocelot', 'Puffin', 'Quail', 'Salmon',
  'Tapir', 'Urchin', 'Vixen', 'Walrus', 'Xerus', 'Yellowtail', 'Auk', 'Beetle', 'Crane', 'Dragonfly'
];

const EMAIL_PREFIX_LENGTH = 5;

/**
 * Extracts the first 4-5 characters from the email's local part (before @).
 * e.g. johnbob@gmail.com → "johnb"
 */
function getEmailPrefix(email) {
  if (!email || typeof email !== 'string') return null;
  const localPart = email.split('@')[0] || '';
  const cleaned = localPart.replace(/[^a-zA-Z0-9]/g, ''); // alphanumeric only
  if (cleaned.length < 4) return null;
  return cleaned.slice(0, EMAIL_PREFIX_LENGTH).toLowerCase();
}

export default function generateRandomName(email = null) {
  const emailPrefix = getEmailPrefix(email);
  const useAdjective = Math.random() < 0.5;
  const word = useAdjective
    ? ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    : ANIMALS[Math.floor(Math.random() * ANIMALS.length)];

  if (emailPrefix) {
    return `${emailPrefix}${word}`;
  }
  // Fallback when no valid email: adjective + animal (original behavior)
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}${animal}`;
}

/**
 * Returns true if the name matches the old auto-generated format (Adjective+Animal).
 * Used for migrations to safely identify which display names we generated vs user-set.
 */
export function isLegacyGeneratedName(name) {
  if (!name || typeof name !== 'string' || name.length < 4) return false;
  for (const adj of ADJECTIVES) {
    if (name.startsWith(adj)) {
      const rest = name.slice(adj.length);
      if (ANIMALS.includes(rest)) return true;
    }
  }
  return false;
}

