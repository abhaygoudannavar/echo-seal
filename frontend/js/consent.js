/* Cookie consent, and the analytics it actually gates.
 *
 * CloudWatch RUM authenticates through a Cognito identity pool and stores an
 * identifier in the browser, so it is not exempt from consent. The script is
 * therefore loaded only after someone accepts: a banner that appears while the
 * tracker already runs is decoration, not consent.
 *
 * RUM_CONFIG is filled in after the Amplify domain exists, because an app
 * monitor is bound to its domain. Until then this is inert and the banner still
 * behaves correctly.
 */

const STORAGE_KEY = 'echoseal.consent';

const RUM_CONFIG = {
  applicationId: null,     // set after `aws rum create-app-monitor`
  applicationRegion: 'ap-south-1',
  identityPoolId: null,
  guestRoleArn: null,
};

/* localStorage throws in private windows and when site data is blocked, so
   every access is guarded. A failure to read consent means "not granted". */
function readConsent() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Consent simply will not persist; the banner reappears next visit, which is
       the correct failure direction. */
  }
}

function startAnalytics() {
  if (!RUM_CONFIG.applicationId || !RUM_CONFIG.identityPoolId) return;
  if (window.__rumStarted) return;
  window.__rumStarted = true;

  (function (n, i, v, r, s, c, x, z) {
    x = window.AwsRumClient = { q: [], n: n, i: i, v: v, r: r, c: c };
    window[n] = function (c, p) { x.q.push({ c: c, p: p }); };
    z = document.createElement('script');
    z.async = true;
    z.src = s;
    document.head.insertBefore(z, document.head.getElementsByTagName('script')[0]);
  })(
    'cwr',
    RUM_CONFIG.applicationId,
    '1.0.0',
    RUM_CONFIG.applicationRegion,
    'https://client.rum.us-east-1.amazonaws.com/1.19.0/cwr.js',
    {
      sessionSampleRate: 1,
      identityPoolId: RUM_CONFIG.identityPoolId,
      guestRoleArn: RUM_CONFIG.guestRoleArn,
      endpoint: `https://dataplane.rum.${RUM_CONFIG.applicationRegion}.amazonaws.com`,
      telemetries: ['performance', 'errors'],
      allowCookies: true,
      enableXRay: false,
    }
  );
}

function init() {
  const banner = document.getElementById('consent');
  if (!banner) return;

  const choice = readConsent();
  if (choice === 'granted') {
    startAnalytics();
    return;
  }
  if (choice === 'denied') return;

  banner.hidden = false;

  banner.querySelector('[data-consent="accept"]')?.addEventListener('click', () => {
    writeConsent('granted');
    banner.hidden = true;
    startAnalytics();
  });

  banner.querySelector('[data-consent="decline"]')?.addEventListener('click', () => {
    writeConsent('denied');
    banner.hidden = true;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
