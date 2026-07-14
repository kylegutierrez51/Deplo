"use client"

export default function CustomMarker() {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0 }}>
      <defs>
        <marker
          className="react-flow__arrowhead"
          id="marker"
          markerWidth="20"
          markerHeight="20"
          viewBox="-10 -10 20 20"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
          refX="0"
          refY="0"
        >
          <polyline
            className="arrowclosed"
            style={{
              strokeWidth: 3,
              stroke: '#FFFFFF',
              fill: '#FFFFFF',
            }}
            strokeLinecap="round"
            strokeLinejoin="round"
            points="-5,-4 0,0 -5,4 -5,-4"
          />
        </marker>
      </defs>
    </svg>
  );
}