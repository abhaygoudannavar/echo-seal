import Link from 'next/link';
import { openGraph } from '../lib/site';
import GenerateForm from '../components/GenerateForm';
import Marquee from '../components/Marquee';
import Team from '../components/Team';

const DESC =
  'Banks watermark their AI voice assistants with EchoSeal. Anyone receiving a call can ' +
  'check the recording and see which registered organisation it came from.';

export const metadata = {
  // Absolute title: the home page should not read "EchoSeal | EchoSeal".
  title: { absolute: 'EchoSeal: verify an AI voice on a phone call' },
  description:
    'Banks watermark their AI voice assistants with EchoSeal. Anyone receiving a call can ' +
    'check the recording and see which registered organisation it came from.',
  alternates: { canonical: '/' },
  openGraph: openGraph({
    title: 'EchoSeal: verify an AI voice on a phone call',
    description: DESC,
    url: '/',
    type: 'website',
  }),
};

export default function Home() {
  return (
    <>
      <h1>Check whether an AI voice on a call is really your bank</h1>
      <p className="lede">
        Voice cloning is cheap enough that a scammer can sound exactly like your bank, or
        like a relative in trouble. EchoSeal puts an inaudible mark inside the speech of AI
        assistants that have registered with us, so a recording of the call can be checked
        afterwards.
      </p>

      <div className="btn-row" style={{ marginTop: '1.5rem' }}>
        <Link className="btn" href="/verify/">
          Check a recording
        </Link>
        <a className="btn btn-secondary" href="#how">
          How it works
        </a>
      </div>

      <Marquee />

      <section className="section" id="how">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            A registered organisation generates its automated call audio through EchoSeal.
            We embed a 16 bit identifier into the sound itself.
          </li>
          <li>
            The mark sits about 29 dB below the speech and follows its shape, so it is
            inaudible. The call sounds completely ordinary.
          </li>
          <li>
            Anyone with a recording can upload it here. If the mark is found, we show which
            registered organisation it belongs to.
          </li>
        </ol>
      </section>

      <section className="section">
        <h2>What this does and does not tell you</h2>
        <div className="grid-2">
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>It confirms a known caller</h3>
            <p>
              When the watermark is present and matches the registry, you know the audio
              came from that organisation&apos;s registered assistant.
            </p>
          </div>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>It does not detect fakes</h3>
            <p>
              Audio with no watermark is simply unverified. It could be a human, an
              organisation that has not registered, or a scammer. Absence of a mark is not
              evidence of fraud.
            </p>
          </div>
        </div>
        <p className="note" style={{ marginTop: '1.25rem' }}>
          If a call asks for a one time password, a transfer, or remote access to your
          device, hang up and call the number printed on your card. No verification tool
          replaces that.
        </p>
      </section>

      <section className="section" id="console">
        <h2>Agent console</h2>
        <p>
          This is the side an organisation uses. Generate a watermarked clip, then check it
          on the verify page to see the full round trip.
        </p>
        <GenerateForm />
      </section>

      <Team />
    </>
  );
}
