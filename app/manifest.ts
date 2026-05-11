import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Golf Loop',
    short_name: 'Golf Loop',
    description: 'ゴルフ改善サイクルアプリ — 練習・ラウンド・分析を記録してスコアアップ',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF8F0',
    theme_color: '#1C4230',
    categories: ['sports'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
