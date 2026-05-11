import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180, height: 180, borderRadius: 40,
          background: '#1C4230',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="144" height="144" viewBox="0 0 144 144">
          {/* Golf ball */}
          <circle cx="54" cy="96" r="40" fill="white" />
          {/* Flag pole */}
          <rect x="95" y="22" width="7" height="82" rx="3.5" fill="white" />
          {/* Terracotta flag */}
          <polygon points="102,22 142,44 102,66" fill="#C0522D" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
