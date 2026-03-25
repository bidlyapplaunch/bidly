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

const LOCAL_PREFIX_LENGTH = 5;

/**
 * Display name = first 5 alphanumeric characters of the email local part (before @), lowercased.
 * Non-alphanumeric characters are stripped first (so user.name+tag → usernametag → usern).
 * Shorter cleaned local parts use the full cleaned string.
 */
export function getEmailLocalPrefix(email) {
  if (!email || typeof email !== 'string') return null;
  const localPart = (email.split('@')[0] || '').trim();
  const cleaned = localPart.replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return null;
  return cleaned.slice(0, LOCAL_PREFIX_LENGTH).toLowerCase();
}

/**
 * Default display name from email. No random component.
 * Fallback when email is missing or has no local part: "user".
 */
export default function generateRandomName(email = null) {
  const prefix = getEmailLocalPrefix(email);
  if (prefix) return prefix;
  return 'user';
}

/**
 * True if name matches the old auto-generated format (Adjective + Animal).
 */
function isLegacyAdjectiveAnimalName(name) {
  if (!name || typeof name !== 'string' || name.length < 4) return false;
  for (const adj of ADJECTIVES) {
    if (name.startsWith(adj)) {
      const rest = name.slice(adj.length);
      if (ANIMALS.includes(rest)) return true;
    }
  }
  return false;
}

/**
 * True if name matches the previous format: email prefix (4–5 alnum) + Adjective or Animal.
 * e.g. johnbCosmic
 */
function isLegacyEmailPrefixWordName(name) {
  if (!name || typeof name !== 'string' || name.length < 5) return false;
  const words = [...ADJECTIVES, ...ANIMALS];
  for (const word of words) {
    if (!name.endsWith(word) || name.length <= word.length) continue;
    const prefix = name.slice(0, -word.length);
    if (/^[a-z0-9]{4,5}$/.test(prefix)) return true;
  }
  return false;
}

/**
 * Returns true if the name looks like one of our auto-generated display names (any generation),
 * so migrations can replace it without touching user-chosen names.
 */
export function isLegacyGeneratedName(name) {
  return isLegacyAdjectiveAnimalName(name) || isLegacyEmailPrefixWordName(name);
}
