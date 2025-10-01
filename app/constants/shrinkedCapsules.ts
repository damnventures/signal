// Centralized Shrinked capsule definitions
// Add new capsules here and they'll be automatically picked up by all components

export const SHRINKED_CAPSULES = [
  {
    id: '68cdc3cf77fc9e53736d117e',
    name: 'Cooking Preview',
    icon: 'recipe',
    author: 'Shrinked'
  },
  {
    id: '68c32cf3735fb4ac0ef3ccbf',
    name: 'LastWeekTonight Preview',
    icon: 'tvhost',
    author: 'Shrinked'
  },
  {
    id: '68d3125877fc9e53736d7982',
    name: 'Tucker Capsule',
    icon: 'tvhost',
    author: 'Shrinked'
  },
  {
    id: '6887e02fa01e2f4073d3bb52',
    name: 'AI Research Papers',
    icon: 'document-pages',
    author: 'Shrinked'
  },
  {
    id: '6887e02fa01e2f4073d3bb54',
    name: 'Tech Podcasts',
    icon: 'voicerecords',
    author: 'Shrinked'
  }
] as const;

export const SHRINKED_CAPSULE_IDS = SHRINKED_CAPSULES.map(c => c.id) as string[];

export const getShrinkedCapsuleById = (id: string) =>
  SHRINKED_CAPSULES.find(c => c.id === id);

export const isShrinkedCapsule = (id: string) =>
  SHRINKED_CAPSULE_IDS.includes(id);