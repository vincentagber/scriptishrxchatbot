'use client'; // Must be at the top

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                margin: 0,
                backgroundColor: '#fff',
                color: '#000'
            }}>
                <div style={{ padding: '20px', maxWidth: '500px', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: 'bold' }}>
                        Something went wrong!
                    </h2>

                    <p style={{ marginBottom: '24px', color: '#666' }}>
                        A critical error occurred. We apologize for the inconvenience.
                    </p>

                    <button
                        onClick={() => reset()}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#000',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
