import { faker } from '@faker-js/faker';

const BUSINESS_PREFIXES = [
  'global',
  'prime',
  'central',
  'city',
  'kampala',
  'ug',
  'uganda',
  'amazing',
  'elite',
  'premium',
  'wonderful',
  'fantastic',
  'perfect',
  'great',
];
const BUSINESS_SUFFIXES = [
  'capital',
  'international',
  'union',
  'solutions',
  'services',
  'enterprises',
  'group',
  'consulting',
  'partners',
  'business',
  'ug',
  'uganda',
  'family',
  'center',
  'hub',
  'spot',
  'south',
  'north',
  'east',
  'west',
  'central',
  'tech',
  'innovations',
  'innovators',
  'technologies',
  'hq',
  'labs',
];

interface Options {
  count?: number;
  prefixes?: string[];
  suffixes?: string[];
  minNumber?: number;
  maxNumber?: number;
}

export const generateSimilarHandles = (
  baseHandle: string,
  options: Options = {}
): string[] => {
  const {
    count = 3,
    prefixes = BUSINESS_PREFIXES,
    suffixes = BUSINESS_SUFFIXES,
    minNumber = 1,
    maxNumber = 999,
  } = options;

  const currentYear = new Date().getFullYear();
  const yearChoices = [currentYear - 1, currentYear, currentYear + 1];

  const suggestions = new Set<string>();

  const strategies = {
    1: () => {
      // Business-style prefix or suffix
      if (faker.datatype.boolean()) {
        const prefix = faker.helpers.arrayElement(prefixes);
        return `${prefix}-${baseHandle}`;
      }
      const suffix = faker.helpers.arrayElement(suffixes);
      return `${baseHandle}-${suffix}`;
    },
    2: () => {
      // Append a random number
      return `${baseHandle}-${faker.number.int({
        min: minNumber,
        max: maxNumber,
      })}`;
    },
    3: () => {
      // Append currentYear-1, currentYear, or currentYear+1
      const year = faker.helpers.arrayElement(yearChoices);
      return `${baseHandle}-${year}`;
    },
  };

  while (suggestions.size < count) {
    const strategy = faker.number.int({ min: 1, max: 3 });
    const variation =
      strategies[strategy as keyof typeof strategies]?.() || baseHandle;
    suggestions.add(variation.toLowerCase());
  }

  return Array.from(suggestions);
};

// const suggestions = generateSimilarHandles('nile-squad', { count: 3 });
// console.log(suggestions);
