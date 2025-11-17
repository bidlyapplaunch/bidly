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

export default function generateRandomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}${animal}`;
}

