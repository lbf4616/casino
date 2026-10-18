export const CHARACTERS = [
  {
    id: 'horse',
    name: '妈妈',
    animal: '马',
    motto: '稳稳当当，慢慢来',
    accent: '#b97c4f',
    gender: 'female',
    voiceRate: 1.0,
  },
  {
    id: 'monkey',
    name: '爸爸',
    animal: '猴',
    motto: '心里有谱，手上不慌',
    accent: '#b9824f',
    gender: 'male',
    voiceRate: 0.78,
  },
  {
    id: 'snake',
    name: '姐姐',
    animal: '蛇',
    motto: '看得细致，算得明白',
    accent: '#6f9a67',
    gender: 'female',
    voiceRate: 1.05,
  },
  {
    id: 'rabbit',
    name: '姐夫',
    animal: '兔',
    motto: '稳稳落座，慢慢出牌',
    accent: '#6c9480',
    gender: 'male',
    voiceRate: 0.82,
  },
  {
    id: 'pig',
    name: '博凡',
    animal: '猪',
    motto: '福气在手，好牌常有',
    accent: '#d4888b',
    gender: 'male',
    voiceRate: 0.86,
  },
  {
    id: 'ox',
    name: '欣宇',
    animal: '牛',
    motto: '一步一步，稳到听牌',
    accent: '#a97c57',
    gender: 'female',
    voiceRate: 0.98,
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((character) => character.id === id) || CHARACTERS[0];
}

const ART = {
  horse: `
    <rect width="80" height="80" fill="#e9ddca"/>
    <path d="M23 36c-3-10 1-19 10-24 0 6 3 11 7 14 4-3 7-8 7-14 9 5 13 14 10 24" fill="#6f4a33"/>
    <path d="M27 27 24 12l13 8Z" fill="#a96b42"/>
    <path d="M53 27 56 12l-13 8Z" fill="#a96b42"/>
    <path d="M28 24 26.5 16l7 4.5Z" fill="#e2b39a"/>
    <path d="M52 24 53.5 16l-7 4.5Z" fill="#e2b39a"/>
    <ellipse cx="40" cy="45" rx="21" ry="22" fill="#b97c4f"/>
    <path d="M35 23c1-5 3-8 5-9 2 1 5 4 5 9-2-1.8-3.5-2.4-5-2.4S37 21.2 35 23Z" fill="#6f4a33"/>
    <ellipse cx="40" cy="54" rx="12.5" ry="9.5" fill="#f1d7ba"/>
    <ellipse cx="31" cy="41.5" rx="2.4" ry="3" fill="#3c3029"/>
    <ellipse cx="49" cy="41.5" rx="2.4" ry="3" fill="#3c3029"/>
    <circle cx="31.8" cy="40.7" r=".8" fill="#fffdf6"/>
    <circle cx="49.8" cy="40.7" r=".8" fill="#fffdf6"/>
    <circle cx="35.5" cy="53" r="1.2" fill="#7c5a43"/>
    <circle cx="44.5" cy="53" r="1.2" fill="#7c5a43"/>
    <path d="M37 57.2c2 1.8 4 1.8 6 0" fill="none" stroke="#8a654b" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="23.5" cy="51" r="4" fill="#d98f80" opacity=".35"/>
    <circle cx="56.5" cy="51" r="4" fill="#d98f80" opacity=".35"/>
    <path d="M20 38c-2 7-1 13 3 18M60 38c2 7 1 13-3 18" fill="none" stroke="#6f4a33" stroke-width="2" stroke-linecap="round" opacity=".55"/>
  `,
  monkey: `
    <rect width="80" height="80" fill="#efe4d2"/>
    <circle cx="17" cy="40" r="10" fill="#b9824f"/>
    <circle cx="63" cy="40" r="10" fill="#b9824f"/>
    <circle cx="17" cy="40" r="5.5" fill="#e8b79a"/>
    <circle cx="63" cy="40" r="5.5" fill="#e8b79a"/>
    <ellipse cx="40" cy="44" rx="22" ry="21" fill="#b9824f"/>
    <ellipse cx="40" cy="46" rx="17" ry="17" fill="#f3e1ca"/>
    <path d="M34 23c1-5 3-8 6-9 3 1 5 4 6 9-2-1-4-1.5-6-1.5s-4 .5-6 1.5Z" fill="#8b5a35"/>
    <ellipse cx="32.5" cy="42" rx="2.3" ry="2.9" fill="#3b2b24"/>
    <ellipse cx="47.5" cy="42" rx="2.3" ry="2.9" fill="#3b2b24"/>
    <circle cx="33.2" cy="41.2" r=".8" fill="#fffdf6"/>
    <circle cx="48.2" cy="41.2" r=".8" fill="#fffdf6"/>
    <path d="M28.5 37c1.6-1.4 3.5-1.7 5.3-.9M46.2 36.1c1.8-.8 3.7-.5 5.3.9" fill="none" stroke="#8b5a35" stroke-width="1.4" stroke-linecap="round" opacity=".75"/>
    <ellipse cx="40" cy="53" rx="10" ry="8" fill="#e9c9ab"/>
    <circle cx="36.7" cy="52.5" r="1" fill="#87624b"/>
    <circle cx="43.3" cy="52.5" r="1" fill="#87624b"/>
    <path d="M36 57c2.5 1.8 5.5 1.8 8 0" fill="none" stroke="#8b654b" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="23" cy="51" r="4" fill="#d98f80" opacity=".35"/>
    <circle cx="57" cy="51" r="4" fill="#d98f80" opacity=".35"/>
  `,
  snake: `
    <rect width="80" height="80" fill="#dfe9dc"/>
    <path d="M47 65c7 4 14 3 19-2" fill="none" stroke="#78a36e" stroke-width="6" stroke-linecap="round"/>
    <path d="M40 15c12 0 21 9 21 21 0 9-6 17-15 20-2 .7-4 1-6 1s-4-.3-6-1c-9-3-15-11-15-20 0-12 9-21 21-21Z" fill="#78a36e"/>
    <ellipse cx="40" cy="49" rx="12" ry="9" fill="#aac99d"/>
    <path d="M40 24l4 4-4 4-4-4Z" fill="#dcebd3" opacity=".85"/>
    <path d="M33 31l2.6 2.6L33 36.2l-2.6-2.6ZM47 31l2.6 2.6L47 36.2l-2.6-2.6Z" fill="#b8d4ab" opacity=".75"/>
    <ellipse cx="32.5" cy="41" rx="4" ry="4.5" fill="#edf1d0"/>
    <ellipse cx="47.5" cy="41" rx="4" ry="4.5" fill="#edf1d0"/>
    <ellipse cx="32.5" cy="41" rx="1" ry="3" fill="#2f3b2c"/>
    <ellipse cx="47.5" cy="41" rx="1" ry="3" fill="#2f3b2c"/>
    <circle cx="33.2" cy="39.5" r=".7" fill="#fffdf6"/>
    <circle cx="48.2" cy="39.5" r=".7" fill="#fffdf6"/>
    <circle cx="37" cy="47" r="1" fill="#5d7a52"/>
    <circle cx="43" cy="47" r="1" fill="#5d7a52"/>
    <path d="M35 51c3 2.2 7 2.2 10 0" fill="none" stroke="#5d7a52" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M40 54v7m0 0-4 4M40 61l4 4" fill="none" stroke="#c0645a" stroke-width="1.9" stroke-linecap="round"/>
    <circle cx="22" cy="49" r="3.5" fill="#d98f80" opacity=".25"/>
    <circle cx="58" cy="49" r="3.5" fill="#d98f80" opacity=".25"/>
  `,
  rabbit: `
    <rect width="80" height="80" fill="#dfebe3"/>
    <ellipse cx="29" cy="20" rx="8" ry="18" fill="#f7f1e5" transform="rotate(-9 29 20)"/>
    <ellipse cx="51" cy="20" rx="8" ry="18" fill="#f7f1e5" transform="rotate(9 51 20)"/>
    <ellipse cx="29" cy="21" rx="3.3" ry="11" fill="#eab8b1" transform="rotate(-9 29 21)"/>
    <ellipse cx="51" cy="21" rx="3.3" ry="11" fill="#eab8b1" transform="rotate(9 51 21)"/>
    <ellipse cx="40" cy="47" rx="24" ry="22" fill="#f8f2e7"/>
    <circle cx="30" cy="43" r="2.7" fill="#3f3831"/>
    <circle cx="50" cy="43" r="2.7" fill="#3f3831"/>
    <path d="m37 51 3-2 3 2-3 2.8Z" fill="#cf817b"/>
    <path d="M40 54v3M40 57c-2.4 2-5 1.6-6.3-.3M40 57c2.4 2 5 1.6 6.3-.3" fill="none" stroke="#51433b" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="21" cy="53" r="4.3" fill="#eeb1a9" opacity=".55"/>
    <circle cx="59" cy="53" r="4.3" fill="#eeb1a9" opacity=".55"/>
    <path d="M20 30c3 1.8 4.8 4.3 5.6 7M60 30c-3 1.8-4.8 4.3-5.6 7" fill="none" stroke="#c9d8ce" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pig: `
    <rect width="80" height="80" fill="#f3e4de"/>
    <path d="M24 30 17 15l17 8Z" fill="#e0a19e"/>
    <path d="M56 30 63 15l-17 8Z" fill="#e0a19e"/>
    <path d="M25 26 21 17l9 4.5Z" fill="#f2c2be"/>
    <path d="M55 26 59 17l-9 4.5Z" fill="#f2c2be"/>
    <ellipse cx="40" cy="45" rx="23" ry="21" fill="#e9b3ad"/>
    <path d="M32 26c2-4 7-5 10-2" fill="none" stroke="#d28f8b" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="30.5" cy="41" rx="2.3" ry="2.9" fill="#4a3230"/>
    <ellipse cx="49.5" cy="41" rx="2.3" ry="2.9" fill="#4a3230"/>
    <circle cx="31.2" cy="40.2" r=".8" fill="#fffdf6"/>
    <circle cx="50.2" cy="40.2" r=".8" fill="#fffdf6"/>
    <ellipse cx="40" cy="53" rx="11" ry="8" fill="#d98f8b"/>
    <ellipse cx="36.5" cy="53" rx="1.4" ry="1.8" fill="#a75f5d"/>
    <ellipse cx="43.5" cy="53" rx="1.4" ry="1.8" fill="#a75f5d"/>
    <path d="M36.5 61c2 1.5 5 1.5 7 0" fill="none" stroke="#b97572" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="21.5" cy="51" r="4" fill="#d77b72" opacity=".4"/>
    <circle cx="58.5" cy="51" r="4" fill="#d77b72" opacity=".4"/>
  `,
  ox: `
    <rect width="80" height="80" fill="#e8e5d5"/>
    <path d="M28 28C20 29 13 25 9 16c8 0 15 3 21 9Z" fill="#f4ead7" stroke="#c0a078" stroke-width="1.2"/>
    <path d="M52 28c8 1 15-3 19-12-8 0-15 3-21 9Z" fill="#f4ead7" stroke="#c0a078" stroke-width="1.2"/>
    <path d="M13 19c4 2 7 4 10 7M67 19c-4 2-7 4-10 7" fill="none" stroke="#d7bd96" stroke-width="1" stroke-linecap="round"/>
    <ellipse cx="16" cy="39" rx="6" ry="4" fill="#9d714d" transform="rotate(-20 16 39)"/>
    <ellipse cx="64" cy="39" rx="6" ry="4" fill="#9d714d" transform="rotate(20 64 39)"/>
    <ellipse cx="40" cy="45" rx="20" ry="22" fill="#9f7554"/>
    <path d="M36 24c1-4 2.5-6 4-7 1.5 1 3 3 4 7l-1 9h-6Z" fill="#f1dcc0" opacity=".85"/>
    <path d="M35 19c1.5-2.5 3-4 5-5 2 1 3.5 2.5 5 5-2-.8-3.5-1.1-5-1.1s-3 .3-5 1.1Z" fill="#7a573d" opacity=".8"/>
    <ellipse cx="31" cy="42" rx="2.4" ry="3" fill="#382b23"/>
    <ellipse cx="49" cy="42" rx="2.4" ry="3" fill="#382b23"/>
    <circle cx="31.8" cy="41.2" r=".8" fill="#fffdf6"/>
    <circle cx="49.8" cy="41.2" r=".8" fill="#fffdf6"/>
    <ellipse cx="40" cy="54" rx="14" ry="10" fill="#f1dcc0"/>
    <ellipse cx="35" cy="54" rx="1.5" ry="2" fill="#8b6548"/>
    <ellipse cx="45" cy="54" rx="1.5" ry="2" fill="#8b6548"/>
    <path d="M36 59c2.5 1.8 5.5 1.8 8 0" fill="none" stroke="#8b6548" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="22" cy="52" r="3.8" fill="#d98f80" opacity=".28"/>
    <circle cx="58" cy="52" r="3.8" fill="#d98f80" opacity=".28"/>
  `,
};

export function avatarHTML(id, options = {}) {
  const character = getCharacter(id);
  const className = options.className || 'avatar-svg';
  const title = options.decorative === false ? character.name : '';
  return `<svg class="${className}" viewBox="0 0 80 80" role="img" aria-hidden="${title ? 'false' : 'true'}"${title ? ` aria-label="${title}"` : ''} xmlns="http://www.w3.org/2000/svg">
    <clipPath id="clip-${character.id}"><circle cx="40" cy="40" r="40"/></clipPath>
    <g clip-path="url(#clip-${character.id})">${ART[character.id]}</g>
  </svg>`;
}
