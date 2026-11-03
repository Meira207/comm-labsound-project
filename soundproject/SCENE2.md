# Scene 2: Two days left

Open `page2.html` directly or serve `soundproject/` with a local static HTTP server.
HTTP playback uses decoded Web Audio when available. Direct-file pages, failed
fetches and unsupported decoders use preloaded native audio elements instead.
Begin unlocks those elements before asynchronous loading. There are no build dependencies.

## Interaction and sound

Begin starts D-2: room ambience, quiet piano, and the slow typing recording only.
Fast writing, typing, page flipping, pressure and notifications are blocked at D-2.
The visitor controls how long they stay at D-2. Clicking the wall calendar or
“Tear off a day” starts the paper recording and reveals D-1 in the same action.
The old sheet falls behind the new date over 1.1 seconds. The room darkens and
anxious thoughts appear immediately as the sound starts.

At D-1, slow typing fades out over 0.5 seconds and piano over 0.8 seconds.
Fast writing, fast typing and continuous page flipping enter within one second;
the louder pressure recording builds over 4 seconds. After 6 seconds, writing
crossfades to the team's fastest take. Notifications begin at 3 seconds and repeat
every 22 seconds, leaving space for the approximately 17-second recording.
The background darkens to 40% brightness over 2 seconds with a deep edge shadow.
The mix then holds until the visitor continues, replays, or leaves.

Mute affects every layer. Start over returns to D-2, cancels pending cues, and
preserves the mute setting. Audio pauses while the browser tab is hidden and
stops on navigation. Keyboard users can activate either calendar control with
Enter or Space. Reduced-motion settings disable the tear and visual transitions.
Captions describe the sound changes.

## Recording sources

The eight added WAV files came from the team's
[shared recordings folder](https://drive.google.com/drive/folders/1QxgV6u4w8Wm3jI_PDhdys59EvuTnmxLa).
They retain their original audio data; filenames use underscores locally.
Room ambience and piano were already present in the repository. The calendar tear
uses the user-provided edited `audio/calendar_sound.mp3`, played at its original speed
in both Scenes 1 and 2. Both scenes preload/decode the tear and remove quiet
lead-in in memory using `js/calendar-audio.js`, retaining 5 milliseconds before
the detected onset. The source MP3 is unchanged. The date and decoded sound
start together, without loading a fresh media element on each tear.
No generated audio is used.

| Local file | Drive file ID | Mix gain |
| --- | --- | --- |
| Writing.WAV | 1Am97AGtH-bJTGR4Y-rzSggMKHS0KosUN | Retained, unused |
| Slow_typing.WAV | 18WQ8CrGjm7Y-VRmzL9B8EomMphC2oYUV | 0.22 at D-2 |
| Fast_writing.WAV | 1b94A8B8j2-YMj9-MTvAA7aBWtsqHKv2l | 0.65 at D-1 |
| Fastest_writing.WAV | 1CWyttAQxyk7ARlgl_dnJYrcKsPNhTaks | 0.75 after 6 seconds at D-1 |
| Fast_typing.WAV | 1Mz7jjZVL1z1V4BXXofxbln1STMLraqvM | 0.55 at D-1 |
| Fast_page_flipping.WAV | 1m_0qcmyRbRB1z_P5bMeLjXwKvPpYhzUs | 0.40 loop at D-1 |
| Pressure_builds_up.WAV | 1K-_fUAqq--5doL376CTQgUpWshEJlHTi | 0.70 at D-1 |
| Notification.WAV | 1SRk7PNDdn_kz-TJgKtY0AcPBP-3ZQbDd | 0.30 per cue |

The master gain is 0.70, followed by a compressor to control overlapping peaks
when using Web Audio. Native playback applies the same gain to each track.
Room ambience changes from 0.24 at D-2 to 0.10 at D-1;
piano starts at 0.12; the calendar tear uses 0.75. Edit `RECORDINGS` and the cue
levels in `js/page2.js` to tune the sound design.

## Integration and validation

Scene 1 now tears down to two days before handing off to Scene 2. Scene 2 link
labels in Scenes 1 and 3 also read “Two days.” Scene 3's content is otherwise unchanged.

Fallback checks covered direct-file playback without fetch, failed HTTP fetches,
successful Web Audio loading, D-2/D-1 layers, mute, and cleanup of media fades.
JavaScript syntax and local asset references were checked. Added WAV files were
checked for valid, complete PCM data. A simulated DOM/audio lifecycle check covered
Begin, D-1 transition, repeated clicks, mute, tab visibility, replay during a tear,
cancellation of old captions and cues, and navigation cleanup.

Browser visual QA and listening/mix review remain pending: the in-app browser
could not reach the local preview, and native browser automation stopped because
it could not verify the current browser URL.
