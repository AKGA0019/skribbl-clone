const WORDS = [
  { word: 'apple', category: 'food' }, { word: 'banana', category: 'food' },
  { word: 'pizza', category: 'food' }, { word: 'burger', category: 'food' },
  { word: 'ice cream', category: 'food' }, { word: 'cake', category: 'food' },
  { word: 'sandwich', category: 'food' }, { word: 'watermelon', category: 'food' },
  { word: 'car', category: 'vehicle' }, { word: 'bicycle', category: 'vehicle' },
  { word: 'airplane', category: 'vehicle' }, { word: 'rocket', category: 'vehicle' },
  { word: 'train', category: 'vehicle' }, { word: 'boat', category: 'vehicle' },
  { word: 'bus', category: 'vehicle' }, { word: 'motorcycle', category: 'vehicle' },
  { word: 'cat', category: 'animal' }, { word: 'dog', category: 'animal' },
  { word: 'elephant', category: 'animal' }, { word: 'lion', category: 'animal' },
  { word: 'monkey', category: 'animal' }, { word: 'penguin', category: 'animal' },
  { word: 'giraffe', category: 'animal' }, { word: 'butterfly', category: 'animal' },
  { word: 'tree', category: 'nature' }, { word: 'flower', category: 'nature' },
  { word: 'mountain', category: 'nature' }, { word: 'sun', category: 'nature' },
  { word: 'rainbow', category: 'nature' }, { word: 'cloud', category: 'nature' },
  { word: 'star', category: 'nature' }, { word: 'volcano', category: 'nature' },
  { word: 'phone', category: 'object' }, { word: 'laptop', category: 'object' },
  { word: 'camera', category: 'object' }, { word: 'umbrella', category: 'object' },
  { word: 'chair', category: 'object' }, { word: 'guitar', category: 'object' },
  { word: 'book', category: 'object' }, { word: 'key', category: 'object' },
  { word: 'football', category: 'sport' }, { word: 'basketball', category: 'sport' },
  { word: 'cricket', category: 'sport' }, { word: 'tennis', category: 'sport' },
  { word: 'swimming', category: 'sport' }, { word: 'running', category: 'sport' },
  { word: 'jumping', category: 'action' }, { word: 'sleeping', category: 'action' },
  { word: 'dancing', category: 'action' }, { word: 'cooking', category: 'action' }
];

function sampleWords(count = 3) {
  const pool = [...WORDS];
  const result = [];
  while (result.length < Math.min(count, pool.length)) {
    const index = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

module.exports = { WORDS, sampleWords };
