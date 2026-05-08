import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: '#1C4230',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 20, height: 20, borderRadius: '50%',
            background: '#FAF8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1C4230' }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
