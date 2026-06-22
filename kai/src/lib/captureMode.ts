/* Tiny module-level flag that lets one consumer of the voice
   recogniser (e.g. Brain Dump) temporarily steal final
   transcripts away from the global App-level handler.

   Anyone toggling capture mode is responsible for clearing it
   in their cleanup. This is fire-and-forget; intentionally
   no listener pattern — the App handler just peeks at this
   on every final result. */

let capturing = false;

export function setCapturing(on: boolean) { capturing = on; }
export function isCapturing(): boolean    { return capturing; }
