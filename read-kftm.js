const MAGIC_NUMBER = 'kftm'.split('').map((c,i) => c.charCodeAt(0) << (i * 8)).reduce((a,b) => a+b);
const SET_SPEED = 1;
const JUMP = 2;

export async function readKFTM(/** @type{ArrayBuffer} */ buf) {
  const data = new DataView(buf);
  const magicNumber = data.getUint32(0, true);
  if (magicNumber !== MAGIC_NUMBER) {
    throw new Error('This is not a KFTM file~')
  }
  const version = data.getUint16(4, true)
  if (version !== 1) {
    throw new Error(`I don't know how to read a version ${version} KFTM file!`);
  }
  const decoder = new TextDecoder('ascii', { fatal: true });
  const [title, composer, description] = [0, 1, 2].map(i => {
    const offset = 6 + 64 * i;
    const text = decoder.decode(buf.slice(offset, offset+64));
    const idx = text.indexOf('\x00');
    if (idx === -1) return text;
    return text.slice(0, idx);
  });

  const rowCount = data.getUint16(6 + 3*64, true);
  const subRows = 8;

  let duration = 0;
  let dt = 1 / 8;
  let i = 6 + 3*64 + 2;
  const rows = Array(rowCount).fill().map((_, rowNumber) => {
    const tStart = duration;
    const cmd = data.getUint16(i, true);
    i += 2;
    const arg = data.getFloat64(i, true);
    i += 8;
    const tracks = Array(subRows).fill().map(() => {
      const amp = data.getFloat64(i, true);
      i += 8;
      const freq = data.getFloat64(i, true);
      i += 8;
      return { amp, freq };
    })
    if (cmd === SET_SPEED) {
      dt = 1/arg;
    } else if (cmd === JUMP) {
      // TODO looping
      dt = 0;
    }
    if (!(dt > 0)) {
      return null;
    }
    duration += dt;
    const tEnd = duration;

    return { tStart, tEnd, tracks };
  }).filter(row => row);

  if (i !== buf.byteLength) {
    throw new Error(`Error! Read ${i} bytes, but filesize is ${buf.byteLength} bytes`)
  }

  const sampleRate = 44100;
  const ctx = new OfflineAudioContext({
    sampleRate,
    length: sampleRate * duration,
    numberOfChannels: 1,
  })

  for (let i = 0; i < subRows; ++i) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, 0)
    osc.frequency.setValueAtTime(0, 0);
    osc.connect(gain);
    osc.start(0);
    gain.connect(ctx.destination);
    for (const row of rows) {
      const {tStart, tEnd} = row;
      const {amp, freq} = row.tracks[i];
      if (amp < 0) {
        gain.gain.setValueAtTime(0, tStart)
      } else if (amp > 0) {
        gain.gain.setValueAtTime(amp, tStart)
      }
      if (freq < 0) {
        osc.frequency.setValueAtTime(0, tStart)
      } else if (freq > 0) {
        osc.frequency.setValueAtTime(freq, tStart)
      }
    }
  }

  return ctx.startRendering().then(audioBuffer => ({ audioBuffer, title, composer, description }));
}
