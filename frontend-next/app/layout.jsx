import './globals.css';

export const metadata = {
    title: 'EchoSeal — Zero-Trust Voice Provenance',
    description: 'Verify AI voices on phone calls. Banks watermark their AI voice assistants with EchoSeal.',
    icons: {
        icon: '/img/favicon.svg',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap" rel="stylesheet" />
            </head>
            <body>{children}</body>
        </html>
    );
}
