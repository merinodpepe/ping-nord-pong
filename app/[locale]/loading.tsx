import { Loader } from '@/components/Loader';

export default function Loading() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: '120px 0' }}>
      <Loader />
    </div>
  );
}
