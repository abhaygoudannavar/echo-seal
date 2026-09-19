import Link from 'next/link';
import { openGraph } from '../../lib/site';
import VerifyForm from '../../components/VerifyForm';

const DESCRIPTION =
  'Upload a recording of a phone call and find out whether it carries an EchoSeal ' +
  'watermark, and which registered organisation it belongs to.';

export const metadata = {
  title: 'Verify a call recording',
  description: DESCRIPTION,
  alternates: { canonical: '/verify/' },
  openGraph: openGraph({
    title: 'Verify a call recording | EchoSeal',
    description: DESCRIPTION,
    url: '/verify/',
    type: 'website',
  }),
};

export default function Verify() {
  return (
    <>
      <h1>Verify a call recording</h1>
      <p className="lede">
        Upload a recording, or record the call audio playing on another device. Nothing is
        kept: the audio is checked and discarded.
      </p>

      <VerifyForm />

      <section className="section">
        <h2>Reading the result</h2>
        <div className="grid-2">
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Verified</h3>
            <p>
              The watermark was found and matches a registered organisation. The audio came
              from that organisation&apos;s assistant.
            </p>
          </div>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>No watermark found</h3>
            <p>
              No mark was detected. This is not proof of a scam. Most calls carry no
              watermark, because most organisations have not registered. Treat it as
              unconfirmed.
            </p>
          </div>
        </div>
        <p className="note" style={{ marginTop: '1.25rem' }}>
          A poor recording can also mean no mark is found. If the room was noisy or the
          phone was far from the speaker, try again closer and with the volume up.
        </p>
      </section>

      <section className="section">
        <h2>What happens to your audio</h2>
        <p>
          The recording is converted in your browser, sent to our API for checking, and
          discarded once the answer comes back. It is not stored and not used for anything
          else. Details are in the <Link href="/privacy/">privacy policy</Link>.
        </p>
      </section>
    </>
  );
}
