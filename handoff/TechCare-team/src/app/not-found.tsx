import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>We couldn’t find that page.</h1>
      <p>Let’s get you back to your community.</p>
      <Link className="button primary" href="/">
        Back to Home
      </Link>
    </div>
  );
}
