# BossTrack

BossTrack writes instrumental music for games, videos, whatever, using procedural generation. You pick a genre, a feeling and what the track is for (a menu loop, a combat theme, a trailer), click Generate, and it composes a song you can play back and save as a WAV. Same seed, same notes, so a track you like can always be made again.

I made it to score my own games and promo videos. It gets me close enough to then finesse in FL Studio. It should be good enough to do the same for you, or maybe you'll like what it made enough to keep it as is.

## What it does

- 30 genres, from lo-fi, bossa and cozy to rock, metal, trance, drum and bass and orchestral cues. I tried everything I could think of using.
- Short sketches, full songs, loops that repeat cleanly, and can support longer tracks of up to 5 minutes.
- Up to 8 parts per song. Lock a part's notes, instrument or mix and generate again to change everything else.
- Swap instruments per part, add effects, and save your own sound presets, mix balances and genre defaults.
- Save a WAV, stems for each part, MIDI, or the song file itself so you can open it and keep working later. Looped WAVs should have their loop points, so game engines repeat them cleanly (only tested in Godot).

## Running it

If I've made a download for it, it'll be on itch.io, under Ganktronics somewhere... It'll probably only be for Windows. Unzip it, keep the folder structure, and run `BossTrack.exe`. Node.js isn't needed here. Songs and exports go in `sounds/music` in that folder. 

To run it from source, install [Node.js](https://nodejs.org), then in this folder:

```
npm install
npm start
```

Also, `Start BossTrack.bat` does the same thing it's what I used before the executable file.

I've only tested it on Windows, but in theory, the project could run on Mac or Linux.

Songs you save from source go in a `sounds` folder next to this one, so they stay out of the repo.

The recorded instruments aren't in this repo, they're about 1.8 GB. To get them, download the Windows build from <https://ganktronics.itch.io>, unzip it, and copy its `resources/assets` folder so it sits next to this one (if you cloned into `projects/bosstrack`, it goes at `projects/assets`). Without it, the synth instruments still work and the recorded ones are hidden from the menus. Note: I've not finished the itch page at this time so... you may just need to handle finding your own instruments or getting them from the credits tab if I haven't gotten around to it yet.

`npm test` runs the tests. A few of them check the recorded instruments and skip when `assets` isn't there.

## Music you make is yours

Anything you make with BossTrack (songs, WAVs, stems, MIDI) belongs to you. Use it in personal or commercial projects, including ones you sell. No credit needed, but it's appreciated.

## Reusing the code

BossTrack is released under the [Apache License 2.0](LICENSE), by Ganktronics (<https://ganktronics.itch.io>). You can use, change and share the source, commercially too (why not?). If you share it or a modified version, include the LICENSE and [NOTICE](NOTICE) files so the credit to Ganktronics and the link stay with it, and mark the files you changed. It comes with no warranty or liability, so you're responsible for how you use it.

Version, license and sound credits are also on the About page in the app.

## Sounds

The recorded instruments come from free sample libraries, all released as CC0 (public domain): VSCO 2 Community Edition, VCSL and Virtuosity Drums from Versilian Studios, guitars, basses, drums, a cello and a singer from Karoryfer Samples, and a few Freesound recordings. [CREDITS.md](CREDITS.md) lists each library with its maker, source and license. The synth instruments are BossTrack's own code. It's not hard to add your own, licensed or open source, samples for your own tracks.
