export function HeroVisual({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1200 800"
        width="1200"
        height="800"
      >
        <defs>
          <radialGradient
            id="hv-bgGlowOrange"
            cx="780"
            cy="400"
            r="360"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.12" />
            <stop offset="60%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="hv-bgGlowBlue"
            cx="120"
            cy="100"
            r="280"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="hv-coreGradient"
            cx="750"
            cy="400"
            r="60"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="hv-coreHalo"
            cx="750"
            cy="400"
            r="80"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
          </radialGradient>
          <filter id="hv-glow">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="hv-coreGlow">
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <filter id="hv-cardBlur">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
        </defs>

        <rect width="1200" height="800" fill="#0f172a" />

        <rect width="1200" height="800" fill="url(#hv-bgGlowOrange)" />
        <rect width="1200" height="800" fill="url(#hv-bgGlowBlue)" />

        <circle
          cx="750"
          cy="400"
          r="80"
          fill="#f97316"
          opacity="0.4"
          filter="url(#hv-coreGlow)"
        />

        <g filter="url(#hv-glow)">
          <polygon
            points="750,280 840,360 810,480"
            fill="rgba(251,146,60,0.15)"
            stroke="rgba(251,146,60,0.4)"
            strokeWidth="0.8"
          />
          <polygon
            points="750,280 660,360 690,480"
            fill="rgba(251,146,60,0.08)"
            stroke="rgba(251,146,60,0.25)"
            strokeWidth="0.8"
          />
          <polygon
            points="840,360 810,480 900,430"
            fill="rgba(251,146,60,0.22)"
            stroke="rgba(251,146,60,0.5)"
            strokeWidth="0.8"
          />
          <polygon
            points="660,360 690,480 600,430"
            fill="rgba(251,146,60,0.18)"
            stroke="rgba(251,146,60,0.45)"
            strokeWidth="0.8"
          />
          <polygon
            points="750,280 840,360 900,300"
            fill="rgba(251,146,60,0.10)"
            stroke="rgba(251,146,60,0.3)"
            strokeWidth="0.8"
          />
          <polygon
            points="750,280 660,360 600,300"
            fill="rgba(251,146,60,0.06)"
            stroke="rgba(251,146,60,0.2)"
            strokeWidth="0.8"
          />
          <polygon
            points="810,480 690,480 750,530"
            fill="rgba(251,146,60,0.20)"
            stroke="rgba(251,146,60,0.5)"
            strokeWidth="0.8"
          />
          <polygon
            points="900,430 810,480 870,520"
            fill="rgba(251,146,60,0.12)"
            stroke="rgba(251,146,60,0.35)"
            strokeWidth="0.8"
          />
          <polygon
            points="600,430 690,480 630,520"
            fill="rgba(251,146,60,0.09)"
            stroke="rgba(251,146,60,0.28)"
            strokeWidth="0.8"
          />
          <polygon
            points="840,360 900,430 950,380"
            fill="rgba(251,146,60,0.07)"
            stroke="rgba(251,146,60,0.22)"
            strokeWidth="0.8"
          />
          <polygon
            points="660,360 600,430 550,380"
            fill="rgba(251,146,60,0.05)"
            stroke="rgba(251,146,60,0.18)"
            strokeWidth="0.8"
          />
        </g>

        <circle cx="750" cy="400" r="60" fill="url(#hv-coreGradient)" />
        <circle cx="750" cy="400" r="30" fill="url(#hv-coreHalo)" />

        <polygon
          points="750,340 762,370 750,360"
          fill="rgba(255,255,255,0.6)"
          opacity="0.8"
        />
        <polygon
          points="780,370 790,395 775,385"
          fill="rgba(255,255,255,0.4)"
          opacity="0.7"
        />
        <polygon
          points="730,380 740,400 720,395"
          fill="rgba(255,255,255,0.3)"
          opacity="0.5"
        />

        <path
          d="M750,400 Q900,300 1100,200"
          stroke="rgba(249,115,22,0.2)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 8"
        />
        <path
          d="M750,400 Q1000,420 1180,380"
          stroke="rgba(249,115,22,0.15)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 8"
        />
        <path
          d="M750,400 Q800,550 950,650"
          stroke="rgba(249,115,22,0.18)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 8"
        />
        <path
          d="M750,400 Q600,500 400,580"
          stroke="rgba(249,115,22,0.1)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 8"
        />
        <path
          d="M750,400 Q650,250 500,150"
          stroke="rgba(249,115,22,0.08)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 8"
        />

        <g filter="url(#hv-cardBlur)">
          <rect
            x="880"
            y="155"
            width="220"
            height="110"
            rx="12"
            fill="rgba(255,255,255,0.06)"
          />
          <rect
            x="880"
            y="155"
            width="220"
            height="110"
            rx="12"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
          <circle cx="900" cy="177" r="4" fill="#f97316" opacity="0.9" />
          <text
            x="911"
            y="181"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="10"
            fill="rgba(255,255,255,0.5)"
          >
            Content Score
          </text>
          <text
            x="896"
            y="225"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="28"
            fontWeight="700"
            fill="rgba(255,255,255,0.9)"
          >
            94%
          </text>
          <rect
            x="896"
            y="238"
            width="8"
            height="14"
            rx="1"
            fill="#f97316"
            opacity="0.7"
          />
          <rect
            x="908"
            y="232"
            width="8"
            height="20"
            rx="1"
            fill="#f97316"
            opacity="0.7"
          />
          <rect
            x="920"
            y="235"
            width="8"
            height="17"
            rx="1"
            fill="#f97316"
            opacity="0.7"
          />
          <rect
            x="932"
            y="228"
            width="8"
            height="24"
            rx="1"
            fill="#f97316"
            opacity="0.7"
          />
          <rect
            x="944"
            y="234"
            width="8"
            height="18"
            rx="1"
            fill="#f97316"
            opacity="0.7"
          />
          <rect
            x="956"
            y="230"
            width="8"
            height="22"
            rx="1"
            fill="#f97316"
            opacity="0.9"
          />
        </g>

        <g filter="url(#hv-cardBlur)">
          <rect
            x="920"
            y="335"
            width="200"
            height="90"
            rx="12"
            fill="rgba(255,255,255,0.06)"
          />
          <rect
            x="920"
            y="335"
            width="200"
            height="90"
            rx="12"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
          <text
            x="938"
            y="360"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="10"
            fill="rgba(255,255,255,0.5)"
          >
            Engagement
          </text>
          <text
            x="936"
            y="395"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="22"
            fontWeight="700"
            fill="rgba(255,255,255,0.9)"
          >
            &#8593; 3.2&#215;
          </text>
          <rect
            x="1020"
            y="368"
            width="10"
            height="8"
            rx="1"
            fill="#f97316"
            opacity="0.5"
          />
          <rect
            x="1034"
            y="362"
            width="10"
            height="14"
            rx="1"
            fill="#f97316"
            opacity="0.6"
          />
          <rect
            x="1048"
            y="356"
            width="10"
            height="20"
            rx="1"
            fill="#f97316"
            opacity="0.8"
          />
          <rect
            x="1062"
            y="352"
            width="10"
            height="24"
            rx="1"
            fill="#f97316"
            opacity="0.9"
          />
          <rect
            x="1076"
            y="358"
            width="10"
            height="18"
            rx="1"
            fill="#f97316"
            opacity="0.7"
          />
        </g>

        <g filter="url(#hv-cardBlur)">
          <rect
            x="840"
            y="500"
            width="240"
            height="100"
            rx="12"
            fill="rgba(255,255,255,0.06)"
          />
          <rect
            x="840"
            y="500"
            width="240"
            height="100"
            rx="12"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
          <text
            x="858"
            y="525"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="10"
            fill="rgba(255,255,255,0.5)"
          >
            Posts scheduled
          </text>
          <text
            x="856"
            y="561"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="20"
            fontWeight="700"
            fill="rgba(255,255,255,0.9)"
          >
            127 this week
          </text>
          <circle cx="858" cy="578" r="4" fill="#22c55e" opacity="0.9" />
          <text
            x="868"
            y="583"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="10"
            fill="rgba(255,255,255,0.5)"
          >
            Active
          </text>
        </g>

        <circle cx="820" cy="150" r="2.5" fill="rgba(249,115,22,0.4)" />
        <circle cx="890" cy="310" r="1.5" fill="rgba(249,115,22,0.3)" />
        <circle cx="960" cy="260" r="2" fill="rgba(249,115,22,0.35)" />
        <circle cx="1050" cy="180" r="1.5" fill="rgba(249,115,22,0.25)" />
        <circle cx="1100" cy="310" r="3" fill="rgba(249,115,22,0.2)" />
        <circle cx="1150" cy="450" r="2" fill="rgba(249,115,22,0.3)" />
        <circle cx="1080" cy="520" r="1.5" fill="rgba(249,115,22,0.15)" />
        <circle cx="1020" cy="600" r="2.5" fill="rgba(249,115,22,0.25)" />
        <circle cx="870" cy="650" r="2" fill="rgba(249,115,22,0.2)" />
        <circle cx="940" cy="700" r="1.5" fill="rgba(249,115,22,0.15)" />
        <circle cx="1130" cy="650" r="3" fill="rgba(249,115,22,0.18)" />
        <circle cx="800" cy="700" r="2" fill="rgba(249,115,22,0.22)" />
        <circle cx="1000" cy="130" r="1.5" fill="rgba(249,115,22,0.28)" />
        <circle cx="1170" cy="200" r="2.5" fill="rgba(249,115,22,0.2)" />
        <circle cx="1140" cy="380" r="2" fill="rgba(249,115,22,0.25)" />
        <circle cx="980" cy="470" r="1.5" fill="rgba(249,115,22,0.15)" />
        <circle cx="860" cy="460" r="2" fill="rgba(249,115,22,0.12)" />
        <circle cx="1060" cy="700" r="2.5" fill="rgba(249,115,22,0.18)" />
      </svg>
    </div>
  );
}
