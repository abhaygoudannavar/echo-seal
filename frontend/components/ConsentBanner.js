'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/* CloudWatch RUM authenticates through a Cognito identity pool and stores an
   identifier in the browser, so it is not exempt from consent. The script is
   injected only after someone accepts: a banner that shows while the tracker
   already runs is decoration, not consent.

   The guest role is scoped to rum:PutRumEvents on this app monitor alone, so these
   values being public in the bundle grants nothing beyond sending telemetry here.
   That is inherent to browser RUM. */
const STORAGE_KEY = 'echoseal.consent';

const RUM_CONFIG = {
  applicationId: 'f48cceb6-51e9-4d35-bcef-3dbf0f1be493',
  applicationRegion: 'ap-south-1',
  identityPoolId: 'ap-south-1:c8ac8149-ba2b-4c9f-a113-8040cc5050f4',
  guestRoleArn: 'arn:aws:iam::988573433187:role/echoseal-rum-guest',
};

function startAnalytics() {
  if (!RUM_CONFIG.applicationId || !RUM_CONFIG.identityPoolId) return;
  if (window.__rumStarted) return;
  window.__rumStarted = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://client.rum.us-east-1.amazonaws.com/1.19.0/cwr.js';
  window.AwsRumClient = {
    q: [],
    n: 'cwr',
    i: RUM_CONFIG.applicationId,
    v: '1.0.0',
    r: RUM_CONFIG.applicationRegion,
    c: {
      sessionSampleRate: 1,
      identityPoolId: RUM_CONFIG.identityPoolId,
      guestRoleArn: RUM_CONFIG.guestRoleArn,
      endpoint: `https://dataplane.rum.${RUM_CONFIG.applicationRegion}.amazonaws.com`,
      telemetries: ['performance', 'errors'],
      allowCookies: true,
      enableXRay: false,
    },
  };
  window.cwr = function (c, p) {
    window.AwsRumClient.q.push({ c, p });
  };
  document.head.appendChild(script);
}

export default function ConsentBanner() {
  // Hidden on the server and on first paint: the stored choice is only readable
  // in the browser, and rendering the banner before that check would flash it at
  // people who already decided.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let choice = null;
    try {
      choice = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* Private windows and blocked site data throw. Treat as no consent. */
    }
    if (choice === 'granted') startAnalytics();
    else if (choice !== 'denied') setVisible(true);
  }, []);

  function decide(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* Choice will not persist, so the banner returns next visit. That is the
         correct direction to fail. */
    }
    setVisible(false);
    if (value === 'granted') startAnalytics();
  }

  if (!visible) return null;

  return (
    <div className="consent" role="region" aria-label="Cookie consent">
      <div className="wrap">
        <p>
          We would like to measure page performance and errors using AWS CloudWatch RUM,
          which stores an identifier in your browser. Nothing loads until you choose. See
          our <Link href="/privacy/">privacy policy</Link>.
        </p>
        <div className="btn-row">
          <button className="btn btn-secondary" type="button" onClick={() => decide('denied')}>
            Decline
          </button>
          <button className="btn" type="button" onClick={() => decide('granted')}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
