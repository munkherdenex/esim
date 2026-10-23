interface CountryFlagProps {
  code: 'CN' | 'KR';
  className?: string;
}

export function CountryFlag({ code, className = '' }: CountryFlagProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 40"
      className={`overflow-hidden rounded-md shadow-sm ${className}`}
    >
      {code === 'CN' ? (
        <>
          <rect width="60" height="40" fill="#DE2910" />
          <path
            d="m15 5 2.35 7.23h7.6l-6.15 4.47 2.35 7.23L15 19.46l-6.15 4.47 2.35-7.23-6.15-4.47h7.6L15 5Z"
            fill="#FFDE00"
          />
          <path
            d="m31 6 .9 2.7h2.85l-2.3 1.67.88 2.7L31 11.4l-2.32 1.67.88-2.7-2.3-1.67h2.85L31 6Zm8 6-.9 2.7h-2.85l2.3 1.67-.88 2.7L39 17.4l2.32 1.67-.88-2.7 2.3-1.67h-2.85L39 12Zm-1 11-1 2.7h-2.85l2.3 1.67-.88 2.7L38 28.4l2.32 1.67-.88-2.7 2.3-1.67h-2.85L38 23Zm-7 6-.9 2.7h-2.85l2.3 1.67-.88 2.7L31 34.4l2.32 1.67-.88-2.7 2.3-1.67h-2.85L31 29Z"
            fill="#FFDE00"
          />
        </>
      ) : (
        <>
          <rect width="60" height="40" fill="#fff" />
          <path
            d="M30 10a10 10 0 0 1 0 20 5 5 0 0 1 0-10 5 5 0 0 0 0-10Z"
            fill="#CD2E3A"
          />
          <path
            d="M30 30a10 10 0 0 1 0-20 5 5 0 0 1 0 10 5 5 0 0 0 0 10Z"
            fill="#0047A0"
          />
          <path
            d="m10 8 10 5-1.5 3L8.5 11Zm-2 5 10 5-1.5 3-10-5Zm34 6 10-5 1.5 3-10 5Zm2 5 10-5 1.5 3-10 5ZM11 27l10-5 1.5 3-10 5Zm2 5 10-5 1.5 3-10 5Zm26-18 10 5-1.5 3-10-5Zm-2 5 10 5-1.5 3-10-5Z"
            fill="#111"
          />
        </>
      )}
    </svg>
  );
}
