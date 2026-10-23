import { ImageResponse } from 'next/og';

export const alt = 'Holbo — Монгол аялагчдад зориулсан аяллын eSIM';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(135deg, #fbfcf8 0%, #edf4ef 100%)',
          color: '#173b33',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          padding: '72px',
          width: '100%',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            background: '#ffffff',
            border: '1px solid #e3ebe3',
            borderRadius: '36px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', fontSize: 76, fontWeight: 800 }}>
            holbo<span style={{ color: '#ef8b57' }}>.</span>
          </div>
          <div
            style={{
              color: '#284d40',
              display: 'flex',
              fontSize: 42,
              fontWeight: 700,
              marginTop: 22,
            }}
          >
            Аяллаа эхлүүл. Холбоотой бай.
          </div>
          <div
            style={{
              color: '#718078',
              display: 'flex',
              fontSize: 24,
              marginTop: 18,
            }}
          >
            Монгол аялагчдад зориулсан аяллын eSIM
          </div>
        </div>
      </div>
    ),
    size,
  );
}
