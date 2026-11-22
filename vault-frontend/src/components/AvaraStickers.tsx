import React from 'react';

const outlineProps = {
  stroke: '#fff',
  strokeWidth: 7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function GhostSticker() {
  return (
    <svg viewBox="0 0 220 220" role="img" aria-label="Encrypt ghost">
      <defs><filter id="ghostShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodOpacity=".34" /></filter></defs>
      <g filter="url(#ghostShadow)">
        <path d="M45 154V112c0-43 27-70 65-70s65 27 65 70v42l-22 25-21-18-22 19-22-19-22 18-21-25Z" fill="#9d79d2" {...outlineProps} />
        <path d="M76 57c8-23 30-35 53-32l15 4-7 30H76Z" fill="#cbb9ee" {...outlineProps} />
        <path d="M122 29l6-16h15l5 19" fill="#cbb9ee" {...outlineProps} />
        <circle cx="87" cy="103" r="5" fill="#fff" stroke="none" /><circle cx="132" cy="103" r="5" fill="#fff" stroke="none" />
        <path d="M99 123c7 6 15 6 22 0" fill="none" {...outlineProps} strokeWidth="5" />
      </g>
    </svg>
  );
}

export function VaultSticker() {
  return (
    <svg viewBox="0 0 220 220" role="img" aria-label="Vault frame">
      <defs><filter id="vaultShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodOpacity=".34" /></filter></defs>
      <g filter="url(#vaultShadow)">
        <path d="M48 35c17-12 35 7 52-3 17-10 32 8 49-3 18-11 28 10 28 27 12 9 12 25 3 38 12 15-1 29 0 44 1 19-17 22-29 30-14 9-24-5-41 4-18 10-32-8-50-1-17 7-30-10-24-27-15-11-12-30-3-44-12-16 0-30 15-42Z" fill="#ff9b6a" {...outlineProps} />
        <rect x="69" y="72" width="82" height="82" rx="22" fill="#191919" {...outlineProps} />
        <circle cx="110" cy="113" r="20" fill="#ffc58f" stroke="#fff" strokeWidth="7" />
        <path d="M110 113v24" stroke="#191919" strokeWidth="7" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function CloudSticker() {
  return (
    <svg viewBox="0 0 220 220" role="img" aria-label="Health intelligence cloud">
      <defs><filter id="cloudShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodOpacity=".34" /></filter></defs>
      <g filter="url(#cloudShadow)">
        <path d="M62 160c-25 0-43-17-43-40 0-21 15-37 36-40 6-25 29-43 57-43 32 0 58 22 61 52 18 3 30 17 30 35 0 20-17 36-38 36H62Z" fill="#7db8d8" {...outlineProps} />
        <circle cx="89" cy="104" r="6" fill="#fff" stroke="none" /><circle cx="132" cy="104" r="6" fill="#fff" stroke="none" />
        <path d="M91 126c8 11 30 11 38 0" fill="none" {...outlineProps} strokeWidth="5" />
      </g>
    </svg>
  );
}

export function SmileySticker() {
  return (
    <svg viewBox="0 0 220 220" role="img" aria-label="Decrypt smiley">
      <defs><filter id="smileyShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodOpacity=".34" /></filter></defs>
      <g filter="url(#smileyShadow)">
        <circle cx="110" cy="110" r="78" fill="#8fd35b" {...outlineProps} />
        <path d="M77 99c4-11 12-17 22-17M143 99c-4-11-12-17-22-17" fill="none" stroke="#191919" strokeWidth="9" strokeLinecap="round" />
        <circle cx="85" cy="108" r="7" fill="#191919" /><circle cx="135" cy="108" r="7" fill="#191919" />
        <path d="M75 126c9 26 61 34 70 0-24 12-46 12-70 0Z" fill="#191919" stroke="#fff" strokeWidth="5" />
        <path d="M145 28c14-16 31-13 40 1" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      </g>
    </svg>
  );
}
