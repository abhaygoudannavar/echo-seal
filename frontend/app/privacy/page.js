import { openGraph } from '../../lib/site';

const DESCRIPTION =
  'What EchoSeal does with audio you upload, what is stored, what is not, and how analytics consent works.';

export const metadata = {
  title: 'Privacy policy',
  description: DESCRIPTION,
  alternates: { canonical: '/privacy/' },
  openGraph: openGraph({
    title: 'Privacy policy | EchoSeal',
    description: DESCRIPTION,
    url: '/privacy/',
    type: 'article',
  }),
};

export default function Privacy() {
  return (
    <div className="prose">
<h1>Privacy policy</h1>
    <p className="lede">
      EchoSeal is a student project built for the WeMakeDevs First Commit hackathon. It
      is a demonstration, not a commercial service. This page describes exactly what the
      software does with data, in plain terms.
    </p>
    <p className="note">
      Last updated 19 September 2026. Because this is a hackathon project rather than an
      operating company, this policy has not been reviewed by a lawyer. Do not upload
      audio you would be unwilling to send to a third party.
    </p>

    <h2>Audio you check on the verify page</h2>
    <p>
      Your recording is converted to a compact format inside your own browser, then sent
      to our API over HTTPS. There it is written to temporary storage, analysed for a
      watermark, and deleted when the request finishes. It is not written to a database,
      not kept in object storage, and not used to train anything.
    </p>
    <p>
      Our server logs record the outcome of each check: whether a watermark was found,
      the identifier that was decoded, and a confidence number. They do not contain the
      audio or any transcript of it. We do not transcribe speech at any point.
    </p>

    <h2>Audio you generate on the agent console</h2>
    <p>
      This works differently, so it is worth stating separately. Text you submit is sent
      to Amazon Polly to be spoken, watermarked, and then stored in an Amazon S3 bucket
      that we control, so that the page can give you a playback link. That link expires
      after one hour, but the file itself remains in the bucket until the project
      infrastructure is deleted after the hackathon.
    </p>
    <p>
      Treat the agent console as public. Do not put personal information into it.
    </p>

    <h2>Analytics</h2>
    <p>
      If you accept on the consent banner, we load AWS CloudWatch RUM, which measures
      page load performance and JavaScript errors. It stores an identifier in your
      browser so repeated page views within a session can be grouped together. It does
      not receive any audio you upload.
    </p>
    <p>
      If you decline, the analytics script is never loaded and no identifier is stored.
      Your choice is remembered in your browser&apos;s local storage under the key
      <code>echoseal.consent</code>, and nowhere else. Clearing site data resets it.
    </p>

    <h2>What we do not collect</h2>
    <ul>
      <li>No accounts, so no names, email addresses or passwords.</li>
      <li>No advertising or cross site tracking, and no third party trackers.</li>
      <li>No payment information, because nothing is sold.</li>
      <li>No contact form, so nothing you write reaches us except the text you speak through the agent console.</li>
    </ul>

    <h2>Where data is processed</h2>
    <p>
      Our API and storage run in Amazon Web Services in the Asia Pacific (Mumbai)
      region. AWS processes this data on our behalf as our infrastructure provider.
    </p>

    <h2>Retention and deletion</h2>
    <p>
      Verification audio is deleted as soon as the check completes. Generated audio and
      server logs are removed when the project infrastructure is torn down after the
      hackathon, which we expect to be within a few weeks of the date above. There is no
      account, so there is nothing to delete on request. If you want a generated clip
      removed sooner, contact us through the project repository.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about this policy can be raised as an issue on the project&apos;s GitHub
      repository, which is the only channel this project runs.
    </p>
    </div>
  );
}
