import { useMemo } from 'react'

const N = 21

function isFinder(x: number, y: number) {
  const inBox = (bx: number, by: number) => x >= bx && x < bx + 7 && y >= by && y < by + 7
  return inBox(0, 0) || inBox(N - 7, 0) || inBox(0, N - 7)
}

/** QR Code decorativo (padrão fixo), usado nas ilustrações da etiqueta */
export function QrGlyph({ className, seed = 7 }: { className?: string; seed?: number }) {
  const cells = useMemo(() => {
    const out: [number, number][] = []
    let s = seed
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (isFinder(x, y)) continue
        if ((x === 7 || y === 7 || x === N - 8 || y === N - 8) && (x < 8 || y < 8)) continue
        if (rand() > 0.52) out.push([x, y])
      }
    return out
  }, [seed])

  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} rx={1.4} />
      <rect x={x + 1} y={y + 1} width={5} height={5} rx={1} fill="white" />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} />
    </g>
  )

  return (
    <svg
      viewBox={`0 0 ${N} ${N}`}
      className={className}
      fill="currentColor"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.2} />
      ))}
    </svg>
  )
}
