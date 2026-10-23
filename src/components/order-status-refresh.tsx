'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type RefreshableStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROVISIONING'
  | 'DELIVERED'
  | 'FAILED'
  | 'EXPIRED';

export function OrderStatusRefresh({
  status,
}: {
  status: RefreshableStatus;
}) {
  const router = useRouter();

  useEffect(() => {
    if (['DELIVERED', 'FAILED', 'EXPIRED'].includes(status)) return;
    const intervalId = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(intervalId);
  }, [router, status]);

  return null;
}
