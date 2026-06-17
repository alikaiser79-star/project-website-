/* Calm, cinematic backdrop. No scanlines, no parallax, no cursor.
   Just two whisper-soft radial gradients to give the page depth. */

export default function Background() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 pointer-events-none"
      style={{
        background:
          'radial-gradient(1200px 700px at 50% 22%, rgba(255,179,0,0.025), transparent 60%),' +
          'radial-gradient(900px 600px at 82% 88%, rgba(127,203,255,0.018), transparent 60%)',
      }}
    />
  );
}
