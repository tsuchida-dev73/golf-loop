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
        <div
          style={{
            width: 110, height: 110, borderRadius: '50%',
            background: '#FAF8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '5px solid rgba(255,255,255,0.3)',
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1C4230' }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
