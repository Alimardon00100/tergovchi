import { useId } from 'react';

export function SafeEquipment() {
  const id = useId().replace(/:/g, '');
  const steel = `url(#${id}-steel)`;
  return (
    <svg className="metal-equipment" viewBox="0 0 620 230" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-steel`} x1="0" y1="0" x2=".3" y2="1">
          <stop stopColor="#b3b4a8" />
          <stop offset=".15" stopColor="#575b59" />
          <stop offset=".38" stopColor="#93958b" />
          <stop offset=".56" stopColor="#333a3b" />
          <stop offset=".85" stopColor="#7a7e79" />
          <stop offset="1" stopColor="#252d2e" />
        </linearGradient>
        <linearGradient id={`${id}-slide`} x2="0" y2="1">
          <stop stopColor="#85857a" />
          <stop offset=".15" stopColor="#303839" />
          <stop offset=".55" stopColor="#515754" />
          <stop offset=".78" stopColor="#202728" />
          <stop offset="1" stopColor="#6d7169" />
        </linearGradient>
        <linearGradient id={`${id}-wood`} x2="1" y2=".6">
          <stop stopColor="#3c2117" />
          <stop offset=".4" stopColor="#875333" />
          <stop offset=".7" stopColor="#5b321f" />
          <stop offset="1" stopColor="#2e1b15" />
        </linearGradient>
        <pattern
          id={`${id}-grip`}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(25)"
        >
          <path d="M0 0H5M0 3H5" stroke="#c994563d" strokeWidth=".8" />
          <path d="M0 0V5" stroke="#1c130f66" strokeWidth="1" />
        </pattern>
        <filter id={`${id}-shadow`} x="-25%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="3" dy="7" stdDeviation="4" floodOpacity=".75" />
        </filter>
        <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#64441e" />
          <stop offset=".22" stopColor="#e2bf67" />
          <stop offset=".4" stopColor="#f7df9d" />
          <stop offset=".65" stopColor="#b68a39" />
          <stop offset="1" stopColor="#58421f" />
        </linearGradient>
      </defs>
      <g
        className="metal-pistol"
        transform="translate(10 8) rotate(6 180 110)"
        filter={`url(#${id}-shadow)`}
      >
        <path
          d="M122 39l-5-13 10-3 9 15M107 53l-17-8-8 12 13 8"
          fill={steel}
          stroke="#232b2a"
          strokeWidth="2"
        />
        <path
          d="M111 48h230l8 7v31l-6 8H153l-11 19-21 2-45 79-32-13 49-102 10-6z"
          fill={steel}
          stroke="#1b2222"
          strokeWidth="3"
        />
        <path
          d="M113 40h229l9 9v34H106V51z"
          fill={`url(#${id}-slide)`}
          stroke="#222a29"
          strokeWidth="2"
        />
        <path d="M121 43h221M112 77h234M148 86h192" stroke="#a4a493" strokeWidth="1" opacity=".6" />
        <path d="M338 48v28M343 51v23" stroke="#121c1c" strokeWidth="3" />
        <path d="M243 45h53v12h-53z" fill="#172222" stroke="#a1a08c" strokeWidth="1" />
        {Array.from({ length: 13 }, (_, i) => (
          <path key={i} d={`M${117 + i * 4} 48l-5 24`} stroke="#131e1e" strokeWidth="2" />
        ))}
        <path d="M145 91h54l-3 17c-4 19-40 24-55 10" fill="none" stroke={steel} strokeWidth="9" />
        <path d="M164 93c-8 4-7 13 2 17" fill="none" stroke="#767c72" strokeWidth="4" />
        <path
          d="M115 92l32 10-39 91-38-11z"
          fill={`url(#${id}-wood)`}
          stroke="#251b14"
          strokeWidth="3"
        />
        <path d="M115 96l28 9-37 83-31-10z" fill={`url(#${id}-grip)`} />
        <path d="M113 98l-32 77" stroke="#c3945e" strokeWidth="1" opacity=".6" />
        <g fill="#b5ad8a" stroke="#241d14" strokeWidth="2">
          <circle cx="119" cy="111" r="3.5" />
          <circle cx="91" cy="174" r="3.5" />
        </g>
        <path d="M115 111h7M88 174h7" stroke="#392b1a" strokeWidth="1" />
        <path d="M72 185l33 12-4 6-33-12z" fill="#292c29" stroke="#76796a" />
        <path d="M323 37h12v5h-12M122 35h14v6h-14" fill="#262e2d" stroke="#929585" />
        <circle cx="139" cy="89" r="3" fill="#b2b19b" />
      </g>
      <g className="metal-handcuffs" filter={`url(#${id}-shadow)`} transform="rotate(-6 480 130)">
        <path
          d="M432 70l17-24 19 2 12 22M504 73l13-23 19 5 8 23"
          fill="none"
          stroke="#172323"
          strokeWidth="10"
        />
        <path
          d="M432 70l17-24 19 2 12 22M504 73l13-23 19 5 8 23"
          fill="none"
          stroke={steel}
          strokeWidth="6"
        />
        <path
          d="M461 46c8-26 25-31 39-6M476 39c8-13 18-14 24-3M495 39l19 16"
          fill="none"
          stroke="#121d1e"
          strokeWidth="7"
        />
        <path
          d="M461 46c8-26 25-31 39-6M476 39c8-13 18-14 24-3M495 39l19 16"
          fill="none"
          stroke="#a8aa9b"
          strokeWidth="3"
        />
        {[
          { x: 438, y: 130, r: 42 },
          { x: 535, y: 138, r: 43 },
        ].map(({ x, y, r }) => (
          <g key={x}>
            <circle cx={x} cy={y} r={r} fill="#111c1b" stroke="#1b2424" strokeWidth="18" />
            <circle cx={x} cy={y} r={r} fill="none" stroke={steel} strokeWidth="14" />
            <circle
              cx={x}
              cy={y}
              r={r + 6}
              fill="none"
              stroke="#c5c4af"
              strokeWidth="1.1"
              opacity=".6"
            />
            <path
              d={`M${x - 24} ${y - 36}l2-21 42 1 5 22`}
              fill={steel}
              stroke="#263130"
              strokeWidth="2"
            />
            <circle cx={x} cy={y - 43} r="3" fill="#111c1d" />
            <path d={`M${x} ${y - 43}v6`} stroke="#111c1d" strokeWidth="2" />
            <circle cx={x - 14} cy={y - 45} r="2" fill="#d4d0b8" />
          </g>
        ))}
      </g>
      <g className="metal-cartridges" filter={`url(#${id}-shadow)`}>
        {[0, 1, 2, 3].map((n) => (
          <g
            key={n}
            transform={`translate(${215 + n * 27} ${154 + (n % 2) * 7}) rotate(${64 + n * 4})`}
          >
            <path
              d="M-6 4C-6-8-4-18 0-21 4-18 6-8 6 4Z"
              fill={`url(#${id}-brass)`}
              stroke="#6b4927"
              strokeWidth="1"
            />
            <path d="M-7 3H7V39H-7Z" fill={`url(#${id}-brass)`} stroke="#63451f" strokeWidth="1" />
            <path d="M-8 38H8V43H-8Z" fill={`url(#${id}-brass)`} stroke="#644d25" strokeWidth="1" />
            <path d="M-4 6V36M-5-1V2" stroke="#ffe8a6" strokeWidth="1" opacity=".8" />
            <path d="M-7 34H7M-8 40H8" stroke="#7f5a29" strokeWidth="1" />
          </g>
        ))}
      </g>
    </svg>
  );
}
