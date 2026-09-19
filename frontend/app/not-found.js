import Link from 'next/link';

export const metadata = {
  title: 'Page not found',
  description: 'That page does not exist. Go to the EchoSeal home page or verify a call recording.',
  // Next marks not-found noindex automatically; a second robots tag would duplicate it.
};

export default function NotFound() {
  return (
    <>
      <h1>That page does not exist</h1>
      <p className="lede">
        The link may be out of date, or the address may have a typo in it.
      </p>
      <div className="btn-row" style={{ marginTop: '1.5rem' }}>
        <Link className="btn" href="/">
          Go to the home page
        </Link>
        <Link className="btn btn-secondary" href="/verify/">
          Verify a call recording
        </Link>
      </div>
    </>
  );
}
